/**
 * engine/api/client.ts — LLM API 统一客户端
 *
 * 支持 Anthropic Messages API 和 OpenAI Chat Completions API
 * 流式传输 + Tool Use
 */

import axios, { type AxiosInstance } from 'axios'
import { createParser } from 'eventsource-parser'
import { formatSystemError } from '../../shared/formatError'
import { parsePlainTextToolCalls, stripPlainTextToolCalls, type PlainTextToolCallBlock } from '../../utils/plainTextToolCallRepair'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentBlock[]
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

export interface ApiConfig {
  provider: 'anthropic' | 'openai' | 'custom'
  apiKey: string
  model: string
  baseUrl?: string
  maxTokens?: number
  /** 启用的工具分组列表，空数组表示使用所有工具 */
  enabledToolGroups?: string[]
}

export interface StreamCallbacks {
  onText: (text: string) => void
  onToolUse: (block: ContentBlock) => void
  onDone: (fullContent: string, toolCalls: ContentBlock[]) => void
  onError: (error: string) => void
  onReasoning?: (text: string) => void
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolCallResult {
  tool_use_id: string
  output: string
}

let requestCounter = 0

/**
 * 从 axios 错误里安全取出「响应正文预览」。
 *
 * 为什么不能直接 JSON.stringify：
 * - `responseType: "stream"` 时 `err.response.data` 是活的 IncomingMessage，
 *   它经 `Socket._httpMessage` ↔ `ClientRequest.socket` 形成循环引用，
 *   `JSON.stringify` 会抛 TypeError，**把原始错误替换掉**，真实失败原因丢失。
 *
 * 为什么是 async：
 * - 流对象上同步读 `_readableState.buffer` 取不到内容（读取端已被 axios 持有），
 *   必须做一次异步读取。错误响应体通常只有几十字节，代价可忽略；
 *   读不到就退化为提示文案，绝不让日志本身抛错。
 */
async function extractErrorBodyPreview(data: unknown): Promise<string> {
  if (data === null || data === undefined) return '(空)'
  if (typeof data === 'string') return data.slice(0, 500)

  const maybeStream = data as {
    on?: unknown
    destroy?: () => void
  }
  if (typeof maybeStream.on === 'function') {
    try {
      const text = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = []
        const timer = setTimeout(() => resolve(''), 1500)
        const stream = data as NodeJS.EventEmitter & { on: (e: string, cb: (c?: unknown) => void) => void }
        stream.on('data', (c) => { if (c) chunks.push(Buffer.from(c as Buffer)) })
        stream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')) })
        stream.on('error', () => { clearTimeout(timer); resolve('') })
      })
      if (text) return text.slice(0, 500)
    } catch {
      // 读取失败不影响主流程：下面的兜底文案同样能表达「有错误、详情在流里」
    }
    return '[流式响应体：未能读取错误详情，请参考上游状态码]'
  }

  // 普通对象：仅当可安全序列化时才序列化
  if (typeof data === 'object') {
    try {
      return JSON.stringify(data).slice(0, 500)
    } catch {
      return `[${(data as object).constructor?.name ?? '对象'}：无法序列化]`
    }
  }

  return String(data).slice(0, 500)
}

export async function sendMessageStream(
  config: ApiConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  requestCounter++
  const reqId = requestCounter
  const isAnthropic = config.provider === 'anthropic' || (!config.baseUrl && !config.provider)
  console.log('[API] sendMessageStream', { reqId, provider: config.provider, baseUrl: config.baseUrl, model: config.model, isAnthropic })

  try {
    if (isAnthropic) {
      await sendAnthropicStream(config, messages, callbacks, signal, reqId)
    } else {
      await sendOpenAIStreamWithTools(config, messages, callbacks, signal, reqId)
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return
    const raw = (e as Error)?.message || '请求失败'
    callbacks.onError(formatSystemError(raw))
  }
}

async function sendAnthropicStream(
  config: ApiConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  reqId?: number,
): Promise<void> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com'
  console.log('[API] Anthropic request', { reqId, baseUrl, model: config.model })
  const client = axios.create({
    baseURL: baseUrl,
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    timeout: 120000,
  })

  const anthropicMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    }))

  const systemMsg = messages.find(m => m.role === 'system')
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens || 4096,
    stream: true,
    messages: anthropicMessages,
  }
  if (systemMsg) {
    body.system = typeof systemMsg.content === 'string' ? systemMsg.content : ''
  }

  const anthropicEndpoint = '/v1/messages'
  const response = await client.post(anthropicEndpoint, body, { signal })

  console.log('[API][Anthropic] POST status=', response.status, 'stream=', !!response.data)
  let fullText = ''
  const toolCalls: ContentBlock[] = []

  const parser = createParser({
    onEvent(event) {
      if (event.data && event.data !== '[DONE]') {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta
            if (delta.type === 'text_delta') {
              fullText += delta.text
              callbacks.onText(delta.text)
            } else if (delta.type === 'thinking_delta') {
              if (callbacks.onReasoning) callbacks.onReasoning(delta.thinking || delta.text || '')
            } else if (delta.type === 'input_json_delta') {
              const lastTool = toolCalls[toolCalls.length - 1]
              if (lastTool && lastTool.type === 'tool_use') {
                lastTool.input = { ...lastTool.input, ...JSON.parse(delta.partial_json || '{}') }
              }
            }
          } else if (parsed.type === 'content_block_start') {
            const block = parsed.content_block
            if (block.type === 'tool_use') {
              toolCalls.push({ ...block, input: block.input || {} })
              callbacks.onToolUse(toolCalls[toolCalls.length - 1])
            }
          } else if (parsed.type === 'message_stop') {
            callbacks.onDone(fullText, toolCalls)
          } else if (parsed.type === 'error') {
            callbacks.onError(parsed.error?.message || 'API 错误')
          }
        } catch { /* skip unparseable */ }
      }
    },
    onError(error) {
      callbacks.onError(error instanceof Error ? error.message : String(error))
    },
    onRetry() {},
    onComment() {},
  })

  const lines = typeof response.data === 'string' ? response.data : ''
  console.log('[API][Anthropic] response body length=', lines.length)
  for (const line of lines.split('\n')) {
    if (line.startsWith('data:')) {
      parser.feed(line + '\n')
    }
  }
  callbacks.onDone(fullText, toolCalls)
}

async function sendOpenAIStream(
  config: ApiConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  reqId?: number,
): Promise<void> {
  const raw = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '')
  const hasEndpoint = raw.includes('/chat/completions')
  const endpoint = hasEndpoint ? raw : raw + '/v1/chat/completions'
  console.log('[API] OpenAI request', { reqId, endpoint, model: config.model })

  const client = axios.create({
    baseURL: raw,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    timeout: 120000,
  })

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens || 4096,
    stream: true,
    messages: messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    })),
  }

  const response = await client.post(endpoint, body, { signal })
  const lines = typeof response.data === 'string' ? response.data : ''
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines))
      controller.close()
    },
  })
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          callbacks.onDone(fullText, [])
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (!parsed.choices || parsed.choices.length === 0) {
            if (!parsed.error) console.log('[API] Non-streaming response:', JSON.stringify(parsed).slice(0, 200))
            return
          }
          const delta = parsed.choices[0].delta?.content || ''
          if (delta) {
            fullText += delta
            callbacks.onText(delta)
          }
          const reasonChunk = (parsed.choices[0].delta?.reasoning_content || parsed.choices[0].delta?.reasoning || parsed.choices[0].delta?.thinking || '') as string
          if (reasonChunk && callbacks.onReasoning) {
            callbacks.onReasoning(reasonChunk)
          }
        } catch (e) { /* skip */ }
      }
    }
  }
  // 简单模式下若正文含 XML/纯文本工具调用，提取并执行。仅当候选名可解析为真实
  // 注册命令时才认定是工具，否则视为 AI 正文，保留原文，绝不把工具输出替代正文。
  if (fullText) {
    try {
      const xmlCalls = parsePlainTextToolCalls(fullText)
      if (xmlCalls && xmlCalls.length > 0) {
        let resolvable = 0
        for (const call of xmlCalls) {
          if (await canResolveToolName(call.name)) resolvable++
        }
        if (resolvable > 0) {
          const collected: string[] = []
          for (const call of xmlCalls) {
            const r = await executeLocalTool(call.name, typeof call.arguments === 'object' ? Object.values(call.arguments as Record<string, unknown>).map(String) : [])
            collected.push((await canResolveToolName(call.name)) ? r.output : `[${call.name}]\n${r.output}`)
          }
          console.log('[API][OpenAI-simple] 从正文提取并执行 XML 工具调用', xmlCalls.map(t => t.name).join(', '))
          // 保留 AI 原文在前，工具结果追加在后，确保正文不丢失
          callbacks.onDone(fullText + '\n\n' + collected.join('\n\n'), [])
          return
        }
        console.log('[API][OpenAI-simple] 提取到的 XML 无法解析为命令，按 AI 正文返回:', xmlCalls.map(t => t.name).join(', '))
      }
    } catch (e) { /* 提取失败则按原文返回 */ }
  }
  callbacks.onDone(fullText, [])
}

/**
 * 把模型/XML 中常见的「工具名」归一化为可注册命令的真实命令名。
 * 很多模型（尤其被 XML 工具协议引导时）会自造工具名（如下划线前缀、动词短语、
 * 驼峰），与实际注册命令不一致，导致 executeLocalTool 查不到而报「未知命令」。
 * 这里做语义别名映射，优先精确命中，再按别名 / 子串回退。
 */
const TOOL_ALIASES: Record<string, string> = {
  // 目录 / 文件列举（映射到真实的 pwd / ls / dir）
  '_current_directory': 'pwd',
  'current_directory': 'pwd',
  'get_current_directory': 'pwd',
  'list_current_directory': 'ls',
  'list_directory': 'ls',
  'dir_list': 'dir',
  'list_dir': 'ls',
  'list_files': 'ls',
  'ls_dir': 'ls',
  'read_directory': 'ls',
  'show_directory': 'ls',
  // local_* 系（部分模型被引导用 local_ 前缀表达"本地文件系统"工具）
  'local_dir': 'ls',
  'local_directory': 'ls',
  'local_dirs': 'ls',
  'local_list': 'ls',
  'local_list_dir': 'ls',
  'local_dir_list': 'dir',
  'local_list_directory': 'ls',
  'local_files': 'ls',
  'local_file': 'cat',
  'local_cat': 'cat',
  'local_read': 'cat',
  'local_grep': 'grep',
  'local_search': 'find',
  'local_find': 'find',
  'local_pwd': 'pwd',
  'local_tree': 'tree',
  // 文件读取 / 写入 / 搜索
  'read_file': 'cat',
  'readfile': 'cat',
  'get_file': 'cat',
  'read_folder': 'ls',
  'write_file': 'echo',
  'edit_file': 'echo',
  'search_files': 'grep',
  'grep_search': 'grep',
  'find_file': 'find',
  'find_files': 'find',
  'search_text': 'findstr',
  'findstr_search': 'findstr',
  // 系统 / 环境
  'current_path': 'pwd',
  'print_directory': 'pwd',
  'print_working_directory': 'pwd',
  'environment': 'env',
  'show_env': 'env',
  // 其它常见
  'process_list': 'ps',
  'list_process': 'ps',
  'docker': 'docker',
  'git_branch': 'git-branch',
  'git_diff': 'git-diff',
  'git_log': 'git-log',
  'git_status': 'git-status',
}

export async function executeLocalTool(name: string, args: string[]): Promise<ToolCallResult> {
  const { commandRegistry } = await import('../commands/registry')
  const resolved = await resolveToolName(name)
  const normalized = resolved ?? name
  const cmd = commandRegistry.get(normalized)
  if (!cmd) {
    console.log(`[executeLocalTool] 名称归一化失败 name="${name}" → normalized="${normalized}"（命令不在注册表）`)
    return { tool_use_id: '', output: `错误: 未知命令 /${name}（可用命令见 /help）` }
  }
  if (normalized !== name) {
    console.log(`[executeLocalTool] 名称归一化："${name}" → "/${normalized}"`)
  }

  // 直接执行命令
  const result = await cmd.execute(args)

  // needsAgent 命令通过 AgentDispatcher 获得真实能力
  if (result.needsAgent && !result.error) {
    try {
      const { AgentDispatcher } = await import('../agent/dispatcher')
      const dispatcher = new AgentDispatcher({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        baseUrl: 'http://127.0.0.1:8080',
        maxTokens: 4096,
      })
      const agentResult = await dispatcher.dispatch(normalized, args)
      return {
        tool_use_id: '',
        output: agentResult.error || agentResult.output || '(Agent 执行完成)',
      }
    } catch (e) {
      return { tool_use_id: '', output: `Agent 执行失败: ${(e as Error).message}` }
    }
  }

  return { tool_use_id: '', output: result.error || result.output || '(无输出)' }
}

/**
 * 将「模型/XML 中的工具名」归一化为可注册命令的真实命令名。
 * 复用 executeLocalTool 的别名/模糊匹配逻辑，但不执行命令。
 * 命中返回归一化后的命令名，未命中返回 null。
 */
export async function resolveToolName(name: string): Promise<string | null> {
  const { commandRegistry } = await import('../commands/registry')

  // 候选名集合：原始名、剥离时间戳/数字后缀、剥离命名空间前缀后的末段名。
  // 覆盖模型/框架常自造的名：
  //   - local_dir_list_20260915    （动词短语 + 时间戳）
  //   - filesystem.list_directory  （命名空间 + 点分段）
  //   - fs::read_file / list::dir   （冒号命名空间）
  const candidates = new Set<string>([name])
  // 1) 剥离尾部数字 / 时间戳 / 长后缀
  const stripped = name
    .replace(/_(?:20\d{2}|19\d{2})\d{4,}$/, '')
    .replace(/_\d{4,}$/, '')
    .replace(/_\w{6,}$/, '')
  if (stripped !== name) candidates.add(stripped)
  // 2) 剥掉命名空间前缀（点 / 冒号 / 斜杠分段），取最后一段作为基础名
  const baseSeg = name.split(/[.\/:\\]+/).pop()
  if (baseSeg && baseSeg !== name) candidates.add(baseSeg)
  // 3) 对剥离时间戳后的名再取一次末段（filesystem.list_directory_2026 → list_directory）
  const strippedSeg = stripped.split(/[.\/:\\]+/).pop()
  if (strippedSeg && strippedSeg !== stripped && strippedSeg !== baseSeg) candidates.add(strippedSeg)

  for (const cand of candidates) {
    // 精确命中
    if (commandRegistry.get(cand)) return cand
    // 别名命中（含 list_directory / local_* 等）
    const lo = cand.toLowerCase()
    const alias = TOOL_ALIASES[lo]
    if (alias && commandRegistry.get(alias)) return alias
  }

  // 4) 去掉下划线 / 连字符 / 点 / 冒号等分隔符后的扁平名模糊匹配
  const flatten = (s: string) => s.replace(/[_\-.\/:\\]/g, '')
  const flat = flatten(name)
  for (const candBase of [...candidates]) {
    const candFlat = flatten(candBase)
    for (const candidate of commandRegistry.getNames()) {
      if (flatten(candidate) === candFlat) return candidate
    }
  }
  if (flat && !candidates.has(name)) { /* flat 已由上面 candFlat 覆盖 */ }
  return null
}

/**
 * 判断提取到的「候选工具名」是否能真正执行（能解析到注册命令）。
 * 用于发送前保护：当 AI 最终回复里的 XML 片段只是文档示例、名字根本不在
 * 注册表时，不把它当作工具调用，从而保住真实正文，避免整段被清空吞掉。
 */
export async function canResolveToolName(name: string): Promise<boolean> {
  if (!name || typeof name !== 'string') return false
  return (await resolveToolName(name)) !== null
}

/**
 * 构建本次请求要发的 OpenAI tools 定义。
 *
 * 数据源：工具管理（toolManager）的分组/启停/平台配置 —— 以前这里用的是
 * commandRegistry 里未分组的全量命令，且 enabledGroups 永远是空数组 = 不过滤（全发），
 * 所以「工具管理」里选的组从来没生效过。
 *
 * 兼容：toolRuntime 不可用（或工具 store 为空）时，回退到旧的 ToolCollection 逻辑。
 */
export async function buildToolsFromRegistry(enabledGroups: string[] = []): Promise<ToolDefinition[]> {
  try {
    const { resolveActiveTools, buildOpenAIToolDefinitions, applyToolEnvVars } = await import(
      '../../main/tools/toolRuntime.ts'
    )
    const { toolManager } = await import('../../main/tools/toolManager.ts')
    const allManaged = toolManager.getAllTools()
    if (allManaged.length > 0) {
      const resolved = resolveActiveTools({
        groupIds: enabledGroups,
        tools: allManaged,
        groups: toolManager.getAllGroups(),
      })
      // 同步环境变量：组内=1，其余=0
      applyToolEnvVars(resolved, allManaged)
      console.log(
        '[API] Tool filtering: total=',
        allManaged.length,
        'active=',
        resolved.tools.length,
        'scope=',
        resolved.isGlobal ? 'global' : resolved.groupNames.join('+'),
        resolved.platformSkipped.length ? `平台过滤: ${resolved.platformSkipped.join(',')}` : '',
        resolved.disabledSkipped.length ? `已关闭: ${resolved.disabledSkipped.join(',')}` : ''
      )
      if (resolved.tools.length > 0) {
        // 三层暴露协议：默认关闭（legacy 全量），KX2_TOOL_CONTEXT=layered 才启用。
        // 启用后只把「核心 L0 + 活跃 L2」的定义发给模型，长尾靠 tool_search/tool_load 发现。
        const { useLayeredContext, buildToolContext, computeToolBudget } = await import(
          '../../main/tools/toolContext.ts'
        )
        if (useLayeredContext()) {
          const ctxWindow = Number(process.env.KX2_TOOL_CONTEXT_WINDOW) || 128000
          const ctx = buildToolContext({
            tools: resolved.tools,
            groups: toolManager.getAllGroups(),
            budgetTokens: computeToolBudget(ctxWindow, Number(process.env.KX2_TOOL_BUDGET_PCT) || 20),
          })
          console.log(
            '[API] layered tools: active=', ctx.activeTools.length,
            'of', resolved.tools.length,
            'est_tokens=', ctx.estimatedTokens,
            ctx.evicted.length ? `evicted=${ctx.evicted.join(',')}` : ''
          )
          // 与 engine-bridge 路径保持同样的度量埋点，否则两条链路的统计数据不可比
          const { recordContext } = await import('../../main/tools/toolMetrics.ts')
          recordContext({
            sessionId: 'default',
            layered: true,
            exposed: ctx.activeTools.length,
            total: resolved.tools.length,
            estimatedTokens: ctx.estimatedTokens,
            evicted: ctx.evicted.length,
          })
          if (ctx.activeTools.length > 0) {
            return buildOpenAIToolDefinitions(ctx.activeTools) as unknown as ToolDefinition[]
          }
        }
        return buildOpenAIToolDefinitions(resolved.tools) as unknown as ToolDefinition[]
      }
    }
  } catch (e) {
    console.warn('[API] toolRuntime 解析失败，回退到 ToolCollection:', (e as Error).message)
  }

  const { toolCollection } = await import('../../main/proxy/tools/toolCollection')
  const tools: ToolDefinition[] = []
  const filtered = toolCollection.getFilteredTools(enabledGroups)
  console.log('[API] Tool filtering (fallback): total=', toolCollection.getAllTools().length, 'filtered=', filtered.length)
  for (const cmd of filtered) {
    tools.push({
      type: 'function',
      function: {
        name: cmd.name,
        description: cmd.description,
        parameters: {
          type: 'object',
          properties: {
            args: { type: 'array', items: { type: 'string' }, description: '命令参数列表' },
          },
        },
      },
    })
  }
  return tools
}

/**
 * OpenAI 兼容格式的单轮请求（带工具定义）。
 *
 * 只发一次请求并把 tool_calls 回推给 MessageLoop，不在此处执行工具。
 * 多轮推进由 MessageLoop 的循环负责：它执行工具、把结果写入 history，
 * 再带着更新后的 messages 重新调用本函数。
 */
export async function sendOpenAIStreamWithTools(
  config: ApiConfig,
  messages: Message[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  reqId?: number,
): Promise<void> {
  const tools = await buildToolsFromRegistry(config.enabledToolGroups || [])
  console.log('[API] tool definitions:', tools.length)

  const apiMessages = messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : m.content,
  }))

  // 单轮请求：工具执行权归属 MessageLoop。本函数只发一次请求，
  // 把 tool_use 回推给上层；工具结果会进入 history，随下一轮请求再来。
  {
    const raw = (config.baseUrl || 'https://api.openai.com').replace(/\/$/, '')
    const hasEndpoint = raw.includes('/chat/completions')
    const endpoint = hasEndpoint ? raw : raw + '/v1/chat/completions'
    console.log('[API] single-round request', { endpoint, model: config.model })

    const client = axios.create({
      baseURL: raw,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      timeout: 120000,
    })

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      stream: true,
      messages: apiMessages,
      tools,
    }

    const postStart = Date.now()
    console.log(`[API] POST ${endpoint} model=${config.model} stream=${body.stream} timeout=${client.defaults.timeout || 120000}ms`)
    let response: import('axios').AxiosResponse
    try {
      response = (await Promise.race([
        client.post(endpoint, body, { signal, responseType: 'stream' }).then(r => {
          console.log(`[API] axios resolved, status=${r.status}`)
          return r
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('POST timeout after 120s')), 120000)),
      ])) as import('axios').AxiosResponse
    } catch (postError) {
      const err = postError as Error & { response?: { status?: number; data?: unknown } }
      // 注意：responseType 为 stream 时，err.response.data 是**活的 IncomingMessage**，
      // 经 Socket ↔ ClientRequest 循环引用，JSON.stringify 会抛
      //   TypeError: Converting circular structure to JSON
      // 而该异常会替换掉原始错误、把真实失败原因彻底掩盖（日志不能成为故障源）。
      // 因此这里只做安全提取：字符串直接用；流对象做一次异步读取拿到错误正文。
      const rawBody = err.response?.data
      const bodyPreview = await extractErrorBodyPreview(rawBody)
      console.error(`[API] POST FAILED after ${Date.now() - postStart}ms: status=${err.response?.status ?? 'n/a'} body=${bodyPreview}`, err.message)
      throw postError
    }
    console.log(`[API] POST SUCCEEDED after ${Date.now() - postStart}ms, status=${response.status}, headers=`, JSON.stringify(response.headers).slice(0, 300))

    const httpStream = response.data
    console.log(`[API] response.data type=${typeof httpStream}, constructor=${httpStream?.constructor?.name}, isStream=${typeof httpStream?.on === 'function'}`)
    let buffer = ''
    let fullText = ''
    const toolCalls: ContentBlock[] = []

    const streamDone = new Promise<void>((resolve, reject) => {
      let chunkCount = 0
      let rawBytes = 0
      let sseLines = 0
      let dataLines = 0

      httpStream.on('data', (chunk: Buffer) => {
        chunkCount++
        rawBytes += chunk.length
        if (chunkCount <= 3) {
          // console.log(`[API][STREAM] chunk#${chunkCount} rawHex=${chunk.slice(0, 120).toString('hex')}`)
        }

        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          sseLines++
          if (!line.startsWith('data: ')) continue
          dataLines++
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') {
            // console.log(`[API][STREAM] received [DONE] sseLines=${sseLines} dataLines=${dataLines}`)
            continue
          }
          try {
            const parsed = JSON.parse(raw)
            if (!parsed.choices?.length) {
              // console.log(`[API][STREAM] no choices, event=${parsed?.object || parsed?.event?.type || 'unknown'}`)
              continue
            }
            const delta = parsed.choices[0].delta
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolCalls[idx]) {
                  toolCalls[idx] = {
                    type: 'tool_use',
                    id: tc.id || `tc_${Date.now()}_${idx}`,
                    name: tc.function?.name || '',
                    input: {},
                  }
                }
                if (tc.function?.arguments) {
                  try {
                    toolCalls[idx].input = {
                      ...toolCalls[idx].input,
                      ...JSON.parse(tc.function.arguments),
                    }
                  } catch (e) {
                    toolCalls[idx].input = {
                      ...toolCalls[idx].input,
                      raw: tc.function.arguments,
                    }
                  }
                }
              }
            }
            const text = delta?.content || ''
            if (text) {
              fullText += text
              callbacks.onText(text)
            }
            const reasoning = (delta?.reasoning_content || delta?.reasoning || delta?.thinking || '') as string
            if (reasoning && callbacks.onReasoning) {
              callbacks.onReasoning(reasoning)
            }
            if (dataLines <= 3 || text) {
              // console.log(`[API][STREAM] dataLine#${dataLines} textLen=${text.length} finishReason=${delta?.finish_reason || 'null'}`)
            }
          } catch (e) {
            console.error(`[API][STREAM] parse error:`, (e as Error).message, 'raw=', raw.slice(0, 100))
          }
        }
      })

      httpStream.on('end', () => {
        // console.log(`[API][STREAM] END chunkCount=${chunkCount} rawBytes=${rawBytes} sseLines=${sseLines} dataLines=${dataLines} fullTextLen=${fullText.length} toolCalls=${toolCalls.length}`)
        resolve()
      })
      httpStream.on('error', (err: Error) => {
        console.error(`[API][STREAM] ERROR chunkCount=${chunkCount} rawBytes=${rawBytes}:`, err)
        reject(err)
      })
      httpStream.on('close', () => {
        // console.log(`[API][STREAM] CLOSE chunkCount=${chunkCount} rawBytes=${rawBytes}`)
      })
    })

    await streamDone

    // 若本轮未收到结构化 tool_calls，尝试从正文中提取 XML/纯文本工具调用
    // （一些模型在 system prompt 学过 XML 工具协议后会把工具调用写成 <toolCall>..</toolCall> 文本）。
    if (toolCalls.length === 0 && fullText) {
      try {
        const xmlCalls = parsePlainTextToolCalls(fullText)
        if (xmlCalls && xmlCalls.length > 0) {
          // 守门：只有当提取到的工具名「能真正解析到注册命令」时，才认定为工具调用。
          // 否则极可能是 API 最终正文里的接口/HTML/XML 文档示例（如 <name>用户</name>、
          // <response><id>..</id></response>），必须保留全文作为 AI 答案，绝不吞掉。
          // 一次遍历：同时完成「是否可解析」的判定、归一化命令名与候选收集。
          // 归一化命令名（如 file_system.list_directory → ls）必须落到 toolCalls，
          // 否则 UI/后续 tool_result 配对拿到的是模型自造的原始名，与 MessageLoop 实际
          // 解析执行的命令不一致（也是此前「正文一条、tool_calls 却带 pwd/ls」混淆的来源）。
          const resolvable: Array<{ name: string; arguments: Record<string, unknown> }> = []
          for (const call of xmlCalls) {
            const resolved = await resolveToolName(call.name)
            if (resolved !== null) resolvable.push({ name: resolved, arguments: call.arguments ?? {} })
          }
          if (resolvable.length === 0) {
            console.log(`[API] 提取到 ${xmlCalls.length} 个候选但均无法解析到命令（视为 AI 正文，保留全文返回）:`, xmlCalls.map(t => t.name).join(', '))
          } else {
            console.log(`[API] 从正文中提取到 XML/纯文本工具调用 ${xmlCalls.length} 个, 可解析 ${resolvable.length} 个:`, resolvable.map(t => t.name).join(', '))
            // 只把「可真正执行」的候选当作工具；不可解析的候选当作 AI 正文保留，避免误执行/吞答复。
            for (const call of resolvable) {
              toolCalls.push({
                type: 'tool_use',
                id: `tc_${Date.now()}_${toolCalls.length}`,
                name: call.name,
                input: call.arguments ?? {},
              })
            }
            // 保留纯文本中非工具部分（模型常把工具调用写在正文中间），只剥离工具块，绝不整段清空。
            // 白名单 = 正式下发工具名 ∪ 本轮可解析的归一化命令名：只删"真实能执行"的调用块，
            // 其余正文里恰巧出现的 <name>（接口文档/HTML 示例）一律保留，防误删 AI 答案。
            const stripAllowed = new Set<string>([
              ...tools.map(t => t.function.name),
              ...resolvable.map(r => r.name),
            ])
            fullText = stripPlainTextToolCalls(fullText, stripAllowed)
          }
        }
      } catch (e) {
        console.error('[API] XML tool extraction failed:', (e as Error).message)
      }
    }

    if (toolCalls.length === 0) {
      callbacks.onDone(fullText, [])
      return
    }

    // 工具执行权统一归属 MessageLoop（架构 A）：
    // 本函数只负责「发一次请求 + 把 tool_use 推回上层」，不再自行执行工具。
    // 这样权限检查、并行编排、自动修复、循环守卫、上下文压缩都只有一条实现路径。
    for (const tc of toolCalls) {
      callbacks.onToolUse(tc)
    }
    callbacks.onDone(fullText, toolCalls)
  }
}
