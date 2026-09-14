/**
 * main/engine-bridge.ts — 桥接引擎和主进程
 *
 * 职责：
 * - 初始化 KX2Code 完整 QueryEngine
 * - 加载命令注册表
 * - 同步工具到 ToolCollection
 * - 开发模式工具验证
 * - 通过 IPC handlers.ts 暴露功能给渲染层
 */

import { BrowserWindow } from 'electron'
import { QueryEngine, type EngineOptions, type Tool } from '../engine/index.ts'
import { commandRegistry } from '../engine/commands/registry'
import { importCommands } from '../engine/commands/importer'
import { registerChatHandlers } from './ipc/chat-handlers'
import { ProfileManager } from './profiles/manager'
import { syncProfileApiKey } from './store/apiKeySync'
import { toolCollection } from './proxy/tools/toolCollection'
import { toolPluginRegistry, type ToolPlugin } from '../engine/plugin/toolPluginRegistry.ts'
import { allLegacyToolPlugins, coreToolPlugins, advancedToolPlugins } from '../engine/plugin/legacyToolPlugins.ts'
import { ConfigManager } from './store/config'
import { sendMessageStream, type ApiConfig } from '../engine/api/client.ts'

/** 注册并加载启用的旧版工具插件，返回工具 Map */
async function loadLegacyPluginTools(): Promise<Map<string, Tool> | null> {
  // 先注册所有插件定义（注册表本身不执行加载）
  toolPluginRegistry.registerAll(allLegacyToolPlugins)

  // 从 store 读取用户勾选的启用插件列表
  const enabledPlugins = getEnabledPluginsFromStore()
  if (enabledPlugins.length > 0) {
    toolPluginRegistry.enableMany(enabledPlugins)
  }

  const tools = await toolPluginRegistry.loadEagerPlugins()
  if (tools.length === 0) return null
  const map = new Map<string, Tool>()
  for (const t of tools) map.set(t.name, t)
  return map
}

/** 从 store 读取启用的插件 ID 列表
 * @param configGetter - 可选的配置读取函数，用于测试注入
 */
export function getEnabledPluginsFromStore(configGetter?: () => Record<string, unknown>): string[] {
  const getConfig = configGetter || (() => ConfigManager.get())
  try {
    const config = getConfig()
    if (Array.isArray(config.enabledPlugins) && config.enabledPlugins.length > 0) {
      // 只保留实际存在的插件 ID
      const validIds = new Set(allLegacyToolPlugins.map(p => p.id))
      return config.enabledPlugins.filter(id => validIds.has(id))
    }
    // 空数组时回退到默认启用列表
    return allLegacyToolPlugins.filter(p => p.enabledByDefault).map(p => p.id)
  } catch {
    // 读取失败时回退到默认启用列表
    return allLegacyToolPlugins.filter(p => p.enabledByDefault).map(p => p.id)
  }
}

let engine: QueryEngine | null = null
let engineReady = false
let engineError: string | null = null

/**
 * 将 sendMessageStream 的回调式 SSE 流转换为 MessageLoop 所需的 AsyncIterable<unknown> 事件流
 */
function createApiClientStream(
  provider: string,
  apiKey: string,
  model: string,
  baseUrl?: string,
): (req: unknown) => Promise<AsyncIterable<unknown>> {
  return async (request: unknown): Promise<AsyncIterable<unknown>> => {
    const messages = (request as Record<string, unknown>).messages as Array<Record<string, unknown>>

    const events: unknown[] = []
    let fullText = ''
    // 当前文本块的索引。StreamProcessor 用 delta.index 与 content_block_stop.index
    // 对应来按块聚合文本，因此每个内容块占用一个递增的 index。
    let blockIndex = 0
    let textBlockOpen = false
    // 独立的推理块索引（与文本块共用递增 index，但用额外标志区分类型）
    let reasonBlockOpen = false

    // StreamProcessor(streaming/streamProcessor.ts) 在 content_block_start 读取的字段是
    // event.content_block；旧代码写成 event.block，导致该值为空、process() 抛
    // "reading 'input'" 异常，且文本块缺 start/stop 会使所有文本 delta 被 processDelta 丢弃，
    // 最终页面 contentLen=0 无任何反馈。
    const closeTextBlock = (): void => {
      if (!textBlockOpen) return
      events.push({ type: 'content_block_stop', index: blockIndex })
      blockIndex++
      textBlockOpen = false
    }
    const ensureTextBlock = (): void => {
      if (textBlockOpen) return
      events.push({ type: 'content_block_start', index: blockIndex, content_block: { type: 'text' } })
      textBlockOpen = true
    }
    const closeReasonBlock = (): void => {
      if (!reasonBlockOpen) return
      events.push({ type: 'content_block_stop', index: blockIndex })
      blockIndex++
      reasonBlockOpen = false
    }
    const ensureReasonBlock = (): void => {
      if (reasonBlockOpen) return
      if (textBlockOpen) return // 推理块与文本块互斥，避免共享 index 冲突
      events.push({ type: 'content_block_start', index: blockIndex, content_block: { type: 'thinking' } })
      reasonBlockOpen = true
    }

    await sendMessageStream(
      { provider: provider as ApiConfig['provider'], apiKey, model, baseUrl },
      messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      {
        onText: (text: string) => {
          fullText += text
          ensureTextBlock()
          events.push({ type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text } })
        },
        onReasoning: (text: string) => {
          ensureReasonBlock()
          events.push({ type: 'content_block_delta', index: blockIndex, delta: { type: 'thinking_delta', text } })
        },
        onToolUse: (block) => {
          // 工具已由 sendMessageStream 内的多轮循环自行执行并将结果喂回，
          // 这里仅记录日志，不向 MessageLoop 推送 tool_use 事件，避免引擎
          // 对该工具重复执行。文本流会正常聚合并返回给前端展示。
          closeTextBlock()
          closeReasonBlock()
          console.log(`[EngineBridge][API] tool executed by client: /${block.name} len=${fullText.length}`)
        },
        onDone: () => {
          closeTextBlock()
          closeReasonBlock()
          events.push({ type: 'message_stop' })
          events.push({ type: 'message_delta', stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: fullText.length } })
        },
        onError: (error: string) => {
          events.push({ type: 'error', error })
        },
      },
    )

    // 如果没有事件（异常被 catch），至少发出 done
    if (events.length === 0) {
      events.push({ type: 'message_stop' })
      events.push({ type: 'message_delta', stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 } })
    }

    async function* generator() {
      for (const event of events) {
        yield event
      }
    }

    return generator()
  }
}

export async function initEngineBridge(_mainWindow: BrowserWindow | null): Promise<void> {
  try {
    const pm = new ProfileManager()
    const active = pm.getActive()

    // 从工具定义自动生成技能分类（工具即技能）
    const skillCategories = new Map<string, Array<{ name: string; description: string; category?: string }>>()
    const categorizeTool = (toolName: string): string => {
      const fileTools = ['read_file', 'write_file', 'edit', 'glob', 'grep', 'ls', 'dir', 'find', 'findstr', 'cat']
      const shellTools = ['bash', 'shell', 'command', 'terminal', 'powershell']
      const webTools = ['web_search', 'web_fetch', 'http']
      const gitTools = ['git', 'branch', 'commit', 'diff', 'log']
      const systemTools = ['system', 'process', 'env', 'config']
      const lower = toolName.toLowerCase()
      if (fileTools.some(t => lower.includes(t))) return '文件操作'
      if (shellTools.some(t => lower.includes(t))) return '终端命令'
      if (webTools.some(t => lower.includes(t))) return '网络工具'
      if (gitTools.some(t => lower.includes(t))) return '版本控制'
      if (systemTools.some(t => lower.includes(t))) return '系统管理'
      return '通用工具'
    }
    // 预留：后续可从 profiles 或 .doge 配置中读取用户自定义技能/智能体
    const skills: Array<{ name: string; description: string; category?: string }> = []
    const agents: Array<{ name: string; description: string; model?: string }> = []
    const subagents: Array<{ name: string; description: string }> = []

    if (active) {
      const opts: EngineOptions = {
        model: active.model || 'gpt-4o',
        provider: active.provider || 'openai',
        maxOutputTokens: 4096,
        systemPrompt: '你是 KX2Code，一个智能编程助手。你可以使用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。',
        skills,
        agents,
        subagents,
      }
      engine = new QueryEngine(opts)
      console.log('[EngineBridge] Active profile:', active.name, 'provider:', opts.provider, 'baseUrl:', active.baseUrl, 'model:', opts.model)

      // 注入真实 API 客户端（将 sendMessageStream 桥接为 MessageLoop 所需的 AsyncIterable）
      engine.setApiClient({
        sendMessage: createApiClientStream(opts.provider!, active.apiKey || '', opts.model!, active.baseUrl),
      })

      // 同步 apiKey 到代理认证列表（统一使用 apiKeySync 工具）
      syncProfileApiKey(active)
    } else {
      engine = new QueryEngine({
        model: 'gpt-4o',
        provider: 'openai',
        maxOutputTokens: 4096,
        systemPrompt: '你是 KX2Code，一个智能编程助手。你可以使用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。',
        skills,
        agents,
        subagents,
      })
      console.log('[EngineBridge] No active profile, using defaults')

      // 注入默认 API 客户端
      engine.setApiClient({
        sendMessage: createApiClientStream('openai', '', 'gpt-4o'),
      })
    }

    const commandCount = await importCommands()

    // 加载用户勾选的工具插件
    const pluginTools = await loadLegacyPluginTools()
    console.log('[EngineBridge] Plugins loaded:', pluginTools ? Array.from(pluginTools.keys()).join(', ') : 'none')

    // 同步命令到 ToolCollection，确保工具系统与注册表一致
    await toolCollection.syncFromRegistry()
    engineReady = true
    console.log('[EngineBridge] Engine initialized, commands loaded:', commandCount, 'tools synced:', toolCollection.getToolNames().length)

    // 开发模式：启动时自动验证工具调用链路
    if (process.env.NODE_ENV === 'development') {
      console.log('[EngineBridge] Dev mode detected, running tool verification...')
      runDirectToolTests().then((results) => {
        console.log(`[EngineBridge] Tool verification: ${results.passed}/${results.total} passed`)
      }).catch((err) => {
        console.log('[EngineBridge] Tool verification failed:', err)
      })
    }
  } catch (e) {
    engineError = (e as Error).message
    console.log('[EngineBridge] Engine initialization failed:', engineError)
  }
}

/** 获取引擎实例（供 IPC handlers 使用） */
export function getEngineInstance(): QueryEngine | null {
  return engine
}

/**
 * 用新的 provider / model / apiKey / baseUrl 重建引擎的 API 客户端。
 * engine.updateConfig() 不会更新 baseUrl / apiKey，也不会重建 sendMessage 闭包，
 * 所以这里必须重新 setApiClient，否则对话配置里保存的地址永不变更。
 */
export function updateEngineApiClient(opts: {
  provider?: string; model?: string; apiKey?: string; baseUrl?: string
}): boolean {
  const eng = getEngineInstance()
  if (!eng) return false
  const provider = (opts.provider || 'openai') as 'openai' | 'anthropic' | 'custom'
  const model = opts.model || 'gpt-4o'
  const baseUrl = opts.baseUrl
  const apiKey = opts.apiKey || ''
  eng.updateConfig({ provider: provider as 'openai' | 'anthropic', model })
  eng.setApiClient({
    sendMessage: createApiClientStream(provider, apiKey, model, baseUrl),
  })
  console.log('[EngineBridge] API client rebuilt with provider=', provider, 'model=', model, 'baseUrl=', baseUrl || 'fallback')
  return true
}

/** 检查引擎是否就绪 */
export function isEngineReady(): boolean {
  return engineReady && engine !== null
}

/**
 * 直接模拟 tool_call 数据包执行测试
 * 构造 { name, input } 的工具调用格式，直接走 executeLocalTool → 命令注册表 → 本地执行
 * 不经过 LLM API，纯本地解析执行
 */
async function runDirectToolTests(): Promise<{ passed: number; failed: number; total: number }> {
  const { executeLocalTool } = await import('../engine/api/client')

  const tests: Array<{ name: string; args: string[]; desc: string }> = [
    { name: 'pwd',    args: [],                      desc: '当前目录' },
    { name: 'ls',     args: [],                      desc: '列出当前目录' },
    { name: 'dir',    args: [],                      desc: 'Windows 风格目录列表' },
    { name: 'date',   args: [],                      desc: '当前日期时间' },
    { name: 'cat',    args: ['package.json'],        desc: '读取 package.json' },
    { name: 'grep',   args: ['name', 'package.json'],desc: 'grep 搜索' },
    { name: 'find',   args: ['package.json'],        desc: '查找文件' },
    { name: 'findstr',args: ['electron', 'package.json'], desc: 'findstr 搜索' },
    { name: 'where',  args: ['node'],                desc: '查找 node 路径' },
    { name: 'python', args: ['import sys; print(sys.version)'], desc: 'Python 版本' },
  ]

  console.log('[ToolTest] Starting direct tool execution tests, total:', tests.length)
  let passed = 0
  let failed = 0

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i]
    console.log(`\n[ToolTest] ${i + 1}/${tests.length}: /${t.name} — ${t.desc}`)
    console.log(`[ToolTest]   args: [${t.args.map(a => JSON.stringify(a)).join(', ')}]`)
    try {
      const result = await executeLocalTool(t.name, t.args)
      const output = result.output?.trim()
      if (output && !output.includes('错误') && !output.includes('Error')) {
        console.log(`[ToolTest]   PASS: ${output.slice(0, 200)}`)
        passed++
      } else {
        console.log(`[ToolTest]   FAIL: ${output?.slice(0, 200) || '(no output)'}`)
        failed++
      }
    } catch (e) {
      console.error(`[ToolTest]   ERROR:`, (e as Error).message)
      failed++
    }
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n[ToolTest] ===== Results: ${passed} passed, ${failed} failed, total ${tests.length} =====`)
  return { passed, failed, total: tests.length }
}
