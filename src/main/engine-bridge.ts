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
 * 最近一次真正生效的 API 连接参数。
 * updateEngineApiClient 允许只传部分字段（例如切模式时只改 baseUrl），
 * 未传入的字段必须从这里补齐，否则 provider/model/apiKey 会被重置成默认值，
 * 表现为「切一次代理模式后直连就不带 key / 模型被打回 gpt-4o」。
 */
let lastApiSettings: { provider: string; model: string; apiKey: string; baseUrl?: string } = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: '',
  baseUrl: undefined,
}

/** 引擎实际使用的 API 连接参数 */
export interface ApiSettings {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
}

/**
 * 合并一次局部更新：未传入的字段沿用 previous。
 * apiKey / baseUrl 用 !== undefined 判断，因为显式传空串 = 「真的没有」；
 * provider / model 为空时沿用旧值，避免被打成默认值。
 */
/** Provider 支持模型白名单（空数组 = 不限制） */
const PROVIDER_MODEL_WHITELIST: Record<string, string[]> = {
  stepfun: [
    'step-1-8k', 'step-1-32k', 'step-1-128k', 'step-1-256k',
    'step-1o-mini', 'step-1o-turbo', 'step-1o-128k',
    'step-2-mini', 'step-2-turbo', 'step-2-16k',
    'step-3-mini-128k', 'step-3-turbo-128k', 'step-3-flash-128k',
    'step-3.7-mini', 'step-3.7-turbo', 'step-3.7-max', 'step-3.7-flash',
    'step-fun-vision', 'step-auto',
  ],
}

/**
 * 当 provider 和 model 不匹配时，自动映射到该 provider 的默认模型。
 * 避免将 OpenAI 模型（如 gpt-4o）发送到 StepFun 等不支持该模型的 API。
 */
function resolveModelForProvider(provider: string, model: string, baseUrl?: string): string {
  const lowerProvider = provider.toLowerCase()
  const whitelist = PROVIDER_MODEL_WHITELIST[lowerProvider]
  if (!whitelist || whitelist.length === 0) return model
  if (whitelist.includes(model)) return model
  // 模型不在白名单中，映射到该 provider 的默认模型
  const fallback = whitelist[0]
  console.log(`[EngineBridge] Model "${model}" not supported by provider "${provider}", mapped to "${fallback}"`)
  return fallback
}

export function mergeApiSettings(
  previous: ApiSettings,
  opts: { provider?: string; model?: string; apiKey?: string; baseUrl?: string },
): ApiSettings {
  return {
    provider: opts.provider || previous.provider || 'openai',
    model: opts.model || previous.model || 'gpt-4o',
    apiKey: opts.apiKey !== undefined ? opts.apiKey : previous.apiKey,
    baseUrl: opts.baseUrl !== undefined ? opts.baseUrl : previous.baseUrl,
  }
}

/** 读取当前生效的 API 连接参数（供 UI / 日志排查用） */
export function getEngineApiSettings(): ApiSettings {
  return { ...lastApiSettings }
}

/**
 * 将 sendMessageStream 的回调式 SSE 流转换为 MessageLoop 所需的 AsyncIterable<unknown> 事件流
 */
function createApiClientStream(
  provider: string,
  apiKey: string,
  model: string,
  baseUrl?: string,
  enabledToolGroups: string[] = [],
): (req: unknown) => Promise<AsyncIterable<unknown>> {
  // 校验并修正 model-provider 不匹配
  const resolvedModel = resolveModelForProvider(provider, model, baseUrl)
  // 仅记录关键参数，避免日志过长
  console.log('[EngineBridge] createApiClientStream provider=', provider, 'model=', resolvedModel, 'baseUrl=', baseUrl || 'fallback', 'toolGroups=', enabledToolGroups.length === 0 ? 'all' : enabledToolGroups.join(','))
  return async (request: unknown): Promise<AsyncIterable<unknown>> => {
    const messages = (request as Record<string, unknown>).messages as Array<Record<string, unknown>>

    const queue: unknown[] = []
    let streamEnded = false
    let waiters: (() => void)[] = []
    const pushEvent = (ev: unknown): void => {
      queue.push(ev)
      if (waiters.length > 0) {
        const w = waiters
        waiters = []
        for (const r of w) r()
      }
    }
    const signalEnd = (): void => {
      streamEnded = true
      if (waiters.length > 0) {
        const w = waiters
        waiters = []
        for (const r of w) r()
      }
    }
    const waitPush = (): Promise<void> => new Promise<void>(resolve => waiters.push(resolve))
    const events: unknown[] = queue
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
      pushEvent({ type: 'content_block_stop', index: blockIndex })
      blockIndex++
      textBlockOpen = false
    }
    const ensureTextBlock = (): void => {
      if (textBlockOpen) return
      pushEvent({ type: 'content_block_start', index: blockIndex, content_block: { type: 'text' } })
      textBlockOpen = true
    }
    const closeReasonBlock = (): void => {
      if (!reasonBlockOpen) return
      pushEvent({ type: 'content_block_stop', index: blockIndex })
      blockIndex++
      reasonBlockOpen = false
    }
    const ensureReasonBlock = (): void => {
      if (reasonBlockOpen) return
      if (textBlockOpen) return // 推理块与文本块互斥，避免共享 index 冲突
      pushEvent({ type: 'content_block_start', index: blockIndex, content_block: { type: 'thinking' } })
      reasonBlockOpen = true
    }

    // 后台启动发送（不 await 阻塞），回调实时 push 进队列，实现流式输出
    const sendResult = sendMessageStream(
      {
        provider: provider as ApiConfig['provider'],
        apiKey,
        model: resolvedModel,
        baseUrl,
        maxToolRounds: 5,
        maxRepeat: 3,
        enabledToolGroups,
      },
      messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      {
        onText: (text: string) => {
          fullText += text
          ensureTextBlock()
          pushEvent({ type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text } })
        },
        onReasoning: (text: string) => {
          ensureReasonBlock()
          pushEvent({ type: 'content_block_delta', index: blockIndex, delta: { type: 'thinking_delta', text } })
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
          pushEvent({ type: 'message_stop' })
          pushEvent({ type: 'message_delta', stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: fullText.length } })
          signalEnd()
        },
        onError: (error: string) => {
          pushEvent({ type: 'error', error })
          signalEnd()
        },
      },
    )
    // 捕获 sendMessageStream 内部异常，避免未处理的 rejection；正常结束时无需额外处理
    void sendResult.catch((e) => {
      console.error('[EngineBridge][API] sendMessageStream rejected:', (e as Error)?.message || e)
      pushEvent({ type: 'error', error: (e as Error)?.message || '请求失败' })
    })

    async function* generator(): AsyncGenerator<unknown, void, unknown> {
      let ended = false
      const terminal = (): void => {
        if (ended) return
        ended = true
        pushEvent({ type: 'message_stop' })
        pushEvent({ type: 'message_delta', stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: fullText.length } })
        signalEnd()
      }
      try {
        while (true) {
          while (queue.length > 0) {
            yield queue.shift()
          }
          if (streamEnded) {
            terminal()
            return
          }
          await waitPush()
        }
      } catch (e) {
        // 消费者提前终止（如上层结束循环）时，兜底结束，避免悬挂
        terminal()
        throw e
      } finally {
        // 确保后台 Promise 不被悬挂
        await sendResult.catch(() => {})
      }
    }

    return generator()
  }
}

/**
 * 基础系统提示词（默认）：
 * 在既有「你是 KX2Code」文案之后，追加 XML 工具调用协议说明，引导模型输出
 * 可被系统解析的标准工具调用（避免模型自造工具名导致无法执行）。
 */
export const BASE_SYSTEM_PROMPT =
  '你是 KX2Code，一个智能编程助手。你可以使用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。\n\n' +
  '【排版规范】\n' +
  '当你汇报目录、文件列表或命令输出时，必须遵守：\n' +
  '1. 列表用标准 Markdown，一个文件/目录单独一项（"- " 或 "1. "），项与项之间换行，绝不写在同一行。\n' +
  '2. 禁止添加“复制”、“、”、“：”等与内容无关的符号，不要把列表塞进 \'复制\' 代码块——代码块只用于真正的代码片段。（“``` 文件：a.ts、b.ts、c.ts ```” 是错的，应写成 “- a.ts 换行 - b.ts 换行 - c.ts”）。\n' +
  '3. 有多个分组（如源代码/构建输出/配置文件）时用 Markdown 标题（## / ###）分组，组内用列表。\n\n' +
  '【工具调用协议】\n' +
  '当你需要执行操作（如读取文件、运行命令、搜索目录）时，请输出如下格式的标准工具调用 XML，不要写成正文：\n' +
  '<tool_call>\n  <toolName>ls</toolName>\n  <arguments><path>.</path><showHidden>false</showHidden></arguments>\n</tool_call>\n' +
  '可用工具名（务必使用这些确切名字，勿自造）：pwd、ls、dir、find、findstr、grep、cat、tree、echo、date、env、ps、where、git-status、git-diff、git-branch、git-log、memory、config。\n' +
  '参数用 <key>value</key> 子标签形式；无参数的命令可省略 arguments。禁止把工具调用作为普通正文输出，系统会识别并执行它。'

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
      const defaultSystem = BASE_SYSTEM_PROMPT
      const composed = composeSystemPrompt(active.systemPrompt, active.promptGroups)
      const opts: EngineOptions = {
        model: active.model || 'gpt-4o',
        provider: active.provider || 'openai',
        maxOutputTokens: 4096,
        systemPrompt: composed || defaultSystem,
        skills,
        agents,
        subagents,
      }
      engine = new QueryEngine(opts)
      console.log('[EngineBridge] Active profile:', active.name, 'provider:', opts.provider, 'baseUrl:', active.baseUrl, 'model:', opts.model)

      // 收集启用的工具分组（Profile → AppConfig → 默认全量）
      const enabledToolGroups = (active as any).enabledToolGroups
        ?? ConfigManager.get().enabledToolGroups
        ?? []

      // 注入真实 API 客户端（将 sendMessageStream 桥接为 MessageLoop 所需的 AsyncIterable）
      engine.setApiClient({
        sendMessage: createApiClientStream(opts.provider!, active.apiKey || '', opts.model!, active.baseUrl, enabledToolGroups),
      })
      lastApiSettings = {
        provider: opts.provider!,
        model: opts.model!,
        apiKey: active.apiKey || '',
        baseUrl: active.baseUrl,
      }

      // 同步 apiKey 到代理认证列表（统一使用 apiKeySync 工具）
      syncProfileApiKey(active)
    } else {
      engine = new QueryEngine({
        model: 'gpt-4o',
        provider: 'openai',
        maxOutputTokens: 4096,
        systemPrompt: BASE_SYSTEM_PROMPT,
        skills,
        agents,
        subagents,
      })
      console.log('[EngineBridge] No active profile, using defaults')

      // 注入默认 API 客户端
      const defaultEnabledGroups = ConfigManager.get().enabledToolGroups ?? []
      engine.setApiClient({
        sendMessage: createApiClientStream('openai', '', 'gpt-4o', '', defaultEnabledGroups),
      })
      lastApiSettings = { provider: 'openai', model: 'gpt-4o', apiKey: '', baseUrl: undefined }
    }

    const commandCount = await importCommands()

    // 加载用户勾选的工具插件
    const pluginTools = await loadLegacyPluginTools()
    console.log('[EngineBridge] Plugins loaded:', pluginTools ? Array.from(pluginTools.keys()).join(', ') : 'none')

    // 同步命令到 ToolCollection，确保工具系统与注册表一致
    await toolCollection.syncFromRegistry()
    engineReady = true
    console.log('[EngineBridge] Engine initialized, commands loaded:', commandCount, 'tools synced:', toolCollection.getToolNames().length)
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
  systemPrompt?: string; promptGroups?: Record<string, unknown>
}): boolean {
  const eng = getEngineInstance()
  if (!eng) return false
  // 局部更新：未传入的字段沿用上一次生效的值（而不是硬编码默认值）
  const merged = mergeApiSettings(lastApiSettings, opts)
  const provider = merged.provider as 'openai' | 'anthropic' | 'custom'
  const model = merged.model
  const baseUrl = merged.baseUrl
  const apiKey = merged.apiKey
  const systemPrompt = composeSystemPrompt(opts.systemPrompt, opts.promptGroups)
  const enabledToolGroups = ConfigManager.get().enabledToolGroups ?? []
  lastApiSettings = merged
  eng.updateConfig({
    provider: provider as 'openai' | 'anthropic',
    model,
    ...(systemPrompt ? { systemPrompt } : {}),
  })
  eng.setApiClient({
    sendMessage: createApiClientStream(provider, apiKey, model, baseUrl, enabledToolGroups),
  })
  console.log('[EngineBridge] API client rebuilt with provider=', provider, 'model=', model, 'baseUrl=', baseUrl || 'fallback', 'apiKeyLen=', apiKey ? apiKey.length : 0, 'systemPromptLen=', systemPrompt ? systemPrompt.length : 0)
  return true
}

/**
 * 将选中的提示词分组片段合成为一个 systemPrompt。
 * 显式 systemPrompt 优先；否则按 promptGroups 的勾选状态拼装。
 * KX2_PROMPT_GROUP 环境变量（逗号分隔分组 id）设置时，仅强制发送该集合的分组。
 */
export function composeSystemPrompt(systemPrompt?: string, promptGroups?: Record<string, unknown>): string | null {
  if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) return systemPrompt
  if (!promptGroups || typeof promptGroups !== 'object') return null

  const GROUPS: Array<{ id: string; items: Array<{ id: string; text: string; mandatory?: boolean }> }> = [
    { id: 'programming', items: [
      { id: 'prog-files', mandatory: true, text: '可使用文件工具：read_file / write_file / edit、目录列表 ls / dir / find、内容搜索 grep。' },
      { id: 'prog-shell', text: '可用 bash / cmd / powershell 执行命令；Windows 环境请用 cmd 风格（dir / type / del）。' },
      { id: 'prog-git', text: 'git 相关工具：status / diff / log / branch / commit，用于版本控制操作。' },
    ]},
    { id: 'document', items: [
      { id: 'doc-text', text: '文档读写：支持文本文件读写、二进制/文本对比、系列 Office 文档解析。' },
    ]},
    { id: 'image', items: [
      { id: 'img-draw', text: '画图：使用命令行绘图工具绘制示意图、流程图、UML 图等。' },
    ]},
    { id: 'reverse', items: [
      { id: 'rev-crypto', text: '逆向：MD5 / SHA 等哈希、Base64 编码、加解密换算工具。' },
    ]},
    { id: 'webdev', items: [
      { id: 'web-json', text: 'Web 前端：JSON 解析、格式化、校验等工具。' },
    ]},
  ]

  const parts: string[] = []
  const forced = process.env.KX2_PROMPT_GROUP
    ? process.env.KX2_PROMPT_GROUP.split(',').map(s => s.trim()).filter(Boolean)
    : null

  for (const group of GROUPS) {
    const cfg = promptGroups[group.id] as
      | { enabled?: boolean; mandatoryItemIds?: string[]; optionalItemIds?: string[] }
      | { [k: string]: unknown }
    if (!cfg) continue
    if (forced) {
      if (!forced.includes(group.id)) continue
    } else if (typeof (cfg as { enabled?: boolean }).enabled === 'boolean' && (cfg as { enabled?: boolean }).enabled === false) {
      continue
    }
    const c = cfg as { mandatoryItemIds?: string[]; optionalItemIds?: string[] }
    const wanted = new Set([...(c.mandatoryItemIds || []), ...(c.optionalItemIds || [])])
    for (const item of group.items) {
      if (item.mandatory || wanted.has(item.id)) parts.push(item.text)
    }
  }
  if (parts.length === 0) return null
  return parts.join('\n\n')
}

/** 检查引擎是否就绪 */
export function isEngineReady(): boolean {
  return engineReady && engine !== null
}

