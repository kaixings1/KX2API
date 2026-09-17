import type { ChatCompletionRequest, ChatMessage, ChatCompletionTool } from '../types.ts'
import type { Provider } from '../../store/types.ts'
import {
  DEFAULT_TOOL_CALLING_CONFIG,
  normalizeToolCallingConfig,
  type ToolCallingConfig,
} from '../../../shared/toolCalling.ts'
import { getToolProtocol } from './protocols/index.ts'
import { getToolClientAdapter } from './clientAdapters/index.ts'
import { buildToolCallingRuntimePlan } from './runtimePlan.ts'
import { extractToolCallsFromText } from './toolCallExtractor.ts'
import { validateToolHistory } from './historyGuard.ts'
import type { NormalizedToolDefinition, ToolCallingPlan, ToolCallingTransformResult, ToolProtocolId } from './types.ts'
import { promptAdapterRegistry } from './promptAdapters/PromptAdapterRegistry.ts'
import { promptInjectionService } from '../services/promptInjectionService.ts'

/**
 * NormalizedToolDefinition（扁平）→ ChatCompletionTool（OpenAI 嵌套式）。
 *
 * 两者结构不同：
 *   前者 { name, description, parameters }
 *   后者 { type: 'function', function: { name, description, parameters } }
 *
 * PromptInjectionService 与 legacy 的 promptAdapterRegistry 都要后者，
 * 而 plan.tools 是前者 —— 之前直接传导致 TS2345。
 */
function toChatCompletionTools(
  defs: readonly NormalizedToolDefinition[],
): ChatCompletionTool[] {
  return defs.map(d => ({
    type: 'function' as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    },
  }))
}

export class ToolCallingEngine {
  private readonly config: ToolCallingConfig
  private readonly PATH_CACHE_TTL_MS = 5 * 60_000
  private readonly PATH_CACHE_MAX_ENTRIES = 200
  private readonly pathCache = new Map<string, { paths: Set<string>; expiresAt: number }>()

  getCachedPaths(requestId?: string): string[] {
    const key = requestId || ''
    const entry = this.pathCache.get(key)
    if (!entry) return []
    if (Date.now() > entry.expiresAt) {
      this.pathCache.delete(key)
      return []
    }
    return [...entry.paths]
  }

  clearCache(requestId: string): void {
    this.pathCache.delete(requestId)
  }

  cachePath(path: string, requestId?: string): void {
    const key = requestId || ''
    if (!key || !path) return
    this._pruneExpired()
    if (this.pathCache.size >= this.PATH_CACHE_MAX_ENTRIES) {
      const oldestKey = this.pathCache.keys().next().value!
      this.pathCache.delete(oldestKey)
    }
    const existing = this.pathCache.get(key)
    if (existing) {
      existing.paths.add(path)
      existing.expiresAt = Date.now() + this.PATH_CACHE_TTL_MS
    } else {
      this.pathCache.set(key, {
        paths: new Set([path]),
        expiresAt: Date.now() + this.PATH_CACHE_TTL_MS,
      })
    }
  }

  resolvePath(filename: string, requestId?: string): string | null {
    const cached = this.getCachedPaths(requestId)
    for (const fullPath of cached) {
      const basename = fullPath.split(/[\\/]/).pop()
      if (basename && basename === filename) return fullPath
    }
    return null
  }

  private _pruneExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.pathCache) {
      if (now > entry.expiresAt) {
        this.pathCache.delete(key)
      }
    }
  }

  private extractFilename(path: string): string {
    const parts = path.split(/[\\/]/)
    const last = parts.pop()
    return last || path
  }

  constructor(config: Partial<ToolCallingConfig> = {}) {
    this.config = normalizeToolCallingConfig({
      ...DEFAULT_TOOL_CALLING_CONFIG,
      ...config,
      advanced: {
        ...DEFAULT_TOOL_CALLING_CONFIG.advanced,
        ...config.advanced,
      },
    })
  }

  transformRequest(input: {
    request: ChatCompletionRequest
    provider: Provider
    actualModel: string
    requestId?: string
  }): ToolCallingTransformResult {
    const { request, provider, actualModel, requestId } = input
    const adapter = getToolClientAdapter(this.config.clientAdapterId)
    const clientRequest = adapter.normalizeRequest(request)
    // 工具白名单收窄：当配置了 allowedToolNames（非空）时，把客户端请求携带的
    // request.tools 收窄到白名单内再派发，避免把整批工具（几百个）全部注入 prompt。
    // 空数组/未配置 → 维持透传 request.tools 的原行为。
    const allowList = this.config.advanced?.allowedToolNames
    if (Array.isArray(allowList) && allowList.length > 0 && clientRequest.tools.length > 0) {
      const keep = new Set(allowList)
      const filtered = clientRequest.tools.filter((tool) => keep.has(tool.name))
      if (filtered.length > 0 && filtered.length < clientRequest.tools.length) {
        clientRequest.tools = filtered
        console.log(
          `[ToolCallingEngine] tools narrowed ${clientRequest.tools.length} -> ${filtered.length} ` +
            `by allowedToolNames=${allowList.join(',')}`,
        )
      }
    }
    const plan = buildToolCallingRuntimePlan({
      requestId,
      providerId: provider.id,
      actualModel,
      model: request.model,
      config: this.config,
      clientRequest,
    })
    const shouldInjectPrompt = plan.shouldInjectPrompt
    const cachedPaths = this.getCachedPaths(requestId)

    if (!shouldInjectPrompt) {
      const out: any = {
        messages: request.messages,
        plan,
      }
      if (plan.mode === 'disabled') {
        out.tools = request.tools
      }
      return out
    }

    // Try PromptInjectionService first (auto-detect client, inject managed protocol)
    const injectionResult = promptInjectionService.process(
      request.messages,
      toChatCompletionTools(plan.tools),
      actualModel,
      provider.id
    )

    if (injectionResult.injected) {
      return {
        messages: injectionResult.messages,
        tools: plan.mode === 'disabled' ? request.tools : null,
        plan,
      }
    }

    // Fallback: legacy promptAdapterRegistry path
    const clientAdapted = promptAdapterRegistry.transformRequest(
      request.messages,
      toChatCompletionTools(plan.tools),
      actualModel,
      provider.id
    )

    let messagesToUse: ChatMessage[]
    let toolsToUse: ChatCompletionTool[] | null

    if (clientAdapted.injected && clientAdapted.cleaned) {
      messagesToUse = clientAdapted.messages
      console.log(`[ToolCallingEngine] Client (KiloCode) prompt cleaned`)
    } else if (clientAdapted.injected) {
      messagesToUse = request.messages
      console.log(`[ToolCallingEngine] Skipped duplicate prompt injection for detected client`)
    } else {
      messagesToUse = request.messages
    }

    messagesToUse = injectPrompt(messagesToUse, renderPrompt(plan.protocol, plan.tools, this.config, cachedPaths))
    // disabled 模式：沿用请求里带的 tools（缺失时统一为 null，
    // 保持与 managed 模式同一套「显式无工具」语义）
    toolsToUse = plan.mode === 'disabled' ? (request.tools ?? null) : null

    // Validate tool call history structure before returning
    if (plan.mode !== 'disabled') {
      const validation = validateToolHistory(messagesToUse, { plan })
      if (!validation.valid) {
        for (const error of validation.errors) {
          console.warn(`[ToolCallingEngine] history validation: ${error.code}: ${error.message}`)
        }
      }
    }

    return {
      messages: messagesToUse,
      tools: toolsToUse,
      plan,
    }
  }

  applyNonStreamResponse(result: any, plan: ToolCallingPlan): void {
    if (!plan.shouldParseResponse) return

    const message = result?.choices?.[0]?.message
    if (!message || typeof message.content !== 'string') return

    const parseResult = parseSelectedProtocol(message.content, plan)
    plan.diagnostics.parserFormat = parseResult.protocol
    plan.diagnostics.parsedToolCallCount = parseResult.toolCalls.length
    plan.diagnostics.invalidToolNames = parseResult.invalidToolNames
    plan.diagnostics.malformedReason = parseResult.malformedReason

    if (parseResult.toolCalls.length === 0) {
      if (plan.fallbackStrategy === 'always') {
        const extracted = extractToolCallsFromText(message.content)
        if (extracted.toolCalls.length > 0) {
          message.content = extracted.content || null
          message.tool_calls = extracted.toolCalls
          const choice = result.choices[0]
          choice.finish_reason = 'tool_calls'
        }
      }
      return
    }

    for (const call of parseResult.toolCalls) {
      // 协议解析器返回的是 OpenAI 风格的 ToolCall：
      // { id, type: 'function', function: { name, arguments } } —— 不是扁平结构。
      const fn = (call as { function?: { name?: string; arguments?: unknown } }).function
      if (fn?.name === 'read_file') {
        const args = typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments)
        try {
          const parsed = JSON.parse(args)
          if (parsed && typeof parsed.path === 'string') {
            this.cachePath(parsed.path, plan.diagnostics.requestId)
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    message.content = parseResult.content || null
    message.tool_calls = parseResult.toolCalls

    const choice = result.choices[0]
    choice.finish_reason = 'tool_calls'
  }
}

function renderPrompt(
  protocol: ToolProtocolId,
  tools: NormalizedToolDefinition[],
  config: ToolCallingConfig,
  cachedPaths: string[] = [],
): string {
  // 所有协议实现的 renderPrompt 都只接受 tools —— 没有 cachedPaths 参数
  // （各实现见 protocols/*.ts）。此前多传了一个实参，TS 报 TS2554。
  const prompt = getToolProtocol(protocol).renderPrompt(tools)
  const forceHint = config.mode === 'force'
    ? '\n\n## MANDATORY TOOL CALL\nYou MUST call exactly one tool for every user request. Do NOT reply with plain text. Output ONLY the tool call block.'
    : ''
  const forcedPrompt = prompt + forceHint
  const customPromptTemplate = config.diagnosticsEnabled
    ? config.advanced.customPromptTemplate
    : undefined
  if (!customPromptTemplate) return forcedPrompt

  return customPromptTemplate
    .replace(/\{\{tools\}\}/g, prompt)
    .replace(/\{\{tool_names\}\}/g, tools.map((tool) => tool.name).join(', '))
    .replace(/\{\{format\}\}/g, protocol)
}

function injectPrompt(messages: ChatMessage[], prompt: string): ChatMessage[] {
  const [first, ...rest] = messages
  if (first?.role === 'system' && typeof first.content === 'string') {
    return [{ ...first, content: `${first.content}\n\n${prompt}` }, ...rest]
  }

  return [{ role: 'system', content: prompt }, ...messages]
}

function parseSelectedProtocol(content: string, plan: ToolCallingPlan) {
  const selected = getToolProtocol(plan.protocol)
  return selected.parse(content, { tools: plan.tools, protocol: plan.protocol })
}
