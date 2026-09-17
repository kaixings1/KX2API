/**
 * pages/Chat/ChatPage.tsx — 单栏对话界面
 *
 * 设计原则：
 * - 无左中右三栏，只有一个对话区域
 * - 文件树和终端在对话中内嵌/折叠
 * - 最小化状态，避免死循环
 */

import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Components } from 'react-markdown'
import { FileTree } from './FileTree'
import { StreamParser, type ParsedTool, parseToolsFromText } from './streamParser'
import { PROMPT_GROUPS, defaultPromptGroups, buildPromptText, type PromptGroupsState } from './promptGroups'
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
  reasoning_content?: string
  tool_calls?: ParsedTool[]
  timestamp: number
  _deleted?: boolean
}

// ---------- helpers ----------

// ─── 工具调用「友好名称 → 功能描述」映射 ────────────────────────────────────────
// 用户期望：执行工具时显示「正在执行 + 功能简述」，而不是裸的 <tool>…</tool> / JSON 乱码。
const TOOL_FRIENDLY: Record<string, string> = {
  // 文件/目录（系统提示词声明的核心命令）
  ls: '列出目录文件',
  dir: '列出目录文件',
  cat: '读取文件内容',
  pwd: '显示当前工作目录',
  find: '查找文件',
  findstr: '在文件中搜索文本',
  grep: '搜索文件内容',
  tree: '展示目录树',
  echo: '输出文本',
  date: '显示当前日期时间',
  env: '显示环境变量',
  ps: '列出进程',
  where: '定位命令路径',
  // 版本控制
  'git-status': '查看 Git 状态',
  'git-diff': '查看 Git 差异',
  'git-branch': '查看 Git 分支',
  'git-log': '查看 Git 提交历史',
  memory: '管理记忆',
  config: '读取系统配置',
  // 文件读写/编辑工具
  read_file: '读取文件',
  readfile: '读取文件',
  get_file: '读取文件',
  write_file: '写入文件',
  edit_file: '编辑文件',
  edit: '编辑文件',
  glob: '文件匹配',
  // 常见 MCP / 自造工具名（映射到友好说明）
  'filesystem.list_directory': '列出目录文件',
  list_directory: '列出目录文件',
  local_list_directory: '列出目录文件',
  local_dir_list: '列出目录文件',
  'fs::list': '列出目录文件',
  'filesystem.read_file': '读取文件',
}

/** 归一化工具名 → 友好功能描述；未命中返回 null */
function describeTool(name: string): string | null {
  if (!name) return null
  const lower = name.toLowerCase()
  // 剥命名空间前缀后匹配末段（filesystem.list_directory → list_directory）
  const base = name.split(/[./:\\]+/).pop() ?? name
  const baseLower = base.toLowerCase()
  return TOOL_FRIENDLY[name] ?? TOOL_FRIENDLY[lower] ?? TOOL_FRIENDLY[base] ?? TOOL_FRIENDLY[baseLower] ?? null
}

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
  const isSuccess = !text.includes('error') && !text.includes('Error') && !text.includes('失败')

  // Format 0: search-result lines — "6: content", "85: content", "88: content"
  const lines = text.split('\n').filter(l => l.trim())
  const searchLineMatch = lines.find(l => /^\s*\d+:\s/.test(l))
  if (searchLineMatch) {
    return (
      <div className="claude-tool-result-search">
        <div className="claude-tool-result-line">
          <span className="claude-tool-result-prefix">⎿</span>
          <span className="claude-tool-result-text">
            {lines.length} 条匹配
          </span>
        </div>
        <div className="claude-tool-result-search-lines">
          {lines.slice(0, 20).map((line, i) => (
            <div key={i} className="claude-tool-result-search-line">{line}</div>
          ))}
          {lines.length > 20 && (
            <div className="claude-tool-result-search-more">... 还有 {lines.length - 20} 行</div>
          )}
        </div>
      </div>
    )
  }

  // Format 1: edit-style — "新增 N行，✗ 删除 N行" or "新增 N行，删除 N行"
  const addMatch = text.match(/(?:新增|added|inserted)\s*[:：]?\s*(\d+)\s*行/)
  const delMatch = text.match(/(?:删除|deleted|removed)\s*[:：]?\s*(\d+)\s*行/)
  if (addMatch || delMatch) {
    const parts: string[] = []
    if (addMatch) parts.push(`✓ 新增 ${addMatch[1]}行`)
    if (delMatch) parts.push(`✗ 删除 ${delMatch[1]}行`)
    return (
      <div className="claude-tool-result-line">
        <span className="claude-tool-result-prefix">⎿</span>
        <span className="claude-tool-result-text">
          {parts.join('，')}
        </span>
      </div>
    )
  }

  // Format 2: read-style — "读取 N 行" or extract N 行 from text
  const lineMatch = text.match(/(\d+)\s*行/) || text.match(/read\s+(\d+)\s*lines/i)
  const lineInfo = lineMatch ? lineMatch[1] : null
  const iconClass = isSuccess ? 'claude-tool-result-icon-success' : 'claude-tool-result-icon-error'

  return (
    <div className="claude-tool-result-line">
      <span className="claude-tool-result-prefix">⎿</span>
      <span className={iconClass}>{isSuccess ? '✓' : '✗'}</span>
      <span className="claude-tool-result-text">
        {lineInfo ? `读取 ${lineInfo} 行` : text.slice(0, 120) || '(空)'}
      </span>
    </div>
  )
}

// ─── 工具结果 JSON 识别与卡片化渲染 ────────────────────────────────────────
// 模型在部分链路上会直接把工具调用结果（成功/失败）以一段 JSON 包当正文回传，
// 例如 {"tool_call_id":"...","status":"failed","error":{...}}。
// 这里识别出这类"整段工具结果"，渲染成清晰的工具结果卡片，避免裸 JSON 堆积。

function isToolResultJson(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false
  let obj: unknown
  try {
    obj = JSON.parse(trimmed)
  } catch {
    return false
  }
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  // 仅当含明确的"工具结果/调用"信号时才是工具结果包；普通 JSON 数据体不误判
  const hasCall = 'tool_call_id' in o || 'tool_use_id' in o || 'toolCallId' in o
  const status = typeof o.status === 'string' ? o.status.toLowerCase() : ''
  const isStatus = ['success', 'failed', 'error', 'ok', 'failure'].includes(status)
  return hasCall || isStatus
}

function ToolResultCard({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  let obj: Record<string, unknown> = {}
  try {
    obj = JSON.parse(text.trim()) as Record<string, unknown>
  } catch {
    /* 保持原样 */
  }
  const status = typeof obj.status === 'string' ? obj.status.toLowerCase() : ''
  const isSuccess = ['success', 'ok'].includes(status)
  const isError = ['failed', 'error', 'failure'].includes(status)
  const err = obj.error && typeof obj.error === 'object'
    ? (obj.error as Record<string, unknown>)
    : null
  const errCode = err && typeof err.code === 'string' ? err.code as string : null
  const errMsg = err && (typeof err.message === 'string' ? err.message : '') as string
  const toolName = (obj.tool_name || obj.tool || obj.tool_call_id || '') as string

  const icon = isSuccess ? '✓' : isError ? '✗' : '…'
  const dotColor = isSuccess ? '#34d399' : isError ? '#f87171' : '#fbbf24'

  return (
    <div className="claude-tool-result-line" style={{ marginTop: 6 }}>
      <span className="claude-tool-result-prefix">⎿</span>
      <span style={{ color: dotColor, fontWeight: 700 }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="claude-tool-result-text" style={{ fontSize: 13 }}>
            {toolName ? String(toolName) : '工具调用'}
          </span>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-tertiary)', color: isError ? '#f87171' : isSuccess ? '#34d399' : 'var(--text-muted)', border: '1px solid var(--glass-border)', userSelect: 'none' }}>
            {status || 'result'}
          </span>
          {errCode && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', userSelect: 'none' }}>{String(errCode)}</span>}
        </div>
        {errMsg ? (
          <div className="claude-tool-result-text" style={{ color: isError ? '#fca5a5' : 'var(--text-dim)', marginTop: 2 }}>
            {errMsg}
          </div>
        ) : null}
        <button
          type="button"
          className="tool-json-toggle"
          onClick={() => setExpanded(p => !p)}
        >
          {expanded ? '收起 JSON' : '展开 JSON'}
        </button>
        {expanded && (
          <pre className="claude-tool-use-args-pre" style={{ marginTop: 6, maxHeight: 260 }}>
            <code>{JSON.stringify(obj, null, 2)}</code>
          </pre>
        )}
      </div>
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

const mdComponents: Partial<Components> & Record<string, any> = {
  code({ children, className }) {
    // 带语言标记（```js / ```ts）→ 块级代码块；否则是反引号行内 code（命令/动作短语），
    // 用橙色高亮，与「**标题**」的紫色区分。
    if (!/language-[\w-]+/.test(className || '')) {
      return (
        <code
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--glass-border)',
            borderRadius: 4,
            padding: '0 5px',
            fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", monospace',
            fontSize: '0.9em',
            fontWeight: 600,
            color: '#f59e0b',
          }}
        >{children}</code>
      )
    }
    return <CodeBlock className={className}>{children as string}</CodeBlock>
  },
  heading({ children, level }: { children?: React.ReactNode; level?: number }) {
    const depth = typeof level === 'number' ? level : 1
    const tag = `h${Math.min(depth, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    const cls = depth <= 6 ? `md-heading md-h${depth}` : 'md-heading md-h7'
    const Tag = tag
    return <Tag className={cls}>{children}</Tag>
  },
  // 「**文案**」当作主题强调：只上颜色，字号不加粗放大（宜作小标题）。
  strong({ children }) {
    return (
      <strong
        style={{
          color: 'var(--accent-primary, #c084fc)',
          whiteSpace: 'pre-wrap',
        }}
      >{children}</strong>
    )
  },
  em({ children }) {
    return (
      <em
        style={{
          color: 'var(--accent-primary, #c084fc)',
          fontStyle: 'italic',
        }}
      >{children}</em>
    )
  },
}

function hasMarkdown(text: string): boolean {
  // 与 ReactMarkdown 判定的口径对齐：标题（行内/行首均可）、GFM 表格、「**粗体**」、
  // 反引号代码、列表、引用、链接。避免把「### / 表格/列表」误当纯文本走 BodyText，
  // 否则会以原始 `|` 分隔符透出，造成格式错乱。
  return /#{1,6}\s/.test(text)               // 标题（任意位置，如「...：### 标题」）
    || /(?:^|\n)\s*\|.*\|[^|]*$/m.test(text)  // GFM 表格行
    || /\*\*[\s\S]*?\*\*/.test(text)          // 加粗
    || /`{1,3}[\s\S]*?`{1,3}/.test(text)      // 行内/块代码
    || /^\s*[-+*]\s/m.test(text)             // 无序列表
    || /^\s*>\s/m.test(text)                 // 引用
    || /^\s*\d+\.\s/m.test(text)             // 有序列表
    || /\[.+?\]\(.+?\)/.test(text)           // 链接
}

// diff 变更行：`-old`/`+new`（符号后紧跟非空白且长度 >= 3，区别于 markdown 标题 `## xxx` 等短行）。
// 判定需「有效 diff 行总数 >= 3 且同时存在 - 和 +」，避免把普通 `- 无序列表` / `## 标题` 误当成 diff。
function looksLikeDiff(text: string): boolean {
  const lines = text.split('\n')
  let minus = 0
  let plus = 0
  for (const l of lines) {
    const t = l.replace(/^\s+/, '')
    if (/^-(?=\S{2,})/.test(t)) minus++
    else if (/^\+(?=\S{2,})/.test(t)) plus++
  }
  return (minus + plus) >= 3 && minus > 0 && plus > 0
}

/** 是否用 ReactMarkdown 渲染：diff 文本直接走 BodyText 的 diff 高亮，避免被列表化/颜色丢失 */
function allowsMarkdown(text: string): boolean {
  return !looksLikeDiff(text) && hasMarkdown(text)
}

/**
 * 宽松列表预处理：许多模型输出的编号/符号列表项之间未留空行，
 * ReactMarkdown 会把后序「3. xxx」误并入前一条的续段导致编号消失。
 * 这里在相邻列表项之间补一个空行，使其各自成为独立列表项而保留编号。
 * 仅影响以 `数字. ` / `数字）` / `- ` / `* ` 开头的行，不触碰代码块/表格。
 */
function normalizeList(text: string): string {
  return text
    // 文本开头直接是标题（无前置换行）：补一个换行，让 ReactMarkdown 正确识别
    .replace(/^(#{1,6}\s)/m, '\n$1')
    .replace(/(\n)(\d+[.)])(\s+[^\s])/g, '\n\n$2$3')
    .replace(/(\n)([-*+])(\s+)(?=\S)/g, '\n\n$2$3')
    .replace(/(\n)(#{1,6}\s)/g, '\n\n$2')
}

/**
 * Merge two tool arrays, deduplicating by name + arguments.
 * Keeps unique tool calls, preserving order.
 */
function mergeTools(a: ParsedTool[], b: ParsedTool[]): ParsedTool[] {
  const seen = new Set<string>()
  const merged: ParsedTool[] = []
  for (const tool of [...a, ...b]) {
    // 按「工具名 + 参数」去重：同一调用在流式增量与 done 终态会各出现一次，
    // 需要合并；而同名不同参数的多次调用（如连续两次 write_file）必须都保留。
    // 参数不可序列化或为空时退化为按名字 + 序号占位，避免把它们误并成一条。
    let argKey: string
    try {
      argKey = JSON.stringify(tool.arguments ?? {})
    } catch {
      argKey = `#${merged.length}`
    }
    const key = `${tool.name}\u0000${argKey}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(tool)
    }
  }
  return merged
}

// ─── Reasoning Block (collapsible) ───────────────────────────────────────────

function ReasoningBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  return (
    <div className="reasoning-block">
      <div className="reasoning-header" onClick={() => setExpanded(p => !p)}>
        <span className="reasoning-icon">{expanded ? '🧠' : '🧠'}</span>
        <span className="reasoning-label">推理过程</span>
        <span className="reasoning-toggle">
          {expanded ? '收起' : '展开'}
        </span>
      </div>
      {expanded && (
        <div className="reasoning-body">
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.88em', lineHeight: 1.6, opacity: 0.8 }}>
            {text}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Tool Use Block (merged) ─────────────────────────────────────────────────

function ToolUseBlock({ tool }: { tool: ParsedTool }) {
  const [expanded, setExpanded] = useState(false)
  let parsedArgs: Record<string, unknown> | null = null
  try {
    parsedArgs = JSON.parse(tool.arguments)
  } catch {
    // leave as raw text
  }

  // Extract a human-readable call string, e.g. read("path") or bash("cmd")
  let callStr = tool.name
  let displayArgs = ''
  if (parsedArgs) {
    const parts: string[] = []
    if (parsedArgs.file_path) parts.push(parsedArgs.file_path as string)
    else if (parsedArgs.path) parts.push(parsedArgs.path as string)
    else if (parsedArgs.command) parts.push(parsedArgs.command as string)
    else if (parsedArgs.input) parts.push(typeof parsedArgs.input === 'string' ? parsedArgs.input : JSON.stringify(parsedArgs.input))
    else if (parsedArgs.query) parts.push(parsedArgs.query as string)
    if (parts.length > 0) {
      displayArgs = parts.map(p => '"' + String(p).replace(/"/g, '\\"').slice(0, 60) + '"').join(', ')
    }
  } else if (tool.arguments) {
    displayArgs = tool.arguments.slice(0, 80)
  }
  if (displayArgs) {
    callStr += '(' + displayArgs + ')'
  }

  const friendly = describeTool(tool.name)
  return (
    <div className="claude-tool-use-block">
      <div className="claude-tool-use-header" onClick={() => setExpanded(p => !p)}>
        <span className="claude-tool-use-bullet">●</span>
        <div className="claude-tool-use-name-wrap">
          <span className="claude-tool-use-name">{friendly ? `正在执行：${friendly}` : callStr}</span>
          {friendly && tool.name !== friendly && (
            <span className="claude-tool-use-sub">{tool.name}</span>
          )}
        </div>
        <span className="claude-tool-use-toggle">
          {expanded ? '收起' : '展开'}
        </span>
      </div>
      {expanded && (
        <div className="claude-tool-use-body">
          {parsedArgs ? (
            <pre className="claude-tool-use-args-pre">
              <code>{JSON.stringify(parsedArgs, null, 2)}</code>
            </pre>
          ) : (
            <pre className="claude-tool-use-args-pre">
              <code>{tool.arguments || '(无参数)'}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 识别「正文里嵌入的工具调用」并显示为友好「正在执行」块 ─────────────────────
// 模型有时把工具调用写成纯文本 JSON 工具包或 <tool_call> XML（而非结构化 tool_calls），
// 若直接原样渲染会显示成 <> 或裸 JSON 乱码。这里识别它们，折叠成「正在执行：功能」。
function extractToolInvocation(text: string): string | null {
  if (!text) return null
  // JSON 工具包：{"tool":"filesystem.list_directory","parameters":{...},"call_id":...}
  const jsonM = text.match(/"\s*tool\s*"\s*:\s*"([^"]+)"\s*,\s*"\s*(?:parameters|input|arguments)\s*"\s*:/)
  if (jsonM) return jsonM[1]
  // XML：<tool_call><toolName>...</toolName> 或 <toolName>...</toolName>
  const xmlM = text.match(/<(?:tool_call|toolname|tool_name)\s*>[\s\S]*?<\s*\/?\s*(?:toolCall|toolName|tool_name|tool_call)\s*>/i)
  if (xmlM) {
    const name = text.match(/<(?:tool_name|toolName)>\s*([^<\s]+)/i)
    if (name) return name[1]
  }
  return null
}

/** 工具调用友好块（折叠展示 + 隐藏原始 JSON/XML） */
function ToolInvocationInline({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const toolName = extractToolInvocation(text) ?? 'tool'
  const friendly = describeTool(toolName) ?? toolName
  return (
    <div className="claude-tool-use-block claude-tool-inline">
      <div className="claude-tool-use-header" onClick={() => setExpanded(p => !p)}>
        <span className="claude-tool-use-bullet">⚙</span>
        <div className="claude-tool-use-name-wrap">
          <span className="claude-tool-use-name">正在执行：{friendly}</span>
          {toolName !== friendly && <span className="claude-tool-use-sub">{toolName}</span>}
        </div>
        <span className="claude-tool-use-toggle">{expanded ? '收起' : '查看'}</span>
      </div>
      {expanded && (
        <div className="claude-tool-use-body">
          <pre className="claude-tool-use-args-pre"><code>{text}</code></pre>
        </div>
      )}
    </div>
  )
}

// ─── Message Content (main renderer) ─────────────────────────────────────────

function MessageContent({
  content,
  isStreaming,
  reasoning_content,
  tool_calls,
}: {
  content: string
  isStreaming: boolean
  reasoning_content?: string
  tool_calls?: ParsedTool[]
}) {
  const blocks = detectToolBlocks(content)
  const lastBlockIdx = blocks.length - 1

  const effectiveReasoning = reasoning_content || ''
  const hasReasoning = !isStreaming || effectiveReasoning.length > 0
  const effectiveTools = tool_calls || []

  return (
    <div>
      {/* Reasoning section — shown above content, collapsible */}
      {hasReasoning && (
        <ReasoningBlock text={effectiveReasoning} />
      )}

      {/* Tool use section — shown above content, merged */}
      {effectiveTools.length > 0 && (
        <div className="tool-uses-list">
          {effectiveTools.map((tool) => (
            <ToolUseBlock key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {/* Text content */}
      {blocks.map((block, i) => {
        if (block.type === 'tool-result') {
          return <ToolResultView key={i} text={block.text} />
        }
        const text = block.text
        if (!text) return null
        // 整段为「工具结果 JSON」时：流式期间（JSON 可能未闭合）仍先按文本渲染，
        // 结束后识别为工具结果卡片，避免裸 JSON 堆积
        if (!isStreaming && isToolResultJson(text)) {
          return <ToolResultCard key={i} text={text} />
        }
        // 识别「工具调用 JSON / XML 包」：显示为「正在执行」友好块，避免 <> / 裸 JSON 乱码
        if (!isStreaming && extractToolInvocation(text)) {
          return <ToolInvocationInline key={i} text={text} />
        }
        const showCursor = isStreaming && i === lastBlockIdx
        // During streaming: render as plain text for typewriter effect
        // After streaming: render full Markdown
        if (isStreaming) {
          return (
            <div key={i} className={`md-prose ${showCursor ? 'typing-cursor' : ''}`}>
              <BodyText text={text} />
            </div>
          )
        }
        return (
          <div key={i} className="md-prose">
            {allowsMarkdown(text) ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                {normalizeList(text)}
              </ReactMarkdown>
            ) : (
              <BodyText text={text} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

// ─── 正文美化：给「冒号前的短名」/ 关键词着色，并解析 **加粗** ────────────────
const BOLD_RE = /\*\*([^*\n]+)\*\*/
const CODE_RE = /`([^`\n]+)`/
// 行首（含缩进）的「标签: ·」——标签（中英文/数字/下划线/连字符/点/方括号，≤32字）着主题色加粗
const LINE_START_RE = /^(\s*)([\u4e00-\u9fa5A-Za-z0-9_\-.\[\]【】]{1,32})([：:]\s*)/

/**
 * 将一段纯文本正文逐行渲染：行首「标签:」着色加粗、**加粗**、行内 `code`。
 * 不改变原始换行与空白。仅在无 Markdown/非流式时使用。
 */
function BodyText({ text }: { text: string }) {
  const isDiff = looksLikeDiff(text)
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) {
      out.push(<span key={`nl${i}`} style={{ whiteSpace: 'pre-wrap' }}>{'\n'}</span>)
    }
    // diff 块整体着色：去掉开头的 +/- 符号做纯内容显示，行用红/绿底白字，其余行为正常正文
    if (isDiff) {
      const t = line.replace(/^\s+/, '')
      if (/^-[^-\s]/.test(t)) {
        out.push(
          <div key={`dl${i}`} style={{ background: 'rgba(239, 68, 68, 0.22)', color: '#fca5a5', padding: '0 6px', borderRadius: 4, fontFamily: '"SF Mono", "JetBrains Mono", monospace', fontSize: '0.9em', whiteSpace: 'pre-wrap' }}>
            {t.replace(/^-(?=\S)/, '− ')}
          </div>,
        )
        return
      }
      if (/^\+(?=\S)/.test(t)) {
        out.push(<div key={`dl${i}`} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#86efac', padding: '0 6px', borderRadius: 4, fontFamily: '"SF Mono", "JetBrains Mono", monospace', fontSize: '0.9em', whiteSpace: 'pre-wrap' }}>
          {t.replace(/^\+(?=\S)/, '+ ')}
        </div>)
        return
      }
      // 上下文行（@ 开头 hunk header 等）弱化
      if (/^@@/.test(t)) {
        out.push(<span key={`li${i}`} style={{ color: 'var(--text-faint)', fontFamily: '"SF Mono", "JetBrains Mono", monospace', fontSize: '0.88em', whiteSpace: 'pre-wrap' }}>{t}</span>)
        return
      }
      out.push(<span key={`li${i}`} style={{ color: 'var(--text-muted)' }}>{line}</span>)
      return
    }
    out.push(<span key={`li${i}`}>{renderHighlightedLine(line)}</span>)
  })
  return <>{out}</>
}

function renderHighlightedLine(line: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let rest = line
  let seq = 0

  const pushPlain = (t: string) => {
    if (!t) return
    nodes.push(<span key={seq++} style={{ whiteSpace: 'pre-wrap' }}>{t}</span>)
  }
  const pushBold = (t: string) => {
    nodes.push(
      <strong
        key={seq++}
        style={{
          color: 'var(--accent-primary, #c084fc)',
          whiteSpace: 'pre-wrap',
        }}
      >{t}</strong>,
    )
  }
  const pushCode = (t: string) => {
    nodes.push(
      <code
        key={seq++}
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--glass-border)',
          borderRadius: 4,
          padding: '0 5px',
          fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.9em',
          fontWeight: 600,
          color: '#f59e0b',
          whiteSpace: 'pre-wrap',
        }}
      >{t}</code>,
    )
  }

  // 1) 行首标签: 着色加粗
  const labelM = LINE_START_RE.exec(rest)
  if (labelM) {
    const indent = labelM[1]
    const name = labelM[2]
    const sep = labelM[3]
    pushPlain(indent)
    nodes.push(
      <span
        key={seq++}
        style={{
          color: 'var(--accent-primary, #c084fc)',
          fontWeight: 700,
          whiteSpace: 'pre-wrap',
        }}
      >{name}</span>,
    )
    nodes.push(
      <span key={seq++} style={{ color: 'var(--text-faint)', whiteSpace: 'pre-wrap' }}>{sep}</span>,
    )
    rest = rest.slice(labelM[0].length)
  }

  // 2) 其余部分：顺序消费 **加粗** 与 `code`
  while (rest.length > 0) {
    const bm = BOLD_RE.exec(rest)
    const cm = CODE_RE.exec(rest)
    let hit: RegExpExecArray | null = null
    let isBold = false
    if (bm && cm) {
      if (bm.index <= cm.index) { hit = bm; isBold = true }
      else hit = cm
    } else if (bm) { hit = bm; isBold = true }
    else hit = cm

    if (!hit) {
      pushPlain(rest)
      break
    }
    if (hit.index > 0) pushPlain(rest.slice(0, hit.index))
    if (isBold) pushBold(hit[1])
    else pushCode(hit[1])
    rest = rest.slice(hit.index + hit[0].length)
  }

  return nodes
}

const MemoMessageContent = memo(MessageContent)

// ─── Streaming parser instance ──────────────────────────────────────────────
const streamParserRef = new StreamParser()

// Memoized message row — only re-renders when its own content/role changes
const MessageRow = memo(function MessageRow({ msg, isStreaming, setInput, setMessages, textareaRef }: { msg: Message; isStreaming: boolean; setInput: (v: string) => void; setMessages: React.Dispatch<React.SetStateAction<Message[]>>; textareaRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const roleClass = msg.role === 'user'
    ? 'chat-msg-user'
    : msg.role === 'error'
      ? 'chat-msg-error'
      : msg.role === 'system'
        ? 'chat-msg-system'
        : 'chat-msg-assistant'
  return (
    <div className={roleClass}>
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
            isStreaming={isStreaming}
            reasoning_content={msg.reasoning_content}
            tool_calls={msg.tool_calls}
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
      {msg.role === 'error' && (
        <div className="chat-msg-actions">
          <button onClick={() => {
            setMessages(prev => {
              const idx = prev.findIndex(m => m.id === msg.id)
              if (idx >= 0) {
                const next = [...prev]
                next.splice(idx, 1)
                return next
              }
              return prev
            })
          }}>删除</button>
        </div>
      )}
    </div>
  )
})

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
  const [config, setConfig] = useState({ provider: 'openai', model: 'gpt-4o', apiKey: '', baseUrl: '', systemPrompt: '' })
  const [promptGroups, setPromptGroups] = useState<PromptGroupsState>(() => defaultPromptGroups())
  const [showConfig, setShowConfig] = useState(false)
  const [profiles, setProfiles] = useState<{ name: string; provider: string; baseUrl: string; model: string; active?: boolean }[]>([])
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null)
  const [useProxy, setUseProxy] = useState(false)
  const [directBaseUrl, setDirectBaseUrl] = useState('')
  const [proxyMode, setProxyMode] = useState<'standard' | 'proxy'>('standard')
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamStatusRef = useRef<'idle' | 'streaming'>('idle')
  const messagesRef = useRef<Message[]>([])

  // Streaming buffer: accumulates raw SSE chunks in ref, flushed via timer batch.
  // 用 setTimeout 而非 requestAnimationFrame：rAF 在窗口未聚焦/最小化/后台或无渲染帧时
  // 会被暂停，导致 buffer 迟迟不刷，界面看似「卡死」，等下次有帧才一次性吐出。
  const streamBufferRef = useRef<string>('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingMsgIdRef = useRef<string>('')

  // Refs to hold parsed streaming state (avoid re-render storms)
  const streamingReasoningRef = useRef<string>('')
  const streamingToolsRef = useRef<ParsedTool[]>([])

  // 同步 ref，避免 stale closure
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { streamStatusRef.current = isStreaming ? 'streaming' : 'idle' }, [isStreaming])

  // Cleanup flush timer on unmount
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    }
  }, [])

  // flush 累积的流式缓冲区到 React state（rAF 批处理）
  const flushStreamBuffer = useCallback(() => {
    const buf = streamBufferRef.current
    if (!buf) return
    streamBufferRef.current = ''
    const msgId = streamingMsgIdRef.current

    // 主进程送来的 response_chunk 是「纯文本增量」（responseHandler 的 text chunk），
    // 不是带 "content":"..." 的原始 SSE JSON 行。StreamParser 是按 SSE JSON 写的
    // （/\"content\"\s*:\s*\"(.*?)\"/g），拿纯文本去解析会匹配不到 → content 恒为空。
    // 因此「正文」直接用纯文本累积；StreamParser 仅用于从正文里提取 XML 工具块。
    // 注意：streamParser 是从 rawAccumulated 累积解析，必须 append 后再 parse 工具。
    streamParserRef.append(buf)
    const parsed = streamParserRef.parse()
    const parsedTools = parsed.tools
    if (parsed.reasoning) {
      streamingReasoningRef.current = parsed.reasoning
    }
    // 往前端消息追加纯文本正文（打字机效果）
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId)
      if (idx < 0) return prev
      const next = [...prev]
      const cur = next[idx] as Message
      // 同步累积到 ref：done 事件要拿它和终态解析结果合并，
      // 只在 setMessages 里累积会让 ref 恒为空，导致终态覆盖掉流式已识别的工具。
      const merged = parsedTools.length > 0
        ? mergeTools(streamingToolsRef.current, parsedTools)
        : streamingToolsRef.current
      streamingToolsRef.current = merged
      next[idx] = {
        ...cur,
        content: (cur.content || '') + buf,
        reasoning_content: streamingReasoningRef.current || cur.reasoning_content || '',
        tool_calls: merged,
      }
      return next
    })
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return
    // 用 setTimeout ~16ms（约 60fps）稳定触发；即时累积到一定量也立即刷，保证打字机节奏
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      flushStreamBuffer()
    }, 16)
  }, [flushStreamBuffer])

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
        if (typeof c?.systemPrompt === 'string') setConfig(prev => ({ ...prev, systemPrompt: c.systemPrompt as string }))
        if (c?.promptGroups && typeof c.promptGroups === 'object') {
          setPromptGroups(c.promptGroups as PromptGroupsState)
        }
      })
    }
    // 加载配置组列表
    if (window.electronAPI?.profiles?.getAll) {
      window.electronAPI.profiles.getAll().then((r: Record<string, unknown>) => {
        if (r.success && r.profiles) {
          const list = r.profiles as typeof profiles
          const activeName = r.activeProfile as string | null
          setProfiles(list)
          setActiveProfileName(activeName)
          // 记住当前配置组的直连地址，供「直连」模式切换使用
          const activeProfile = list.find(p => p.name === activeName)
          if (activeProfile?.baseUrl) setDirectBaseUrl(activeProfile.baseUrl)
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
          const mapped = history.messages.map((m: { role: string; content: string }, i: number) => {
            const tools = parseToolsFromText(m.content)
            return {
              id: `hist-${i}`,
              role: m.role as Message['role'],
              content: m.content,
              tool_calls: tools.length > 0 ? tools : [],
              timestamp: Date.now() - (history.messages.length - i) * 1000,
            }
          })
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
    const firstUser = messages.find(m => m.role === 'user')
    const title = firstUser?.content?.slice(0, 40) || '新对话'
    setConversations(prev => {
      const existing = prev.find(c => c.id === id)
      const conv: Conversation = {
        id,
        title: existing?.title || title,
        messages,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      }
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
        // 优先向引擎要真实命令列表（命令注册表是唯一数据源，避免这里手工维护一份过时的）
        if (window.electronAPI?.chat?.executeCommand) {
          try {
            const r = await window.electronAPI.chat.executeCommand('help', [])
            if (r.success && r.output) {
              appendSystemMessage(r.output)
              return
            }
          } catch { /* 落到下面的静态列表 */ }
        }
        const helpText = [
          'KX2Code 命令列表：',
          '',
          '**对话命令**：',
          '  /clear — 清空对话历史',
          '  /help — 显示此帮助',
          '  /new — 开始新对话',
          '',
          '**系统命令**：',
          '  /init — 扫描项目并生成/更新 CLAUDE.md',
          '  /config — 查看配置',
          '  /model <名称> — 切换模型',
          '  /stats — 使用统计',
          '  /team <任务> — 多角色协作',
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

    // Reset stream parser for fresh parse
    streamParserRef.reset()
    streamingReasoningRef.current = ''
    streamingToolsRef.current = []

    // 创建占位 assistant 消息
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning_content: '',
      tool_calls: [],
      timestamp: Date.now(),
    }] as Message[])

    streamingMsgIdRef.current = assistantId
    streamBufferRef.current = ''

    const cleanupChunk = window.electronAPI.chat.onStreamChunk(({ chunk }) => {
      // Accumulate in ref, flush via rAF (batched, smooth typewriter effect)
      streamBufferRef.current += chunk
      scheduleFlush()
    })

    const cleanupReasoning = window.electronAPI.chat.onStreamReasoning(({ reasoning }) => {
      // 逐段追加推理文本到当前 assistant 消息（实时可折叠预览）
      streamingReasoningRef.current += reasoning
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, reasoning_content: streamingReasoningRef.current } : m
      ))
    })

    // ─── 结构化工具事件 ───────────────────────────────────────────────────────
    // 主进程 chat-handlers.ts 一直通过 CHAT_STREAM_TOOL_START / TOOL_RESULT 下发结构化
    // tool_use 块，但此前 preload 未暴露订阅方法、渲染层也未订阅，导致模型以结构化
    // 工具块（而非正文文本）下发调用时，UI 完全看不到工具执行过程。
    // 这里按 toolUseId 维护一份权威列表，与正文解析出的工具调用在 done 阶段合并。
    const liveToolsRef = new Map<string, ParsedTool>()
    const syncStreamingTools = () => {
      streamingToolsRef.current = Array.from(liveToolsRef.values())
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, tool_calls: streamingToolsRef.current.slice() } : m
      ))
    }

    const cleanupToolStart = window.electronAPI.chat.onStreamToolStart(({ toolUseId, toolName, input }) => {
      let args = '{}'
      try {
        args = JSON.stringify(input ?? {})
      } catch {
        args = '{}'
      }
      liveToolsRef.set(toolUseId || `tool_${Date.now()}`, {
        id: toolUseId || `tool_${Date.now()}`,
        name: toolName,
        arguments: args,
        rawText: '',
      })
      syncStreamingTools()
    })

    const cleanupToolResult = window.electronAPI.chat.onStreamToolResult(({ toolUseId, toolName, success, output, error }) => {
      const existing = liveToolsRef.get(toolUseId)
      const resultText = success ? (output ?? '') : `[失败] ${error ?? output ?? ''}`
      if (existing) {
        // 原地更新：同一 toolUseId 的结果回填（不能走 mergeTools，它按 名称+参数 去重会丢弃更新）
        liveToolsRef.set(toolUseId, { ...existing, rawText: resultText })
      } else {
        liveToolsRef.set(toolUseId || `tool_${Date.now()}`, {
          id: toolUseId || `tool_${Date.now()}`,
          name: toolName,
          arguments: '{}',
          rawText: resultText,
        })
      }
      syncStreamingTools()
    })

    // 引擎请求用户确认：先把已缓冲的正文落盘，保持 streaming 态交由用户输入接管
    const cleanupNeedsUser = window.electronAPI.chat.onStreamNeedsUser(() => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      flushStreamBuffer()
    })

    // 请求被中断：复位 streaming 状态，否则输入框会一直锁在流式中
    const cleanupAborted = window.electronAPI.chat.onStreamAborted(() => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      flushStreamBuffer()
      setIsStreaming(false)
      streamStatusRef.current = 'idle'
      streamingMsgIdRef.current = ''
      cleanupChunk()
      cleanupDone()
      cleanupError()
      cleanupReasoning()
      cleanupToolStart()
      cleanupToolResult()
      cleanupNeedsUser()
      cleanupAborted()
    })

    const cleanupDone = window.electronAPI.chat.onStreamDone(({ content, toolOutput }) => {
      // Flush any remaining buffered content
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      // Final parse followed by immediate flush of residual buffer
      flushStreamBuffer()
      // Final parse of any remaining buffer
      streamParserRef.append(streamBufferRef.current)
      streamBufferRef.current = ''
      const finalParsed = streamParserRef.parse()

      // Merge streaming tools with any from final parse (dedup by name+args)
      const mergedTools = mergeTools(streamingToolsRef.current, finalParsed.tools)

      // 流式累积的正文是纯文本（已于 flush 阶段写入消息 content），主进程 done 事件
      // 的 content 是最终完整答复；取其中非空者，避免把已显示的正文覆盖为空。
      const finalReasoning = finalParsed.reasoning || streamingReasoningRef.current

      setMessages(prev => prev.map(m => {
        if (m.id !== assistantId) return m
        const streamingText = (m as Message).content || ''
        const doneContent = (typeof content === 'string' && content.trim())
          ? content
          : (toolOutput || '')
        return {
          ...m,
          content: doneContent || streamingText,
          reasoning_content: finalReasoning || '',
          tool_calls: mergedTools.length > 0 ? mergedTools : [],
        }
      }))
      setIsStreaming(false)
      streamStatusRef.current = 'idle'
      streamingMsgIdRef.current = ''
      streamingReasoningRef.current = ''
      streamingToolsRef.current = []
      cleanupChunk()
      cleanupDone()
      cleanupError()
      cleanupReasoning()
      cleanupToolStart()
      cleanupToolResult()
      cleanupNeedsUser()
      cleanupAborted()
    })

    const cleanupError = window.electronAPI.chat.onStreamError(({ error }) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      flushStreamBuffer()
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, role: 'error' as const, content: error } : m
      ))
      setIsStreaming(false)
      streamStatusRef.current = 'idle'
      streamingMsgIdRef.current = ''
      cleanupChunk()
      cleanupDone()
      cleanupError()
      cleanupReasoning()
    })

    try {
      const result = await window.electronAPI.chat.sendMessage(text)
      if (!result.success) {
        const errorMsg = result.error || '请求失败'
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, role: 'error' as const, content: errorMsg } : m
        ))
        setIsStreaming(false)
        streamStatusRef.current = 'idle'
        cleanupChunk()
        cleanupDone()
        cleanupError()
        cleanupReasoning()
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
      cleanupReasoning()
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
    // 先落盘当前会话，再开启一条全新的空会话
    setConversations(prev => {
      const next = prev.map(c =>
        c.id === currentConversationId ? { ...c, messages, updatedAt: Date.now() } : c
      )
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    setMessages([])
    setCurrentConversationId(null)
    setUserScrolledUp(false)
  }, [currentConversationId, messages])

  // 切换到一条已存在的对话：保存当前会话 → 载入目标会话
  const switchConversation = useCallback((id: string) => {
    setConversations(prev => {
      // 1) 先把当前会话的最新消息落盘
      const saved = prev.map(c =>
        c.id === currentConversationId ? { ...c, messages, updatedAt: Date.now() } : c
      )
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)) } catch { /* ignore */ }
      return saved
    })
    const target = conversations.find(c => c.id === id)
    if (!target) return
    setMessages(target.messages)
    setCurrentConversationId(target.id)
    setUserScrolledUp(false)
    setShowHistory(false)
  }, [conversations, currentConversationId, messages])

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    if (id === currentConversationId) {
      setMessages([])
      setCurrentConversationId(null)
    }
  }, [currentConversationId])

  const saveConfig = useCallback(async () => {
    // 传入完整 provider / model / apiKey / baseUrl，并保存到引擎 API 客户端，
    // 否则 baseUrl / apiKey / model 不会被实际用于请求。
    // Base URL 留空时按 provider 的官方地址补齐（而不是偷偷指向本地代理，
    // 否则代理没启动就会 ECONNREFUSED 127.0.0.1:8080）。代理模式请用模式开关。
    const PROVIDER_DEFAULT_BASE_URL: Record<string, string> = {
      openai: 'https://api.openai.com',
      anthropic: 'https://api.anthropic.com',
      custom: 'http://127.0.0.1:8080',
    }
    const baseUrl =
      (config.baseUrl || '').trim() ||
      PROVIDER_DEFAULT_BASE_URL[config.provider] ||
      'https://api.openai.com'
    // 合成提示词：显式 systemPrompt 为空时，用勾选分组合成片段
    const finalSystemPrompt = (config.systemPrompt || '').trim() || buildPromptText(promptGroups)
    if (window.electronAPI?.chat?.setConfig) {
      await window.electronAPI.chat.setConfig({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey || '',
        baseUrl,
        systemPrompt: finalSystemPrompt,
        promptGroups,
      })
    }
    // 持久化到一个固定、唯一冲突的配置页并激活它，这样重启/后下拉后仍保留，
    // 也避免下拉框因 active 被清空而重置回旧配置。upsert 内部会把 activePreset 设为该组。
    const persistName = '__dialog_config__'
    try {
      await window.electronAPI?.profiles?.upsert?.({
        name: persistName,
        provider: config.provider,
        baseUrl,
        apiKey: config.apiKey || '',
        model: config.model,
        systemPrompt: finalSystemPrompt,
        promptGroups,
      })
    } catch { /* ignore */ }
    // 刷新下拉列表并保持选中已保存的配置组
    if (window.electronAPI?.profiles?.getAll) {
      const r = await window.electronAPI.profiles.getAll() as Record<string, unknown>
      if (r.success && r.profiles) {
        setProfiles(r.profiles as typeof profiles)
        setActiveProfileName(r.activeProfile as string | null)
      }
    }
    // 同步本地直连地址，并关闭配置弹窗
    setDirectBaseUrl(baseUrl)
    setShowConfig(false)
    setActiveProfileName(persistName)
  }, [config])

  const handleProfileSwitch = useCallback(async (name: string) => {
    if (!window.electronAPI?.profiles?.setActive) return
    const result = await window.electronAPI.profiles.setActive(name)
    if (result.success && result.profile) {
      const p = result.profile as { provider: string; model: string; baseUrl: string; apiKey: string }
      setConfig({ provider: p.provider, model: p.model, apiKey: p.apiKey, baseUrl: p.baseUrl, systemPrompt: (p as Record<string, unknown>).systemPrompt as string || '' })
      setDirectBaseUrl(p.baseUrl)
      setProxyMode('standard')
      setActiveProfileName(name)
      const pg = (p as Record<string, unknown>).promptGroups
      if (pg && typeof pg === 'object') setPromptGroups(pg as PromptGroupsState)
    }
  }, [])

  // 判断最后一条消息是否是正在流式输出的 assistant
  const lastMsg = messages[messages.length - 1]
  const isLastAssistantStreaming = isStreaming && lastMsg?.role === 'assistant' && !lastMsg?.content

  return (
    <div className="flex flex-col h-[90vh] bg-[var(--bg-primary)]">
      {/* 顶部工具栏 */}
      <header className="flex items-center justify-between px-3 h-8 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(p => !p)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
            title="文件浏览器"
          >
            {showSidebar ? '◀' : '📁'}
          </button>
          <button
            onClick={() => setShowTerminal(p => !p)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
            title="终端"
          >
            {showTerminal ? '▼' : '⌨'}
          </button>
          {/* 配置弹窗 */}
          <Sheet open={showConfig} onOpenChange={setShowConfig}>
            <SheetTrigger asChild>
              <button
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
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
                <div className="flex flex-col gap-1.5">
                  <Label>自定义 System Prompt（可选，留空则用下方分组合成）</Label>
                  <textarea
                    value={config.systemPrompt}
                    onChange={e => setConfig(p => ({ ...p, systemPrompt: e.target.value }))}
                    placeholder="（留空时自动按勾选分组合成）"
                    rows={2}
                    className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text)] w-full resize-y"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>提示词分组（勾选后每轮合进 System Prompt，降低无效 token）</Label>
                  {PROMPT_GROUPS.map(g => {
                    const cfg = promptGroups[g.id] || { enabled: false, mandatoryItemIds: [], optionalItemIds: [] }
                    const toggleGroup = () => setPromptGroups(prev => ({
                      ...prev,
                      [g.id]: { ...cfg, enabled: !cfg.enabled },
                    }))
                    const toggleItem = (itemId: string, isMandatory: boolean) => {
                      setPromptGroups(prev => {
                        const cur = prev[g.id] || { enabled: true, mandatoryItemIds: [], optionalItemIds: [] }
                        const inMandatory = cur.mandatoryItemIds.includes(itemId)
                        const inOptional = cur.optionalItemIds.includes(itemId)
                        let mandatory = cur.mandatoryItemIds
                        let optional = cur.optionalItemIds
                        if (isMandatory) {
                          mandatory = inMandatory ? mandatory.filter(i => i !== itemId) : [...mandatory, itemId]
                        } else {
                          optional = inOptional ? optional.filter(i => i !== itemId) : [...optional, itemId]
                        }
                        return { ...prev, [g.id]: { ...cur, mandatoryItemIds: mandatory, optionalItemIds: optional } }
                      })
                    }
                    return (
                      <div key={g.id} className="border border-[var(--border)] rounded p-2">
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={cfg.enabled} onChange={toggleGroup} className="accent-[var(--accent)]" />
                          <span className="font-medium">{g.name}</span>
                          {g.description && <span className="text-[10px] text-[var(--muted)]">{g.description}</span>}
                        </label>
                        <div className="pl-5 mt-1 flex flex-col gap-0.5">
                          {g.items.map(item => {
                            const isMand = cfg.mandatoryItemIds.includes(item.id)
                            const isOpt = cfg.optionalItemIds.includes(item.id)
                            const checked = isMand || isOpt
                            return (
                              <label key={item.id} className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!cfg.enabled}
                                  onChange={() => toggleItem(item.id, isMand)}
                                  className="accent-[var(--accent)]"
                                />
                                <span>{item.label}</span>
                                <span className="text-[10px] text-[var(--muted)]">{item.mandatory ? '· 必发' : ''}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
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
                // 本地代理只提供 OpenAI 兼容协议，provider 固定为 openai；
                // model / apiKey 由主进程沿用当前值（不会被打回默认）。
                window.electronAPI.chat.setConfig({ provider: 'openai', baseUrl: 'http://127.0.0.1:8080' })
              } else {
                // 直连：恢复当前配置组自己的 provider / model / apiKey / baseUrl
                window.electronAPI.chat.setConfig({
                  provider: config.provider,
                  model: config.model,
                  apiKey: config.apiKey,
                  baseUrl: directBaseUrl || config.baseUrl,
                })
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
            onClick={() => setShowHistory(p => !p)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
            title={showHistory ? '隐藏对话列表' : '显示对话列表'}
          >
            ☰
          </button>
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
        {/* 可折叠侧边栏：对话列表 */}
        {showHistory && (
          <aside className="w-56 border-r border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0 flex flex-col">
            <div className="flex items-center justify-between p-2 border-b border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">对话列表</span>
              <button
                onClick={handleNewChat}
                className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
                title="新建对话"
              >
                + 新对话
              </button>
            </div>
            <div className="flex-1 overflow-auto py-1">
              {conversations.length === 0 ? (
                <div className="px-3 py-4 text-xs text-[var(--text-faint)] text-center">暂无历史对话</div>
              ) : (
                conversations.map(c => {
                  const isActive = c.id === currentConversationId
                  return (
                    <div
                      key={c.id}
                      onClick={() => switchConversation(c.id)}
                      className={`group flex items-center gap-1 mx-1 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                        isActive ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]'
                      }`}
                      title={c.title}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs truncate ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                          {c.title || '新对话'}
                        </div>
                        <div className="text-[10px] text-[var(--text-faint)] truncate">
                          {formatTime(c.updatedAt)} · {c.messages.length} 条
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteConversation(c.id) }}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--text-muted)] hover:text-red-400 flex-shrink-0 px-1"
                        title="删除对话"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </aside>
        )}

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
              <div className="w-full px-3 py-4">
                {messages.map((msg) => (
                  <MessageRow
                    key={msg.id}
                    msg={msg}
                    isStreaming={isStreaming && messages[messages.length - 1]?.id === msg.id}
                    setInput={setInput}
                    setMessages={setMessages}
                    textareaRef={textareaRef}
                  />
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
          <div className="w-full pb-3 pt-2 flex-shrink-0">
            <div className="chat-input-wrapper">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? 'AI 正在回复...' : (config.apiKey ? '输入消息... (Enter 发送, Shift+Enter 换行)' : '请先在下方配置 API Key...')}
                rows={3}
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
            <button onClick={() => setShowTerminal(false)} className="text-[var(--text-muted)] text-xs hover:text-[var(--text-primary)]">✕</button>
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

