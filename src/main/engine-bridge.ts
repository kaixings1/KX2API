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

import { BrowserWindow, app } from 'electron'
import { join } from 'node:path'
import { QueryEngine, type EngineOptions, type Tool } from '../engine/index.ts'
import { commandRegistry } from '../engine/commands/registry'
import { importCommands } from '../engine/commands/importer'
import { commandToolsToMap } from '../engine/commands/commandToolAdapter'
// 工具名概念归类：白名单按「能力」而非「字面名」派生，避免漏掉同义命令（shell/cmd/…）
import { getToolConcept } from '../engine/toolNameCompat.ts'
import { registerChatHandlers } from './ipc/chat-handlers'
import { ProfileManager } from './profiles/manager'
import { syncProfileApiKey } from './store/apiKeySync'
import { toolCollection } from './proxy/tools/toolCollection'
import { toolPluginRegistry, type ToolPlugin } from '../engine/plugin/toolPluginRegistry.ts'
import { allLegacyToolPlugins, coreToolPlugins, advancedToolPlugins } from '../engine/plugin/legacyToolPlugins.ts'
import { ConfigManager } from './store/config'
import type { AgentLoopConfig } from '../engine/loopConfig'
import type { AutoContinueConfig } from '../engine/messageLoop'
import type { ImageBudgetConfig } from '../shared/types'
import { sendMessageStream, type ApiConfig } from '../engine/api/client.ts'
import { buildToolFormatPrompt, DEFAULT_TOOL_FORMAT, type ToolFormat } from '../shared/toolCalling.ts'

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
 * 从配置读取工具运行参数并应用到引擎侧。
 *
 * 包含两部分：
 * - 落盘策略（toolResultStore）：结果多大触发落盘、预览多长、单轮聚合上限
 * - 工具执行超时（toolScheduler）：由 QueryEngine.updateConfig 推送
 *
 * 读取失败时保持默认，绝不因配置异常影响工具执行。
 */
export function applyToolRuntimeConfig(): void {
  try {
    const cfg = ConfigManager.get() as {
      toolRuntime?: Record<string, number>
      memory?: Record<string, number>
      subagent?: Record<string, number>
    } | void

    const rt = cfg?.toolRuntime
    if (rt) {
      void import('../engine/toolResultStore.ts').then(({ setToolResultStoreOptions }) => {
        setToolResultStoreOptions({
          maxResultSizeChars: rt.maxResultSizeChars,
          previewSizeBytes: rt.previewSizeBytes,
          maxResultsPerMessageChars: rt.maxResultsPerMessageChars,
        })
      })
      const eng = getEngineInstance()
      if (eng && typeof rt.toolTimeoutMs === 'number') {
        eng.updateConfig({ toolTimeoutMs: rt.toolTimeoutMs })
      }
    }

    const mem = cfg?.memory
    if (mem) {
      void import('../engine/memory/memoryRecall.ts').then(({ setMemoryRecallLimits }) => {
        setMemoryRecallLimits({
          maxMemoriesPerTurn: mem.maxMemoriesPerTurn,
          maxLinesPerMemory: mem.maxLinesPerMemory,
          maxBytesPerMemory: mem.maxBytesPerMemory,
          maxScanFiles: mem.maxScanFiles,
          minRelevanceScore: mem.minRelevanceScore,
        })
      })
    }

    const sub = cfg?.subagent
    if (sub) {
      void import('../engine/services/awaySummary.ts').then(({ setRecentMessageWindow }) => {
        setRecentMessageWindow(sub.recentMessageWindow)
      })
      const eng = getEngineInstance()
      if (eng && typeof sub.maxConcurrentAgents === 'number') {
        eng.subAgentManager.setMaxConcurrentAgents(sub.maxConcurrentAgents)
      }
    }

    // 代理层与日志层参数：各自独立应用，不依赖引擎实例
    void import('./runtimeConfigApply.ts')
      .then(({ applyAuxRuntimeConfig }) => applyAuxRuntimeConfig())
      .catch(() => {})
  } catch (e) {
    console.warn('[EngineBridge] 应用运行参数失败，使用默认值:', (e as Error).message)
  }
}

/**
 * 注入子代理的隔离引擎工厂。
 *
 * `SubAgentManager` 缺省用 `new QueryEngine(...)` 构造子引擎，但那**没有 apiClient**
 * —— 子引擎的 query 不会真的跑模型（管理器注释已说明「调用方需保证注入后再 execute」）。
 * 即：不注入的话子代理功能只是"能构造、不能工作"。
 *
 * 这里用当前生效的 API 设置，为每个子代理创建**独立**的引擎与 apiClient：
 * 独立的对话上下文（不读写父会话）、独立的 provider/model/baseUrl。
 * 子代理的中间过程因此不会污染主对话历史。
 */
function wireSubAgentFactory(engine: QueryEngine): void {
  try {
    engine.subAgentManager.setEngineFactory((opts) => {
      // 子代理默认继承父会话的连接参数，但允许 agent 配置覆盖 model
      const settings = lastApiSettings
      const subEngine = new QueryEngine({
        model: opts.model || settings.model,
        provider: (settings.provider as 'openai' | 'anthropic') || 'openai',
        systemPrompt: opts.systemPrompt,
        maxOutputTokens: opts.maxOutputTokens,
      })
      // 每个子引擎独占一条 apiClient 流，避免与父会话/其他子代理互相干扰
      subEngine.setApiClient({
        sendMessage: createApiClientStream(
          settings.provider,
          settings.apiKey,
          opts.model || settings.model,
          settings.baseUrl,
        ),
      })
      return subEngine
    })
    console.log('[EngineBridge] Sub-agent engine factory wired (isolated engines)')
  } catch (e) {
    console.warn('[EngineBridge] wireSubAgentFactory failed:', (e as Error).message)
  }
}

/**
 * 从配置读取 Agent 循环控制参数。
 *
 * 这些值原先硬编码在 messageLoop.ts 内，现由用户在设置界面调整。
 * 读取失败或未配置时返回空值，由引擎回落到默认值（行为与改造前一致）。
 */
/**
 * 把用户钩子注入引擎的工具调度器。
 *
 * 钩子实现位于 main 层（需要 child_process 与 userData 路径），
 * engine 层不应反向依赖，因此由本桥接层负责注入。
 *
 * 注入失败不影响工具执行 —— 钩子是用户可选的扩展点，不是必需组件。
 */
async function wireToolHooks(engine: QueryEngine): Promise<void> {
  try {
    const { runPreToolUse, runPostToolUse, setHooksConfigPath } = await import('./hooks/index.ts')
    // 钩子配置固定在 userData 下（不接受项目目录里的定义，见 hookConfig 的安全说明）
    setHooksConfigPath(join(app.getPath('userData'), 'hooks.json'))

    engine.setToolHooks({
      preToolUse: async (toolName, input) => {
        const res = await runPreToolUse(toolName, input)
        if (res.permissionBehavior === 'deny') {
          // stopReason 优先；没有则回落到阻塞性错误的文案（该字段是对象，需取内部字符串）
          const reason =
            res.stopReason || res.blockingError?.blockingError || '被用户钩子拒绝'
          return { deny: true, reason }
        }
        return { additionalContext: res.additionalContext }
      },
      postToolUse: async (toolName, input, success, output) => {
        await runPostToolUse(toolName, input, output, success)
      },
    })

    // 内置安全/审计钩子：把 engine/hooks/builtInHooks 的工厂接到引擎的 HookManager 上。
    // 这些是「唯一实现」的安全能力（密钥检测、文件类型告警、工具审计、失败追踪），
    // 此前零引用。此处接线使其真正生效，见 batch/01-engine/E7-engine-hooks.md。
    const { HookManager } = await import('../engine/hooks/hookManager.ts')
    const { createSecretDetectionHook, createFileTypeWarningHook, createToolAuditLogHook,
            createFailureTrackerHook } = await import('../engine/hooks/builtInHooks.ts')
    const hm = new HookManager()
    hm.register({ eventType: 'PreToolUse', handler: createSecretDetectionHook() })
    hm.register({ eventType: 'PreToolUse', handler: createFileTypeWarningHook() })
    hm.register({ eventType: 'PostToolUse', handler: createToolAuditLogHook() })
    hm.register({
      eventType: 'PostToolUseFailure',
      handler: createFailureTrackerHook((count, toolName) => {
        console.warn(`[Hook:FailureTracker] 工具 ${toolName} 已连续失败 ${count} 次`)
      }),
    })
    engine.setHookManager(hm)
    console.log('[EngineBridge] Built-in hooks registered (secret-detect / file-type / audit / failure-track)')

    console.log('[EngineBridge] Tool hooks wired from', join(app.getPath('userData'), 'hooks.json'))
  } catch (e) {
    console.warn('[EngineBridge] wireToolHooks failed:', (e as Error).message)
  }
}

/**
 * 把用户配置的参数级权限规则注入引擎。
 *
 * 与钩子同构：配置固定在 userData 下（不接受项目目录里的定义 ——
 * 克隆一个仓库不该改变你的权限策略）。
 *
 * 读不到配置时注入空规则集，`evaluatePermission` 会返回 passthrough，
 * 工具执行完全走既有权限逻辑 —— **不配置就等于行为不变**。
 */
async function wireToolPermissions(engine: QueryEngine): Promise<void> {
  try {
    const { setPermissionConfigPath, loadPermissionRules, ensureSamplePermissionConfig } =
      await import('./permissions/permissionConfig.ts')

    const file = join(app.getPath('userData'), 'permissions.json')
    setPermissionConfigPath(file)
    // 首次启动写一份示例（不覆盖已有配置），方便用户知道格式
    await ensureSamplePermissionConfig()
    const rules = await loadPermissionRules(true)
    engine.setPermissionRules(rules)
    console.log(`[EngineBridge] Tool permissions wired: ${rules.length} 条规则，来源 ${file}`)
  } catch (e) {
    console.warn('[EngineBridge] wireToolPermissions failed:', (e as Error).message)
  }
}

/**
 * 权限规则热更新：用户在设置界面改完立即生效，无需重启。
 * 返回当前规则条数（读失败返回 0）。
 */
export async function reloadToolPermissions(): Promise<number> {
  const eng = getEngineInstance()
  if (!eng) return 0
  try {
    const { loadPermissionRules, clearPermissionConfigCache } = await import(
      './permissions/permissionConfig.ts'
    )
    clearPermissionConfigCache()
    const rules = await loadPermissionRules(true)
    eng.setPermissionRules(rules)
    return rules.length
  } catch (e) {
    console.warn('[EngineBridge] reloadToolPermissions failed:', (e as Error).message)
    return 0
  }
}

/**
 * 审计配置：日志落在 userData/audit 下，随应用数据统一管理。
 * 取不到 userData 时（非 Electron 环境）由安全层自行降级为不审计。
 */
export function readAuditConfig(): {
  enableAudit: boolean
  auditDir?: string
  auditBufferSize?: number
  auditFlushIntervalMs?: number
} {
  try {
    const dir = join(app.getPath('userData'), 'audit')
    const cfg = ConfigManager.get() as {
      logRuntime?: { auditBufferSize?: number; auditFlushIntervalMs?: number }
    } | void
    return {
      enableAudit: true,
      auditDir: dir,
      auditBufferSize: cfg?.logRuntime?.auditBufferSize,
      auditFlushIntervalMs: cfg?.logRuntime?.auditFlushIntervalMs,
    }
  } catch {
    return { enableAudit: false }
  }
}

/**
 * 从配置读取图片预算。
 *
 * 未配置时返回空值，引擎侧不启用图片裁剪 —— 与改造前行为一致。
 */
export function readImageBudgetConfig(): ImageBudgetConfig | undefined {
  try {
    const cfg = ConfigManager.get() as { imageBudget?: ImageBudgetConfig } | undefined
    return cfg?.imageBudget
  } catch {
    return void 0
  }
}

/**
 * 从配置读取 Agent 循环控制参数（未配置时返回 undefined，由引擎回落默认值）。
 */
export function readAgentLoopConfig(): AgentLoopConfig | undefined {
  try {
    const cfg = ConfigManager.get() as { agentLoop?: AgentLoopConfig } | undefined
    return cfg?.agentLoop
  } catch {
    return undefined
  }
}

/**
 * 从配置读取自动流程控制参数。
 * MessageLoop 里的 autoContinue 默认是关闭的；未配置或缺失字段时返回空对象，
 * 引擎按 messageLoop.ts 内的 ?? 兜底回落默认值。
 */
export function readAutoContinueConfig(): AutoContinueConfig {
  try {
    const cfg = ConfigManager.get() as { autoContinue?: AutoContinueConfig }
    return cfg?.autoContinue || {}
  } catch {
    return {}
  }
}

/**
 * 估算请求体的输入侧 token 数。
 *
 * sendMessageStream 不回传真实 usage，而 MessageLoop 依赖 usage 校准预算，
 * 长期传 0 会让 TokenBudgetManager 完全失去真实基准。
 * 这里按 4 字符/token 粗估（中文场景偏保守，宁可高估也不低估到无感）。
 */
function estimateRequestTokens(messages: ReadonlyArray<Record<string, unknown>>): number {
  let chars = 0
  for (const m of messages) {
    chars += typeof m.content === 'string' ? m.content.length : 0
  }
  return Math.ceil(chars / 4)
}

/**
 * 将 sendMessageStream 的回调式 SSE 流转换为 MessageLoop 所需的 AsyncIterable<unknown> 事件流
 */
function createApiClientStream(
  provider: string,
  apiKey: string,
  model: string,
  baseUrl?: string,
): (req: unknown) => Promise<AsyncIterable<unknown>> {
  // 校验并修正 model-provider 不匹配
  const resolvedModel = resolveModelForProvider(provider, model, baseUrl)
  // 仅记录关键参数，避免日志过长
  console.log('[EngineBridge] createApiClientStream provider=', provider, 'model=', resolvedModel, 'baseUrl=', baseUrl || 'fallback')
  return async (request: unknown): Promise<AsyncIterable<unknown>> => {
    const rawMessages = (request as Record<string, unknown>).messages as Array<Record<string, unknown>>

    // 工具组必须在「每次请求」时解析：以前把 enabledToolGroups 捕获进闭包，
    // 切换分组后旧客户端依旧用老值，于是「配置改了不生效」。
    let enabledToolGroups: string[] = []
    let toolHint = ''
    try {
      const { resolveActiveToolsFromStore, buildToolHint, buildOpenAIToolDefinitions } = await import('./tools/toolRuntime.ts')
      const { resolved } = await resolveActiveToolsFromStore()
      enabledToolGroups = resolved.groupIds
      // 关键修复：只把引擎实际注册的工具（白名单命令 + 插件工具）发给模型，
      // 避免 toolManager 里数百条 CLI 命令涌入导致模型混淆、无效工具名、repeat loop。
      const engineToolNames = new Set(
        (engine?.getTools?.() ?? []).map(t => t.name),
      )
      const filteredResolved = {
        ...resolved,
        tools: resolved.tools.filter(t => engineToolNames.has(t.name)),
        names: resolved.tools.filter(t => engineToolNames.has(t.name)).map(t => t.name),
        platformSkipped: resolved.tools.filter(t => !engineToolNames.has(t.name)).map(t => t.name),
      }
      // 三层暴露协议（dev.txt §5/§7）：默认关闭，走 legacy 全量提示；
      // 设 KX2_TOOL_CONTEXT=layered 才启用「核心常驻 + 组目录 + 活跃 schema」。
      // 之所以默认关：撤掉工具名清单会改变模型可见信息，需灰度验证后再切默认。
      const { useLayeredContext, buildToolContext, computeToolBudget } = await import('./tools/toolContext.ts')

      let hintTools = filteredResolved.tools
      let layeredHint = ''
      if (useLayeredContext()) {
        const { toolManager } = await import('./tools/toolManager.ts')
        // 会话隔离：优先用请求里带的 id；没有则退回 default，
        // 且上下文构建与度量必须用同一个 id，否则 LRU 统计与活跃集对不上。
        //
        // 该 id 由 MessageLoop 经 requestBuilder.build() 透传而来（见 RequestParams.sessionId）。
        // 此前 MessageLoop 没传、APIRequest 也没这个字段，这里永远取到 'default'
        // ——与 client.ts 链路（同样缺 sessionId）合起来就是「活跃集全是 default」。
        const sid = (request as { sessionId?: string }).sessionId || 'default'
        // 上下文窗口由环境变量给出（不同模型差异大），缺省 128k 仅作保守假设。
        const ctxWindow = Number(process.env.KX2_TOOL_CONTEXT_WINDOW) || 128000
        const ctx = buildToolContext({
          tools: filteredResolved.tools,
          groups: toolManager.getAllGroups(),
          sessionId: sid,
          budgetTokens: computeToolBudget(ctxWindow, Number(process.env.KX2_TOOL_BUDGET_PCT) || 20),
        })
        hintTools = ctx.activeTools
        layeredHint = ctx.hint
        console.log(
          '[EngineBridge] layered tool context: active=', ctx.activeTools.length,
          'available=', filteredResolved.tools.length,
          'est_tokens=', ctx.estimatedTokens,
          ctx.evicted.length ? `evicted=${ctx.evicted.join(',')}` : ''
        )
        // 度量埋点（dev.txt §13）：记录本轮工具上下文成本，供评估分层收益。
        const { recordContext } = await import('./tools/toolMetrics.ts')
        recordContext({
          sessionId: sid,
          layered: true,
          exposed: ctx.activeTools.length,
          total: filteredResolved.tools.length,
          estimatedTokens: ctx.estimatedTokens,
          evicted: ctx.evicted.length,
        })
      }

      const engineDefs = buildOpenAIToolDefinitions(hintTools)
      if (engine && engineDefs.length > 0) {
        ;(engine as unknown as { setToolDefinitions: (defs: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>) => void }).setToolDefinitions(
          engineDefs.map(d => ({ name: d.function.name, description: d.function.description, input_schema: d.function.parameters })),
        )
      }
      // toolHint 用过滤后的工具集生成，避免展示未注册的工具名
      toolHint = layeredHint || buildToolHint({ ...filteredResolved, tools: hintTools, names: hintTools.map(t => t.name) })
      console.log('[EngineBridge] tools for this request:', hintTools.length, filteredResolved.isGlobal ? '(全局组)' : `(${resolved.groupNames.join('+')})`, 'engineDefs synced:', engineDefs.length, 'total available:', resolved.tools.length)
    } catch (e) {
      console.warn('[EngineBridge] 工具组解析失败，回退为全局组:', (e as Error).message)
    }

    // 把「本组可用工具」提示 + 相关记忆拼进 system 消息，
    // 让模型准确知道有哪些工具、怎么用，并复用此前沉淀的项目记忆。
    const messages = rawMessages.map(m => ({ ...m }))

    // 记忆召回（吸收自 Claude Code 的 memdir）：按最后一条用户消息检索相关记忆。
    // 记忆属增强项，任何异常都静默降级为空，绝不阻断主请求。
    //
    // 分两步，因为两者的缓存性质不同：
    //   ① **召回**（扫目录 + 读文件，昂贵）只依赖 query → 按 query 指纹缓存
    //   ② **过滤**（去重 + 会话预算）依赖对话历史，每轮都在变 → 不缓存
    // 若把两步合并缓存最终文本，历史一变就会读到过期的注入集合。
    let memorySection: string | null = null
    try {
      const lastUser = [...rawMessages].reverse().find(m => m.role === 'user')
      const query = typeof lastUser?.content === 'string' ? lastUser.content : ''
      if (query.trim()) {
        const [
          { recallMemories, formatMemoriesForPrompt },
          { selectMemoriesToSurface },
          { memoizeByKey, fingerprint },
        ] = await Promise.all([
          import('../engine/memory/memoryRecall.ts'),
          import('../engine/memory/memorySurfaceBudget.ts'),
          import('../engine/promptSections.ts'),
        ])

        const candidates = await memoizeByKey(`memory-recall:${fingerprint(query)}`, () =>
          recallMemories(query),
        )

        // 去重 + 会话累计预算（60KB）。
        // 关键：传**当前请求的消息** —— 压缩后旧记忆不在其中，预算与去重
        // 会自然重置，重新浮现是合法的（这是上游刻意选择"扫消息"的原因）。
        const { selected, remainingBytes } = selectMemoriesToSurface(candidates, rawMessages)
        if (selected.length < candidates.length) {
          console.log(
            `[EngineBridge] memory surfaced: ${selected.length}/${candidates.length} 条，` +
              `剩余额度 ${Math.round(remainingBytes / 1024)}KB`,
          )
        }
        memorySection = formatMemoriesForPrompt(selected)
      }
    } catch (e) {
      console.warn('[EngineBridge] memory recall skipped:', (e as Error).message)
    }

    // 项目指令（CLAUDE.md）：此前只有 /init 生成、没有读取端，
    // 用户写好的项目约定模型完全看不到。这里补上加载与注入。
    //
    // 刻意**不做缓存**：指令文件数量少、体积小，而用户改完 CLAUDE.md 后
    // 应当立即生效 —— 用缓存换来的那点 I/O 节省，不值得引入"改了不生效"的困惑。
    let instructionsSection: string | null = null
    try {
      const { buildInstructionsSection } = await import('../engine/instructions/claudeMdLoader.ts')
      instructionsSection = await buildInstructionsSection({
        // 工作目录优先取请求里带的（会话可能在某个项目里打开），否则用进程 cwd
        cwd: (request as { cwd?: string }).cwd || process.cwd(),
      })
    } catch (e) {
      console.warn('[EngineBridge] instructions load skipped:', (e as Error).message)
    }

    // 顺序即缓存前缀稳定性：越靠前的越稳定。
    //   指令文件（几乎不变）→ 工具提示（随工具组变化）→ 记忆（每轮可能不同）
    // 把易变内容放在后面，前面的部分才能命中 prompt cache。
    const systemExtra = [instructionsSection, toolHint, memorySection].filter(Boolean).join('\n\n')
    if (systemExtra) {
      const sysIdx = messages.findIndex(m => m.role === 'system')
      if (sysIdx >= 0) {
        const base = typeof messages[sysIdx].content === 'string' ? messages[sysIdx].content as string : ''
        messages[sysIdx] = { ...messages[sysIdx], content: base ? `${base}\n\n${systemExtra}` : systemExtra }
      } else {
        messages.unshift({ role: 'system', content: systemExtra })
      }
    }

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
    /** 本轮回推给引擎的工具调用数，决定 stopReason 是 tool_use 还是 end_turn */
    let forwardedToolCalls = 0
    let textBlockOpen = false
    // 独立的推理块索引（与文本块共用递增 index，但用额外标志区分类型）
    let reasonBlockOpen = false

    // StreamProcessor(streaming/streamProcessor.ts) 在 content_block_start 读取的字段是
    // event.content_block；旧代码写成 event.block，导致该值为空、process() 抛
    // "reading 'input'" 异常，且文本块缺 start/stop 会使所有文本 delta 被 processDelta 丢弃，
    // 最终页面 contentLen=0 无任何反馈。
    const ensureTextBlock = (): void => {
      if (textBlockOpen) return
      // 若推理块正开着，先关闭它再开文本块，避免两个块同时占用同一个 index
      if (reasonBlockOpen) closeReasonBlock()
      pushEvent({ type: 'content_block_start', index: blockIndex, content_block: { type: 'text' } })
      textBlockOpen = true
    }
    const closeTextBlock = (): void => {
      if (!textBlockOpen) return
      pushEvent({ type: 'content_block_stop', index: blockIndex })
      blockIndex++
      textBlockOpen = false
    }
    const closeReasonBlock = (): void => {
      if (!reasonBlockOpen) return
      pushEvent({ type: 'content_block_stop', index: blockIndex })
      blockIndex++
      reasonBlockOpen = false
    }
    const ensureReasonBlock = (): void => {
      if (reasonBlockOpen) return
      // 若文本块正开着，先关闭它再开推理块，避免互斥导致推理丢弃
      if (textBlockOpen) closeTextBlock()
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
        enabledToolGroups,
        // 与上方 buildToolContext 用同一个会话 id：client.ts 内部的
        // buildToolsFromRegistry 会据此构建活跃集，两条链路必须一致。
        sessionId: (request as { sessionId?: string }).sessionId || 'default',
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
          // 架构 A：工具执行权归属 MessageLoop。
          // 这里把 tool_use 转成引擎可识别的 content_block 事件推回，
          // 由 MessageLoop → ToolScheduler 完成权限检查、并行编排与执行。
          closeTextBlock()
          closeReasonBlock()
          const idx = blockIndex
          pushEvent({
            type: 'content_block_start',
            index: idx,
            content_block: {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input || {},
            },
          })
          pushEvent({ type: 'content_block_stop', index: idx })
          blockIndex++
          forwardedToolCalls++
          console.log(`[EngineBridge][API] tool_use forwarded to engine: /${block.name}`)
        },
        onDone: () => {
          closeTextBlock()
          closeReasonBlock()
          pushEvent({ type: 'message_stop' })
          // 本轮若产生过 tool_use，必须以 tool_use 结束：MessageLoop 据此进入
          // 工具执行分支，执行完再发起下一轮；否则会当作终答直接收尾，工具永不执行。
          const hasToolUse = forwardedToolCalls > 0
          pushEvent({
            type: 'message_delta',
            stopReason: hasToolUse ? 'tool_use' : 'end_turn',
            usage: {
              inputTokens: estimateRequestTokens(messages),
              outputTokens: Math.ceil(fullText.length / 4),
            },
          })
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
        pushEvent({
          type: 'message_delta',
          stopReason: forwardedToolCalls > 0 ? 'tool_use' : 'end_turn',
          usage: {
            inputTokens: estimateRequestTokens(messages),
            outputTokens: Math.ceil(fullText.length / 4),
          },
        })
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
  '2. 禁止添加”复制”、”、”、”：”等与内容无关的符号，不要把列表塞进 \'复制\' 代码块——代码块只用于真正的代码片段。（”``` 文件：a.ts、b.ts、c.ts ```” 是错的，应写成 “- a.ts 换行 - b.ts 换行 - c.ts”）。\n'

/**
 * 排版硬约束：无论 active profile 是否配置了自定义 systemPrompt，
 * 都会强制拼到 system prompt 最前面，避免用户自定义覆盖掉「禁止复制/、/：
 * 的错乱格式、目录用逐行列表」等 UI 展示所需的基本约定。
 */
export const LAYOUT_GUARD_PROMPT =
  '【展示约束（必须遵守）】\n' +
  '1. 汇报目录、文件列表等，一律用 GFM Markdown：表格用 | 分隔（含表头分隔行），列表用 "- " 或 "1. "，每项独占一行。\n' +
  '2. 严禁输出 "复制"、"复制代码" 等与内容无关的中文文案；严禁在列表/单元格里插单独的 "、" 、"：" 分隔符。\n' +
  '3. 代码块只放真正的代码片段，不要把文件/目录列表塞进代码块或 "{...}" 引用框。\n'

/** 将排版约束强制拼入 systemPrompt 尾部（若其未包含再拼，避免重复） */
function withLayoutGuard(systemPrompt: string): string {
  if (!systemPrompt) return LAYOUT_GUARD_PROMPT
  if (systemPrompt.includes('展示约束') || systemPrompt.includes('【排版规范】')) return systemPrompt
  return `${systemPrompt}\n\n${LAYOUT_GUARD_PROMPT}`
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

    // 先加载命令注册表，并把命令包装成 Tool 注入 Engine。
    // 关键：若不注入 opts.tools，engine 的 _toolDefinitions（MessageLoop availableTools）
    // 只含插件工具（read_file/bash/grep…），模型按 system prompt 发出的 ls/dir/cat 等
    // 命令工具会被误判 invalid、且 scheduler 无对应 registry 无法真正执行。
    const commandCount = await importCommands()
    // 只把 system prompt 里声明可用的核心命令包装成 Tool，
    // 避免 registry 中数百条 CLI 命令全部涌入 _toolDefinitions 并塞进发送给模型的 system prompt。
    //
    // ⚠️ 这里曾是一份**手写枚举**，且混了两种东西：
    //   - 真实命令名：pwd / ls / dir / cat / bash ...
    //   - 工具级别名：read_file / write_file / edit / glob / web_search / web_fetch
    //     （这些在 commandRegistry 里**并不存在**，永远匹配不到任何命令）
    // 更严重的是它**漏掉了同义命令**：registry 里 `shell` / `cmd` 都是可执行的 shell 命令，
    // 但白名单只列了 `bash`。于是模型发 `shell` 时：
    //   resolveToolName 能命中（查的是完整 registry）
    //   → 但 'shell' 不在 availableTools（= registry ∩ 本白名单）
    //   → 判 invalid，整轮工具被跳过
    //   （日志：[ENGINE:WARN] 1 invalid tool call(s) skipped. Valid: 0）
    //
    // 现在改为「基础名单 + 概念派生」：基础名单只列**要暴露的能力代表**，
    // 再按工具概念自动并入同义命令（shell 系：bash/cmd/shell/powershell…）。
    // 这样新增同义命令时不再需要手工维护白名单。
    const BASE_COMMAND_NAMES = [
      // 文件系统 / 搜索
      'pwd', 'ls', 'dir', 'tree', 'cat', 'find', 'findstr', 'grep', 'wc', 'head', 'tail',
      // 执行命令（shell 概念的代表；同义命令由下方概念派生自动并入）
      'bash',
      // 系统信息
      'echo', 'date', 'env', 'ps', 'where',
      // Git
      'git-status', 'git-diff', 'git-branch', 'git-log',
      // 引擎自身
      'memory', 'config',
      // 文件写操作（本项目里由 cp/mv/mkdir + 编辑类命令承担）
      'cp', 'mv', 'mkdir', 'edit', 'read_file', 'write_file',
      // 联网检索
      'web_search', 'web_fetch',
    ]

    // 概念派生：把 registry 中与基础名单**同概念**、且**有真实实现**的命令一并纳入。
    //
    // ⚠️ 必须排除「桩命令」：registry 264 条里有 222 条是桩 —— 它们的 execute 直接
    // 返回 `{success:true, needsAgent:true, output:"[AI 代理] /xxx 命令需要 AI 执行"}`，
    // 自己什么都不做。若把 `shell` / `cmd` 这类桩纳入白名单，模型调用后会拿到
    // 「成功」且内容是一句占位文案 —— 比判 invalid 更具误导性（用户以为执行了）。
    //
    // 判据：桩的 execute 源码里带 needsAgent:true 或「需要 AI 执行」文案。
    // 这不是最优雅的判据（理想是结构化标志），但改动最小且不触碰 registry 结构。
    const isStubCommand = (execute: unknown): boolean => {
      const src = String(execute)
      return /needsAgent\s*:\s*true/.test(src) || /需要\s*AI\s*执行/.test(src)
    }

    const whitelistSet = new Set<string>(BASE_COMMAND_NAMES)
    const knownConcepts = new Set<string>()
    for (const name of BASE_COMMAND_NAMES) {
      const c = getToolConcept(name)
      if (c !== 'unknown') knownConcepts.add(c)
    }
    const derived: string[] = []
    const skippedStubs: string[] = []
    for (const cmd of commandRegistry.getAll()) {
      const c = getToolConcept(cmd.name)
      if (c === 'unknown' || !knownConcepts.has(c)) continue
      if (whitelistSet.has(cmd.name)) continue
      if (isStubCommand(cmd.execute)) {
        skippedStubs.push(cmd.name)
        continue
      }
      whitelistSet.add(cmd.name)
      derived.push(cmd.name)
    }
    if (derived.length > 0) {
      console.log('[EngineBridge] Whitelist 概念派生额外纳入:', derived.join(', '))
    }
    if (skippedStubs.length > 0) {
      console.log(
        '[EngineBridge] Whitelist 跳过同概念桩命令（无真实实现，纳入会谎报成功）:',
        skippedStubs.join(', '),
      )
    }

    const TOOL_COMMAND_WHITELIST = [...whitelistSet]

    // ── 合并「可执行命令」视图 ──
    //
    // 三张表长期不一致，是本项目一系列「工具调不通」事故的总根源：
    //   ① commandRegistry   264 条，但其中 222 条是**桩**（execute 直接返回
    //                        needsAgent:true + 一句占位文案，自己什么都不做）
    //   ② commandRunners     61 条，**都是真实现**，但 28 个键在 registry 里没有
    //                        （bash / exec / cp / mv / wc / head / tail …）
    //   ③ 白名单是手写枚举，与上面两张表都对不齐
    //
    // 后果（均已实际发生）：
    //   - 模型发 `shell` → registry 有但那是桩 → 要么判 invalid，要么谎报成功
    //   - 模型发 `bash`  → runners 有真实现，但 registry 没有 → 无法被包装暴露
    //   - 22 个命令（commit/review/fix/test…）模型看得到，执行时却落到桩上
    //
    // 修法：以 **commandRunners 覆盖同名条目**（它有真实现），
    // 再并入 registry 中有真实实现的其余命令，得到「真正能执行的命令集合」。
    const mergedCommands = new Map<
      string,
      {
        name: string
        description: string
        execute: (args: string[]) => Promise<{ success: boolean; output?: string; error?: string }>
      }
    >()

    // 1) 先铺 registry 中有真实实现的（排除桩）
    for (const cmd of commandRegistry.getAll()) {
      if (isStubCommand(cmd.execute)) continue
      mergedCommands.set(cmd.name, {
        name: cmd.name,
        description: cmd.description,
        execute: cmd.execute,
      })
    }

    // 2) 再用 commandRunners 覆盖/补充：它都是真实现，且会覆盖同名的桩
    const { commandRunners } = await import('../engine/agent/command-runners.ts')
    for (const [name, runner] of commandRunners) {
      mergedCommands.set(name, {
        name,
        description: runner.description,
        execute: async (args: string[]) => {
          const out = await runner.execute(args, process.cwd())
          return { success: true, output: out }
        },
      })
    }

    // 3) 门槛：只有落在白名单里的才暴露给模型
    const mergedRegistry = {
      getAll: () => [...mergedCommands.values()].filter(c => whitelistSet.has(c.name)),
    }
    const commandTools = await commandToolsToMap(mergedRegistry, TOOL_COMMAND_WHITELIST)
    console.log('[EngineBridge] Command tools registered:', commandTools.size, '(' + Array.from(commandTools.keys()).slice(0, 20).join(', ') + (commandTools.size > 20 ? '…' : '') + ')')

    if (active) {
      const toolFormat = (active.toolFormat || DEFAULT_TOOL_FORMAT) as ToolFormat
      const toolFormatPrompt = buildToolFormatPrompt(toolFormat)
      const defaultSystem = BASE_SYSTEM_PROMPT + '\n\n' + toolFormatPrompt
      const composed = composeSystemPrompt(active.systemPrompt, active.promptGroups)
      const opts: EngineOptions = {
        model: active.model || 'gpt-4o',
        // 'custom' 是自定义 OpenAI 兼容端点，协议上与 'openai' 同路
        provider: active.provider === 'anthropic' ? 'anthropic' : 'openai',
        maxOutputTokens: 4096,
        systemPrompt: withLayoutGuard(composed || defaultSystem),
        skills,
        agents,
        subagents,
        tools: commandTools,
        agentLoop: readAgentLoopConfig(),
        autoContinue: readAutoContinueConfig(),
        imageBudget: readImageBudgetConfig(),
        ...readAuditConfig(),
      }
      engine = new QueryEngine(opts)
      console.log('[EngineBridge] Active profile:', active.name, 'provider:', opts.provider, 'baseUrl:', active.baseUrl, 'model:', opts.model)

      // 工具组不再在启动时定死：由 createApiClientStream 在每次请求时从配置解析，
      // 这样在「工具管理」里切组能立即生效（以前把值捕获进闭包，改了不生效）。
      // 注入真实 API 客户端（将 sendMessageStream 桥接为 MessageLoop 所需的 AsyncIterable）
      engine.setApiClient({
        sendMessage: createApiClientStream(opts.provider!, active.apiKey || '', opts.model!, active.baseUrl),
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
        tools: commandTools,
        agentLoop: readAgentLoopConfig(),
        autoContinue: readAutoContinueConfig(),
        imageBudget: readImageBudgetConfig(),
        ...readAuditConfig(),
      })
      console.log('[EngineBridge] No active profile, using defaults')

      // 注入默认 API 客户端
      engine.setApiClient({
        sendMessage: createApiClientStream('openai', '', 'gpt-4o', ''),
      })
      lastApiSettings = { provider: 'openai', model: 'gpt-4o', apiKey: '', baseUrl: undefined }
    }

    // 加载用户勾选的工具插件
    const pluginTools = await loadLegacyPluginTools()
    console.log('[EngineBridge] Plugins loaded:', pluginTools ? Array.from(pluginTools.keys()).join(', ') : 'none')

    // 应用工具运行参数（落盘策略、执行超时）：引擎已就绪，此时推送才生效
    applyToolRuntimeConfig()

    // 注入用户钩子：工具调用前可拦截、调用后可注入上下文
    if (engine) await wireToolHooks(engine)

    // 注入参数级权限规则：`Bash(git status)` 这类细粒度 allow/deny/ask。
    // 未配置时注入空集，判定走 passthrough → 完全沿用既有权限逻辑。
    if (engine) await wireToolPermissions(engine)

    // 注入子代理引擎工厂：缺省构造的子引擎没有 apiClient，query 不会真的跑模型
    if (engine) wireSubAgentFactory(engine)

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
 * 重置请求构建器的会话级缓存。
 *
 * `RequestBuilder` 持有工具结果的替换决策状态（`replacementState`），
 * 该状态带**冻结语义** —— 一旦某个 toolUseId 被决策为「替换」或「不替换」，
 * 后续轮次不得反悔，否则替换集合每轮变化会让 prompt cache 全量失效。
 *
 * 代价是它会跨会话累积：清空历史时必须一并重置，否则新会话会沿用旧决策
 * （表现为新对话里出现上一个会话的落盘预览）。
 */
export function resetRequestBuilderCaches(): void {
  try {
    const eng = getEngineInstance() as unknown as {
      requestBuilder?: { resetReplacementState?: () => void }
    } | null
    eng?.requestBuilder?.resetReplacementState?.()
  } catch {
    // 缓存重置属清理动作，失败不应阻断会话清空
  }
}

/**
 * 用新的 provider / model / apiKey / baseUrl 重建引擎的 API 客户端。
 * engine.updateConfig() 不会更新 baseUrl / apiKey，也不会重建 sendMessage 闭包，
 * 所以这里必须重新 setApiClient，否则对话配置里保存的地址永不变更。
 */
export function updateEngineApiClient(opts: {
  provider?: string; model?: string; apiKey?: string; baseUrl?: string
  systemPrompt?: string; promptGroups?: Record<string, unknown>
  toolFormat?: 'xml' | 'json'
}): boolean {
  const eng = getEngineInstance()
  if (!eng) return false
  // 局部更新：未传入的字段沿用上一次生效的值（而不是硬编码默认值）
  const merged = mergeApiSettings(lastApiSettings, opts)
  const provider = merged.provider as 'openai' | 'anthropic' | 'custom'
  const model = merged.model
  const baseUrl = merged.baseUrl
  const apiKey = merged.apiKey
  const toolFormat = opts.toolFormat || DEFAULT_TOOL_FORMAT
  const toolFormatPrompt = buildToolFormatPrompt(toolFormat)
  const basePrompt = BASE_SYSTEM_PROMPT + '\n\n' + toolFormatPrompt
  const composed = composeSystemPrompt(opts.systemPrompt, opts.promptGroups) ?? ''
  const systemPrompt = withLayoutGuard(composed ? composed + '\n\n' + basePrompt : basePrompt)
  lastApiSettings = merged
  eng.updateConfig({
    provider: provider as 'openai' | 'anthropic',
    model,
    ...(systemPrompt ? { systemPrompt } : {}),
    // 循环参数允许热更新：设置界面改完立即生效，无需重启
    agentLoop: readAgentLoopConfig(),
        autoContinue: readAutoContinueConfig(),
    imageBudget: readImageBudgetConfig(),
  })
  eng.setApiClient({
    sendMessage: createApiClientStream(provider, apiKey, model, baseUrl),
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

