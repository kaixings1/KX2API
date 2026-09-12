/**
 * pages/Chat/ChatPage.tsx — 单栏对话界面
 *
 * 设计原则：
 * - 无左中右三栏，只有一个对话区域
 * - 文件树和终端在对话中内嵌/折叠
 * - 最小化状态，避免死循环
 */

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Components } from 'react-markdown'
import { FileTree } from './FileTree'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import './ChatPage.css'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'error' | 'system'
  content: string
  timestamp: number
  _deleted?: boolean
}

// ---------- helpers ----------

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function detectToolBlocks(content: string): { type: 'text' | 'tool-result'; text: string }[] {
  const blocks: { type: 'text' | 'tool-result'; text: string }[] = []
  // Match [tool: name]...[/tool] blocks
  const regex = /\[tool:(.+?)\]([\s\S]*?)\[\/tool\]/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      blocks.push({ type: 'text', text: content.slice(lastIndex, m.index) })
    }
    blocks.push({ type: 'tool-result', text: m[2].trim() })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < content.length) {
    blocks.push({ type: 'text', text: content.slice(lastIndex) })
  }
  if (blocks.length === 0) {
    blocks.push({ type: 'text', text: content })
  }
  return blocks
}

function ToolResultView({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="tool-result-block">
      <div className="tool-result-header" onClick={() => setExpanded(p => !p)}>
        <span>{expanded ? '▼' : '▶'}</span>
        <span>工具调用结果</span>
        <span style={{ opacity: 0.5, fontSize: 11 }}>
          {expanded ? '点击收起' : '点击展开'}
        </span>
      </div>
      {expanded && (
        <div className="tool-result-body">
          <code>{text || '(空)'}</code>
        </div>
      )}
    </div>
  )
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const match = /language-(\w+)/.exec(className || '')
  const code = (children as string) || ''
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    copyToClipboard(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-block-wrapper">
      {match && (
        <div className="code-block-header">
          <span className="code-block-lang">{match[1]}</span>
          <button
            className="code-copy-btn"
            onClick={handleCopy}
            type="button"
            title={copied ? '已复制' : '复制代码'}
          >
            {copied ? '✓ 已复制' : '复制'}
          </button>
        </div>
      )}
      {!match && (
        <button
          className="code-copy-btn code-copy-btn-float"
          onClick={handleCopy}
          type="button"
          title={copied ? '已复制' : '复制代码'}
        >
          {copied ? '✓' : '复制'}
        </button>
      )}
      <div className={className ? `code-block-pre ${className}` : 'code-block-plain'}>
        <code>{children}</code>
      </div>
    </div>
  )
}

const mdComponents: Components = {
  code({ children, className }) {
    return <CodeBlock className={className}>{children as string}</CodeBlock>
  },
}

function hasMarkdown(text: string): boolean {
  return /(^#{1,6}\s)|(\*\*[\s\S]*?\*\*)|(`{1,3}[\s\S]*?`{1,3})|(^[-*]\s)|(^>\s)|(^\d+\.\s)|(\[.+?\]\(.+?\))/m.test(text)
}

function MessageContent({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const blocks = detectToolBlocks(content)
  const lastBlockIdx = blocks.length - 1
  return (
    <div>
      {blocks.map((block, i) => {
        if (block.type === 'tool-result') {
          return <ToolResultView key={i} text={block.text} />
        }
        const text = block.text
        if (!text) return null
        const showCursor = isStreaming && i === lastBlockIdx
        return (
          <div key={i} className={`md-prose ${showCursor ? 'typing-cursor' : ''}`}>
            {hasMarkdown(text) ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                {text}
              </ReactMarkdown>
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const MemoMessageContent = memo(MessageContent)

// ---------- main page ----------

const STORAGE_KEY = 'kx2code_conversations'

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [sidebarFiles, setSidebarFiles] = useState<{ name: string; path: string }[]>([])
  const [terminalOutput, setTerminalOutput] = useState('')
  const [terminalInput, setTerminalInput] = useState('')
  const [config, setConfig] = useState({ provider: 'openai', model: 'gpt-4o', apiKey: '', baseUrl: '' })
  const [showConfig, setShowConfig] = useState(false)
  const [profiles, setProfiles] = useState<{ name: string; provider: string; baseUrl: string; model: string; active?: boolean }[]>([])
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null)
  const [useProxy, setUseProxy] = useState(false)
  const [directBaseUrl, setDirectBaseUrl] = useState('')
  const [proxyMode, setProxyMode] = useState<'standard' | 'proxy'>('standard')
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamStatusRef = useRef<'idle' | 'streaming'>('idle')
  const messagesRef = useRef<Message[]>([])

  // 同步 ref，避免 stale closure
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { streamStatusRef.current = isStreaming ? 'streaming' : 'idle' }, [isStreaming])

  // 自动滚动到底部
  useEffect(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, userScrolledUp])

  // 检测用户是否手动向上滚动
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop
    setUserScrolledUp(distanceFromBottom > 200)
  }, [])

  const scrollToBottom = useCallback(() => {
    setUserScrolledUp(false)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // 加载配置和配置组
  useEffect(() => {
    // 加载引擎配置
    if (window.electronAPI?.chat?.getConfig) {
      window.electronAPI.chat.getConfig().then((c: Record<string, unknown>) => {
        if (c?.apiKey) setConfig(prev => ({ ...prev, apiKey: c.apiKey as string }))
        if (c?.provider) setConfig(prev => ({ ...prev, provider: c.provider as string }))
        if (c?.model) setConfig(prev => ({ ...prev, model: c.model as string }))
        if (c?.baseUrl) setConfig(prev => ({ ...prev, baseUrl: c.baseUrl as string }))
      })
    }
    // 加载配置组列表
    if (window.electronAPI?.profiles?.getAll) {
      window.electronAPI.profiles.getAll().then((r: Record<string, unknown>) => {
        if (r.success && r.profiles) {
          setProfiles(r.profiles as typeof profiles)
          setActiveProfileName(r.activeProfile as string | null)
        }
      })
    }
    // 加载文件浏览器列表
    if (window.electronAPI?.dogeConfig?.listFiles) {
      window.electronAPI.dogeConfig.listFiles().then((r: Record<string, unknown>) => {
        if (r.success && r.files) {
          setSidebarFiles((r.files as Array<{ name: string; path: string }>).map(f => ({ name: f.name, path: f.path })))
        }
      })
    }
  }, [])

  // 加载历史消息
  useEffect(() => {
    if (window.electronAPI?.chat?.getHistory) {
      window.electronAPI.chat.getHistory().then((history: { messages: Array<{ role: string; content: string }> }) => {
        if (history.messages?.length) {
          const mapped = history.messages.map((m: { role: string; content: string }, i: number) => ({
            id: `hist-${i}`,
            role: m.role as Message['role'],
            content: m.content,
            timestamp: Date.now() - (history.messages.length - i) * 1000,
          }))
          setMessages(mapped)
        }
      })
    }
  }, [])

  // 对话持久化：自动保存/恢复消息
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Conversation[]
        setConversations(parsed)
        if (parsed.length > 0) {
          setMessages(parsed[0].messages)
          setCurrentConversationId(parsed[0].id)
        }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    const id = currentConversationId || ('conv_' + Date.now())
    if (!currentConversationId) {
      setCurrentConversationId(id)
    }
    const conv: Conversation = {
      id,
      title: messages[0]?.content?.slice(0, 40) || '新对话',
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setConversations(prev => {
      const next = [conv, ...prev.filter(c => c.id !== id)].slice(0, 50)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [messages, currentConversationId])

  // 命令处理
  const builtInCommands: Record<string, { desc: string; handler: (args: string[]) => Promise<void> }> = {
    '/clear': {
      desc: '清空对话',
      handler: async () => {
        if (window.electronAPI?.chat?.clearHistory) {
          await window.electronAPI.chat.clearHistory()
        }
        setMessages([])
        appendSystemMessage('对话已清空')
      },
    },
    '/help': {
      desc: '显示帮助',
      handler: async () => {
        const helpText = [
          'KX2Code 命令列表：',
          '',
          '**对话命令**：',
          '  /clear — 清空对话历史',
          '  /help — 显示此帮助',
          '  /new — 开始新对话',
          '',
          '**系统命令**：',
          '  /config — 查看配置',
          '  /model <名称> — 切换模型',
          '  /stats — 使用统计',
        ].join('\n')
        appendSystemMessage(helpText)
      },
    },
    '/new': {
      desc: '新对话',
      handler: async () => {
        if (window.electronAPI?.chat?.clearHistory) {
          await window.electronAPI.chat.clearHistory()
        }
        setMessages([])
        appendSystemMessage('已开始新对话')
      },
    },
  }

  function appendSystemMessage(text: string) {
    const sysMsg: Message = {
      id: `msg-${Date.now()}-sys`,
      role: 'system',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, sysMsg])
  }

  async function executeCommand(input: string): Promise<boolean> {
    const trimmed = input.trim()
    const commandName = trimmed.split(' ')[0]
    const args = trimmed.slice(commandName.length).trim().split(' ').filter(Boolean)

    const cmd = builtInCommands[commandName]
    if (cmd) {
      await cmd.handler(args)
      return true
    }

    // 通过引擎执行命令
    if (window.electronAPI?.chat?.executeCommand) {
      try {
        const result = await window.electronAPI.chat.executeCommand(commandName, args)
        if (result.success) {
          appendSystemMessage(result.output || '命令执行成功')
        } else {
          const errMsg: Message = {
            id: `msg-${Date.now()}-err`,
            role: 'error',
            content: result.error || '命令执行失败',
            timestamp: Date.now(),
          }
          setMessages(prev => [...prev, errMsg])
        }
        return true
      } catch (e) {
        const errMsg: Message = {
          id: `msg-${Date.now()}-err`,
          role: 'error',
          content: (e as Error).message,
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, errMsg])
        return true
      }
    }

    return false
  }

  async function handleTerminalCommand(cmd: string): Promise<void> {
    const trimmed = cmd.trim()
    if (!trimmed) return

    // 支持 /xxx 命令
    if (trimmed.startsWith('/')) {
      const handled = await executeCommand(trimmed)
      if (handled) {
        setTerminalOutput(prev => prev + '命令执行完成\n\n')
        return
      }
    }

    // 直接执行 shell 命令
    if (window.electronAPI?.chat?.executeCommand) {
      try {
        const parts = trimmed.split(' ')
        const commandName = parts[0]
        const args = parts.slice(1)
        const result = await window.electronAPI.chat.executeCommand(commandName, args)
        if (result.success) {
          setTerminalOutput(prev => prev + (result.output || '(无输出)') + '\n\n')
        } else {
          setTerminalOutput(prev => prev + '错误: ' + (result.error || '命令执行失败') + '\n\n')
        }
      } catch (e) {
        setTerminalOutput(prev => prev + '错误: ' + (e as Error).message + '\n\n')
      }
    }
  }

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streamStatusRef.current === 'streaming') return

    // 命令处理
    if (text.startsWith('/')) {
      setInput('')
      const handled = await executeCommand(text)
      if (handled) return
    }

    const assistantId = 'msg-' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    streamStatusRef.current = 'streaming'
    setUserScrolledUp(false)

    // 创建占位 assistant 消息
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }] as Message[])

    const cleanupChunk = window.electronAPI.chat.onStreamChunk(({ chunk }) => {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: m.content + chunk } : m
      ))
    })

    const cleanupDone = window.electronAPI.chat.onStreamDone(({ content, toolOutput }) => {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: content || toolOutput || '' } : m
      ))
      setIsStreaming(false)
      streamStatusRef.current = 'idle'
      cleanupChunk()
      cleanupDone()
      cleanupError()
    })

    const cleanupError = window.electronAPI.chat.onStreamError(({ error }) => {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, role: 'error' as const, content: error } : m
      ))
      setIsStreaming(false)
      streamStatusRef.current = 'idle'
      cleanupChunk()
      cleanupDone()
      cleanupError()
    })

    try {
      const result = await window.electronAPI.chat.sendMessage(text)
      if (!result.success && result.error) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, role: 'error' as const, content: result.error || '发送失败' } : m
        ))
        setIsStreaming(false)
        streamStatusRef.current = 'idle'
        cleanupChunk()
        cleanupDone()
        cleanupError()
      }
    } catch (e) {
      const errMsg = (e as Error).message || '发送失败'
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, role: 'error' as const, content: errMsg } : m
      ))
      setIsStreaming(false)
      streamStatusRef.current = 'idle'
      cleanupChunk()
      cleanupDone()
      cleanupError()
    }
  }, [input])

  const handleAbort = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
    streamStatusRef.current = 'idle'
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleNewChat = useCallback(async () => {
    if (window.electronAPI?.chat?.clearHistory) {
      await window.electronAPI.chat.clearHistory()
    }
    setMessages([])
    setUserScrolledUp(false)
  }, [])

  const saveConfig = useCallback(async () => {
    if (window.electronAPI?.chat?.setConfig) {
      await window.electronAPI.chat.setConfig({ provider: config.provider, model: config.model })
    }
  }, [config])

  const handleProfileSwitch = useCallback(async (name: string) => {
    if (!window.electronAPI?.profiles?.setActive) return
    const result = await window.electronAPI.profiles.setActive(name)
    if (result.success && result.profile) {
      const p = result.profile as { provider: string; model: string; baseUrl: string; apiKey: string }
      setConfig({ provider: p.provider, model: p.model, apiKey: p.apiKey, baseUrl: p.baseUrl })
      setDirectBaseUrl(p.baseUrl)
      setProxyMode('standard')
      setActiveProfileName(name)
    }
  }, [])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
  }

  // 判断最后一条消息是否是正在流式输出的 assistant
  const lastMsg = messages[messages.length - 1]
  const isLastAssistantStreaming = isStreaming && lastMsg?.role === 'assistant' && !lastMsg?.content

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* 顶部工具栏 */}
      <header className="flex items-center justify-between px-4 h-10 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(p => !p)}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
            title="文件浏览器"
          >
            {showSidebar ? '◀' : '📁'}
          </button>
          <button
            onClick={() => setShowTerminal(p => !p)}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
            title="终端"
          >
            {showTerminal ? '▼' : '⌨'}
          </button>
          {/* 配置弹窗 */}
          <Sheet open={showConfig} onOpenChange={setShowConfig}>
            <SheetTrigger asChild>
              <button
                className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
                title="配置"
              >
                ⚙
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[360px] sm:w-[420px]">
              <SheetHeader>
                <SheetTitle>对话配置</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Provider</Label>
                  <select
                    value={config.provider}
                    onChange={e => setConfig(p => ({ ...p, provider: e.target.value }))}
                    className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text)]"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Model</Label>
                  <Input
                    value={config.model}
                    onChange={e => setConfig(p => ({ ...p, model: e.target.value }))}
                    placeholder="gpt-4o"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={config.apiKey}
                    onChange={e => setConfig(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="sk-..."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Base URL</Label>
                  <Input
                    value={config.baseUrl}
                    onChange={e => setConfig(p => ({ ...p, baseUrl: e.target.value }))}
                    placeholder="https://api.openai.com"
                  />
                </div>
                <Button onClick={saveConfig} className="w-full">保存配置</Button>
              </div>
            </SheetContent>
          </Sheet>
          {/* 配置组选择器 */}
          <select
            value={activeProfileName ?? ''}
            onChange={e => { if (e.target.value) handleProfileSwitch(e.target.value) }}
            className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text)] max-w-[140px]"
            title="切换配置组"
          >
            <option value="">-- 配置组 --</option>
            {profiles.map(p => (
              <option key={p.name} value={p.name}>{p.name} ({p.provider})</option>
            ))}
          </select>
          {/* 模式切换 */}
          <button
            onClick={() => {
              const next = proxyMode === 'standard' ? 'proxy' : 'standard'
              setProxyMode(next)
              if (next === 'proxy') {
                window.electronAPI.chat.setConfig({ baseUrl: 'http://127.0.0.1:8080' })
              } else {
                window.electronAPI.chat.setConfig({ baseUrl: directBaseUrl })
              }
            }}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              proxyMode === 'proxy'
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent-primary)]'
            }`}
            title={proxyMode === 'proxy' ? '当前：本地代理模式 (127.0.0.1:8080)' : '当前：标准直连模式'}
          >
            {proxyMode === 'proxy' ? '🔄 代理' : '🌐 直连'}
          </button>
          <span className="text-[10px] text-[var(--text-faint)] truncate max-w-[120px]" title={config.baseUrl}>
            {config.provider}/{config.model}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
          >
            新对话
          </button>
          <span className="text-xs text-[var(--text-faint)]">
            {messages.length} 条消息
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 可折叠侧边栏：文件树 */}
        {showSidebar && (
          <aside className="w-52 border-r border-[var(--border)] bg-[var(--bg-secondary)] overflow-auto flex-shrink-0">
            <div className="p-2 text-xs text-[var(--text-muted)] font-medium">文件浏览器</div>
            <FileTree files={sidebarFiles} />
          </aside>
        )}

        {/* 主对话区域 */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* 消息列表 */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto chat-scroll-area"
            onScroll={handleScroll}
          >
            {messages.length === 0 ? (
              /* ===== 空状态 — llama.cpp 风格 Greeting ===== */
              <div className="chat-empty-state">
                <div className="chat-greeting-icon">💬</div>
                <div className="chat-greeting-title">开始新对话</div>
                <div className="chat-greeting-hint">
                  输入消息与 AI 对话，或使用 <code className="text-[var(--accent-primary)]">/</code> 命令
                </div>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {Object.entries(builtInCommands).map(([key, cmd]) => (
                    <button
                      key={key}
                      onClick={async () => {
                        setInput(key + ' ')
                        await handleSend()
                      }}
                      className="text-xs px-3 py-1.5 rounded-full border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                    >
                      {cmd.desc}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="chat-messages-list py-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={msg.role === 'user'
                    ? 'chat-msg-user'
                    : msg.role === 'error'
                      ? 'chat-msg-error'
                      : msg.role === 'system'
                        ? 'chat-msg-system'
                        : 'chat-msg-assistant'
                  }>
                    {/* Role label */}
                    {msg.role !== 'system' && (
                      <div className="chat-msg-role">
                        {msg.role === 'user' ? '❯ 你' : msg.role === 'error' ? '⚠ 错误' : '● 助手'}
                        <span style={{ opacity: 0.5, marginLeft: 6 }}>
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    {/* Bubble / content */}
                    <div className="chat-msg-bubble">
                      {msg.role === 'system' ? (
                        <span>{msg.content}</span>
                      ) : msg.role === 'assistant' ? (
                        <MemoMessageContent
                          content={msg.content}
                          isStreaming={isStreaming && messages[messages.length - 1]?.id === msg.id}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap break-words">
                          {msg.content || <span className="text-[var(--text-faint)]">...</span>}
                        </span>
                      )}
                    </div>

                    {/* Actions row */}
                    {msg.role === 'user' && (
                      <div className="chat-msg-actions">
                        <button onClick={() => {
                          setInput(msg.content)
                          textareaRef.current?.focus()
                        }}>编辑</button>
                        <button onClick={() => {
                          setMessages(prev => {
                            const idx = prev.findIndex(m => m.id === msg.id)
                            if (idx >= 0) {
                              const next = [...prev]
                              if (idx < next.length - 1 && next[idx + 1]?.role === 'assistant') {
                                next.splice(idx, 2)
                              } else {
                                next.splice(idx, 1)
                              }
                              return next
                            }
                            return prev
                          })
                        }}>删除</button>
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="chat-msg-actions">
                        <button onClick={() => {
                          navigator.clipboard.writeText(msg.content).catch(() => {})
                        }}>复制</button>
                        <button onClick={async () => {
                          if (window.electronAPI?.chat?.executeCommand) {
                            const result = await window.electronAPI.chat.executeCommand('summarize', [])
                            if (result.success && result.output) {
                              setInput(result.output)
                              textareaRef.current?.focus()
                            }
                          }
                        }}>从此处开始总结</button>
                        <button onClick={() => {
                          setInput(msg.content)
                          textareaRef.current?.focus()
                        }}>编辑</button>
                        <button onClick={async () => {
                          if (window.electronAPI?.chat?.executeCommand) {
                            const result = await window.electronAPI.chat.executeCommand('regenerate', [])
                            if (result.success) {
                              setMessages(prev => {
                                const idx = prev.findIndex(m => m.id === msg.id)
                                if (idx >= 0) {
                                  const next = [...prev]
                                  next[idx] = { ...next[idx], content: '' }
                                  return next
                                }
                                return prev
                              })
                            }
                          }
                        }}>重新生成</button>
                        <button onClick={() => {
                          setMessages(prev => {
                            const idx = prev.findIndex(m => m.id === msg.id)
                            if (idx > 0 && prev[idx - 1]?.role === 'user') {
                              const next = [...prev]
                              next.splice(idx - 1, 2)
                              return next
                            }
                            return prev.filter(m => m.id !== msg.id)
                          })
                        }}>删除</button>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Scroll-to-bottom button */}
          {userScrolledUp && !isStreaming && messages.length > 0 && (
            <div className="flex justify-center -mt-8 mb-2 relative z-10">
              <button onClick={scrollToBottom} className="chat-scroll-down">
                ↓ 滚动到底部
              </button>
            </div>
          )}

          {/* ===== 输入区域 — 圆角胶囊 + 毛玻璃 ===== */}
          <div className="chat-input-area pb-3 pt-2 flex-shrink-0">
            <div className="chat-input-wrapper">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? 'AI 正在回复...' : (config.apiKey ? '输入消息... (Enter 发送, Shift+Enter 换行)' : '请先在下方配置 API Key...')}
                rows={1}
                autoFocus
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement
                  el.style.height = 'auto'
                  el.style.height = Math.min(120, el.scrollHeight) + 'px'
                }}
              />
              {isStreaming ? (
                <button
                  onClick={handleAbort}
                  className="chat-send-btn chat-send-btn-danger"
                >
                  中断
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="chat-send-btn chat-send-btn-primary"
                >
                  发送
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* 终端面板（底部抽屉浮层） */}
      {showTerminal && (
        <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-[var(--border)] bg-[#0a0a0a] flex flex-col" style={{ height: '45%' }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 flex-shrink-0">
            <span className="text-[var(--text-muted)] text-xs">终端</span>
            <button onClick={() => setShowTerminal(false)} className="text-[var(--text-muted)] text-xs hover:text-white">✕</button>
          </div>
          <pre
            ref={el => { if (el) el.scrollTop = el.scrollHeight }}
            className="flex-1 p-3 text-green-400 font-mono text-xs overflow-auto whitespace-pre-wrap"
          >{terminalOutput || '终端就绪...\n'}</pre>
          <div className="flex items-center border-t border-white/10 px-2 py-1.5 flex-shrink-0">
            <span className="text-green-400 mr-2 text-xs">$</span>
            <input
              value={terminalInput}
              onChange={e => setTerminalInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  const cmd = terminalInput.trim()
                  if (!cmd) return
                  setTerminalOutput(prev => prev + '$ ' + cmd + '\n')
                  setTerminalInput('')
                  handleTerminalCommand(cmd)
                }
              }}
              className="flex-1 bg-transparent text-green-400 font-mono text-xs outline-none"
              placeholder="输入命令..."
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  )
}

