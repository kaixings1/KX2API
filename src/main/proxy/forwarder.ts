/**
 * Proxy Service Module - Request Forwarder
 * Forwards requests to corresponding API based on provider configuration
 */

import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import http2 from 'http2'
import { PassThrough } from 'stream'
import { Account, Provider } from '../store/types'
import type { ProviderType } from '../oauth/types'
import { ForwardResult, ChatCompletionRequest, ProxyContext, ExtractedToolDefinition, ToolExtractionConfig } from './types'
import { proxyStatusManager } from './status'
import { storeManager } from '../store/store'
import { DeepSeekAdapter } from './adapters/deepseek'
import { DeepSeekStreamHandler } from './adapters/deepseek-stream'
import { GLMAdapter, GLMStreamHandler } from './adapters/glm'
import { KimiAdapter, KimiStreamHandler } from './adapters/kimi'
import { MimoAdapter, MimoStreamHandler } from './adapters/mimo'
import { QwenAdapter, QwenStreamHandler } from './adapters/qwen'
import { QwenAiAdapter, QwenAiStreamHandler } from './adapters/qwen-ai'
import { ZaiAdapter, ZaiStreamHandler } from './adapters/zai'
import { MiniMaxAdapter, MiniMaxStreamHandler } from './adapters/minimax'
import { PerplexityAdapter } from './adapters/perplexity'
import { PerplexityStreamHandler } from './adapters/perplexity-stream'
import { StepFunAdapter, StepFunStreamHandler } from './adapters/stepfun'
import { StepFunStudioAdapter } from './adapters/stepfun-studio'
import { OpenAIAdapter } from './adapters/openai'
import { AnthropicAdapter } from './adapters/anthropic'
import { GoogleAdapter, type GeminiRequest, type GeminiContent } from './adapters/google'
import { OllamaAdapter } from './adapters/ollama'
import { GroqAdapter } from './adapters/groq'
import { TogetherAdapter } from './adapters/together'
import { CozeAdapter } from './adapters/coze'
import { MistralAdapter } from './adapters/mistral'
import { XAIAdapter } from './adapters/xai'
import { SiliconCloudAdapter } from './adapters/siliconcloud'
import { ToolCallingEngine } from './toolCalling/ToolCallingEngine'
import type { ToolCallingTransformResult } from './toolCalling/types'
import type { ToolCallingConfig } from '../../shared/toolCalling'
import { ToolCallExtractor, toOpenAIToolCall } from './toolCalling/toolCallExtractor'
import { sessionManager } from './sessionManager'
import { cookieSessionManager } from '../oauth/cookieSessionManager'
import {
  createContextManagementService,
  SummaryGenerator,
} from './services/contextManagementService'
import type { ChatMessage as ContextChatMessage } from './types'

/**
 * 代理中间调试日志开关。
 *
 * forwarder 里 [FWD] STEP-x / [StepFun][DIAG-FWD] / [Forwarder][DIAG] 这类
 * 「每请求都要打」的进度/状态日志噪音很大，默认不输出；排查时设
 * KX2_DEBUG_PROXY=1 即可全部打开。错误类日志（console.error）不受此开关影响，
 * 始终保留。
 */
const DEBUG_PROXY = process.env.KX2_DEBUG_PROXY === '1'

/** 仅在开启代理调试日志输出时才打印进度/状态日志 */
function proxyDebugLog(...args: unknown[]): void {
  if (DEBUG_PROXY) console.log(...args)
}

function shouldDeleteSession(): boolean {
  return sessionManager.shouldDeleteAfterChat()
}

/** OpenAI 的 stop 允许 string | string[]，各家协议只收 string[] */
function toStopArray(stop: string | string[] | null | void): string[] {
  if (stop == null) return []
  return Array.isArray(stop) ? stop : [stop]
}

/** 把 OpenAI messages 转成 Gemini contents（role user/model + parts） */
function toGeminiContents(messages: unknown[]): GeminiContent[] {
  return (messages ?? []).map((m: any) => ({
    role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
    parts: [{ text: typeof m.content === 'string' ? m.content : String(m.content ?? '') }],
  }))
}

/** 构造一个最小的 OpenAI chat.completion 响应体 */
function buildOpenAICompletion(content: string, model: string): Record<string, unknown> {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  }
}

/** 构造一个 OpenAI 流式 SSE chunk */
function buildOpenAIStreamChunk(delta: string, model: string, done: boolean): string {
  const payload = {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      { index: 0, delta: done ? {} : { content: delta }, finish_reason: done ? 'stop' : null },
    ],
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

type ProviderForwarder = {
  name: string
  matches: (provider: Provider) => boolean
  forward: (
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ) => Promise<ForwardResult>
}

/**
 * Request Forwarder
 */
export class RequestForwarder {
  private axiosInstance = axios.create({
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })

  private readonly providerForwarders: ProviderForwarder[] = [
    {
      name: 'deepseek',
      matches: DeepSeekAdapter.isDeepSeekProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardDeepSeek(request, account, provider, actualModel, startTime),
    },
    {
      name: 'glm',
      matches: GLMAdapter.isGLMProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardGLM(request, account, provider, actualModel, startTime),
    },
    {
      name: 'kimi',
      matches: KimiAdapter.isKimiProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardKimi(request, account, provider, actualModel, startTime),
    },
    {
      name: 'qwen',
      matches: QwenAdapter.isQwenProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardQwen(request, account, provider, actualModel, startTime),
    },
    {
      name: 'qwen-ai',
      matches: QwenAiAdapter.isQwenAiProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardQwenAi(request, account, provider, actualModel, startTime),
    },
    {
      name: 'zai',
      matches: ZaiAdapter.isZaiProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardZai(request, account, provider, actualModel, startTime),
    },
    {
      name: 'minimax',
      matches: MiniMaxAdapter.isMiniMaxProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardMiniMax(request, account, provider, actualModel, startTime),
    },
    {
      name: 'mimo',
      matches: MimoAdapter.isMimoProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardMimo(request, account, provider, actualModel, startTime),
    },
    {
      name: 'perplexity',
      matches: PerplexityAdapter.isPerplexityProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardPerplexity(request, account, provider, actualModel, startTime),
    },
    {
      name: 'stepfun',
      matches: StepFunAdapter.isStepFunProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardStepFun(request, account, provider, actualModel, startTime),
    },
    {
      name: 'stepfun-studio',
      matches: StepFunStudioAdapter.isStepFunStudioProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardStepFunStudio(request, account, provider, actualModel, startTime),
    },
    {
      name: 'openai',
      matches: OpenAIAdapter.isOpenAIProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardOpenAI(request, account, provider, actualModel, startTime),
    },
    {
      name: 'anthropic',
      matches: AnthropicAdapter.isAnthropicProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardAnthropic(request, account, provider, actualModel, startTime),
    },
    {
      name: 'google',
      matches: GoogleAdapter.isGoogleProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardGoogle(request, account, provider, actualModel, startTime),
    },
    {
      name: 'ollama',
      matches: OllamaAdapter.isOllamaProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardOllama(request, account, provider, actualModel, startTime),
    },
    {
      name: 'groq',
      matches: GroqAdapter.isGroqProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardGroq(request, account, provider, actualModel, startTime),
    },
    {
      name: 'together',
      matches: TogetherAdapter.isTogetherProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardTogether(request, account, provider, actualModel, startTime),
    },
    {
      name: 'coze',
      matches: CozeAdapter.isCozeProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardCoze(request, account, provider, actualModel, startTime),
    },
    {
      name: 'mistral',
      matches: MistralAdapter.isMistralProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardMistral(request, account, provider, actualModel, startTime),
    },
    {
      name: 'xai',
      matches: XAIAdapter.isXAIProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardXAI(request, account, provider, actualModel, startTime),
    },
    {
      name: 'siliconcloud',
      matches: SiliconCloudAdapter.isSiliconCloudProvider,
      forward: (request, account, provider, actualModel, startTime) =>
        this.forwardSiliconCloud(request, account, provider, actualModel, startTime),
    },
  ]

  /** 生效工具白名单缓存（避免每请求都重新解析 toolManager） */
  private _toolCache: { at: number; names: string[] } | null = null
  private readonly TOOL_ALLOWLIST_TTL_MS = 15_000

  /**
   * 预热「当前生效工具名白名单」缓存。
   *
   * 数据源：工具管理（toolManager）+ 配置 `config.enabledToolGroups` 解析出的
   * 生效工具（`toolRuntime.resolveActiveTools`）。这是用户在「工具管理」里
   * 选中/启用工具的权威来源。仅当用户明确选择了非全局组、且解析出的工具数确实
   * 少于全部工具时才缓存名单；否则返回空数组 = 不收窄（维持透传 request.tools，
   * 避免误杀第三方客户端自定义工具）。用动态 import 保持与 client.ts 一致的分块加载。
   */
  private async warmToolAllowListCache(): Promise<string[]> {
    const now = Date.now()
    if (this._toolCache && now - this._toolCache.at < this.TOOL_ALLOWLIST_TTL_MS) {
      return this._toolCache.names
    }
    let names: string[] = []
    try {
      const { resolveActiveTools } = await import('../tools/toolRuntime')
      const { toolManager } = await import('../tools/toolManager')
      const all = toolManager.getAllTools()
      const groups = toolManager.getAllGroups()
      const cfg: any = storeManager.getConfig()
      const groupIds: string[] = cfg?.enabledToolGroups || []
      if (groupIds.length > 0) {
        const resolved = resolveActiveTools({ groupIds, tools: all, groups })
        if (resolved.tools.length > 0 && resolved.tools.length < all.length) {
          names = resolved.names
        }
      }
    } catch (e) {
      console.warn('[Forwarder] 工具白名单解析失败，不收窄:', (e as Error).message)
    }
    this._toolCache = { at: now, names }
    return names
  }

  /** 同步读取已预热的工具白名单缓存；空 = 不收窄 */
  private getEffectiveToolAllowList(): string[] {
    if (!this._toolCache) return []
    if (Date.now() - this._toolCache.at > this.TOOL_ALLOWLIST_TTL_MS) return []
    return this._toolCache.names
  }

  /**
   * Transform request for prompt-based tool calling
   * For models that don't support native function calling
   * Delegates tool normalization, prompt injection, and parser planning to ToolCallingEngine.
   */
  private transformRequestForPromptToolUse(
    request: ChatCompletionRequest,
    provider?: Provider
  ): ToolCallingTransformResult {
    const cfg = storeManager.getConfig().toolCallingConfig
    let config: ToolCallingConfig = cfg as ToolCallingConfig

    // 用户显式配置了白名单 → 以其为准；否则用「工具管理」当前生效工具名自动填充，
    // 使 KX2 里勾选/启用的工具真正约束到代理转发的工具注入。
    const explicit = config?.advanced?.allowedToolNames
    if (!(Array.isArray(explicit) && explicit.length > 0)) {
      const effectiveNames = this.getEffectiveToolAllowList()
      if (effectiveNames.length > 0) {
        config = {
          ...config,
          advanced: { ...config.advanced, allowedToolNames: effectiveNames },
        }
      }
    }

    const engine = new ToolCallingEngine(config)

    return engine.transformRequest({
      request,
      provider: provider ?? {
        id: 'custom',
        name: 'Custom',
        type: 'custom',
        authType: 'token',
        apiEndpoint: '',
        headers: {},
        enabled: true,
        createdAt: 0,
        updatedAt: 0,
      },
      actualModel: request.model,
    })
  }

  private applyToolCallsToResponse(result: any, transformed: ToolCallingTransformResult): void {
    const engine = new ToolCallingEngine(storeManager.getConfig().toolCallingConfig)
    engine.applyNonStreamResponse(result, transformed.plan)

    // Fallback: if standard parser found no tool calls, try multi-format extraction
    const message = result?.choices?.[0]?.message
    if (!message || typeof message.content !== 'string') return
    if (message.tool_calls && message.tool_calls.length > 0) return

    const extractor = new ToolCallExtractor()
    const extractionResult = extractor.process(message.content)

    if (extractionResult.toolCalls.length > 0) {
      const openAIToolCalls = extractionResult.toolCalls.map(tc => toOpenAIToolCall(tc))

      message.content = extractionResult.content || null
      message.tool_calls = openAIToolCalls

      const choice = result.choices[0]
      if (choice) {
        choice.finish_reason = 'tool_calls'
      }

      console.log(
        `[Forwarder] Multi-format extractor found ${openAIToolCalls.length} tool call(s): ` +
        openAIToolCalls.map(tc => tc.function.name).join(', ')
      )
    }
  }

  // Tool extraction placeholder
  private extractToolsFromContent(content: string): ExtractedToolDefinition[] {
    // Default extraction configuration
    const extractionConfig = {
      enabled: true,
      minConfidence: 'medium' as const,
      maxToolsPerRequest: 20,
      enabledExtractors: ['json-schema', 'html-structured', 'markdown-code', 'dom-attribute'],
      debug: false,
    }

    if (!extractionConfig.enabled) {
      return []
    }

    const extractedTools: ExtractedToolDefinition[] = []
    const seenNames = new Set<string>()

    // Extract from JSON Schema blocks
    const jsonSchemaTools = this.extractJsonSchemaTools(content)
    for (const tool of jsonSchemaTools) {
      if (!seenNames.has(tool.name) && this.meetsConfidenceThreshold(tool.confidence, extractionConfig.minConfidence)) {
        extractedTools.push(tool)
        seenNames.add(tool.name)
      }
    }

    // Extract from HTML structured data
    const htmlTools = this.extractHtmlStructuredTools(content)
    for (const tool of htmlTools) {
      if (!seenNames.has(tool.name) && this.meetsConfidenceThreshold(tool.confidence, extractionConfig.minConfidence)) {
        extractedTools.push(tool)
        seenNames.add(tool.name)
      }
    }

    // Extract from Markdown code blocks
    const markdownTools = this.extractMarkdownCodeBlockTools(content)
    for (const tool of markdownTools) {
      if (!seenNames.has(tool.name) && this.meetsConfidenceThreshold(tool.confidence, extractionConfig.minConfidence)) {
        extractedTools.push(tool)
        seenNames.add(tool.name)
      }
    }

    // Extract from DOM attributes
    const domTools = this.extractDomAttributeTools(content)
    for (const tool of domTools) {
      if (!seenNames.has(tool.name) && this.meetsConfidenceThreshold(tool.confidence, extractionConfig.minConfidence)) {
        extractedTools.push(tool)
        seenNames.add(tool.name)
      }
    }

    // Limit total tools
    return extractedTools.slice(0, extractionConfig.maxToolsPerRequest)
  }

  private meetsConfidenceThreshold(confidence: string, threshold: string): boolean {
    const levels: Record<string, number> = { high: 3, medium: 2, low: 1 }
    return levels[confidence] >= levels[threshold]
  }

  private extractJsonSchemaTools(content: string): ExtractedToolDefinition[] {
    const tools: ExtractedToolDefinition[] = []

    // Pattern 1: OpenAI tools array format
    const openAiToolsPattern = /"tools"\s*:\s*\[\s*\{[\s\S]*?"type"\s*:\s*"function"[\s\S]*?\}\s*\]/i
    const openAiMatch = content.match(openAiToolsPattern)

    if (openAiMatch) {
      const functionPattern = /\{\s*"type"\s*:\s*"function"[\s\S]*?"function"\s*:\s*\{[\s\S]*?\}\s*\}/g
      const functionMatches = openAiMatch[0].matchAll(functionPattern)

      for (const match of functionMatches) {
        try {
          const funcDef = JSON.parse(match[0])
          if (funcDef.function?.name) {
            tools.push({
              name: funcDef.function.name,
              description: funcDef.function.description || '',
              parameters: funcDef.function.parameters || {},
              source: 'openai',
              confidence: 'high',
              extractor: 'json-schema',
              rawMatch: match[0],
            })
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    // Pattern 2: Standalone function schema with name, description, parameters
    const standalonePattern = /\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"description"\s*:\s*"[^"]*"[\s\S]*?"parameters"\s*:\s*\{[\s\S]*?"type"\s*:\s*"object"[\s\S]*?\}\s*\}/g
    const standaloneMatches = content.matchAll(standalonePattern)

    for (const match of standaloneMatches) {
      try {
        const schema = JSON.parse(match[0])
        if (schema.name && schema.parameters) {
          tools.push({
            name: schema.name,
            description: schema.description || '',
            parameters: schema.parameters,
            source: 'openai',
            confidence: 'high',
            extractor: 'json-schema',
            rawMatch: match[0],
          })
        }
      } catch {
        // Skip malformed JSON
      }
    }

    return tools
  }

  private extractHtmlStructuredTools(content: string): ExtractedToolDefinition[] {
    const tools: ExtractedToolDefinition[] = []

    const scriptPattern = /<script[^>]*type\s*=\s*["'][^"']*json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi
    const scriptMatches = content.matchAll(scriptPattern)

    for (const match of scriptMatches) {
      try {
        const jsonContent = match[1].trim()
        const parsed = JSON.parse(jsonContent)

        if (Array.isArray(parsed.tools)) {
          for (const tool of parsed.tools) {
            if (tool.type === 'function' && tool.function?.name) {
              tools.push({
                name: tool.function.name,
                description: tool.function.description || '',
                parameters: tool.function.parameters || {},
                source: 'openai',
                confidence: 'high',
                extractor: 'html-structured',
                rawMatch: match[0],
              })
            }
          }
        } else if (parsed.name && parsed.parameters) {
          tools.push({
            name: parsed.name,
            description: parsed.description || '',
            parameters: parsed.parameters,
            source: 'openai',
            confidence: 'high',
            extractor: 'html-structured',
            rawMatch: match[0],
          })
        }
      } catch {
        // Skip malformed JSON
      }
    }

    return tools
  }

  private extractMarkdownCodeBlockTools(content: string): ExtractedToolDefinition[] {
    const tools: ExtractedToolDefinition[] = []

    const codeBlockPattern = /```(?:json)?\s*([\s\S]*?)```/gi
    const codeBlockMatches = content.matchAll(codeBlockPattern)

    for (const match of codeBlockMatches) {
      const codeContent = match[1].trim()

      try {
        const parsed = JSON.parse(codeContent)

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.type === 'function' && item.function?.name) {
              tools.push({
                name: item.function.name,
                description: item.function.description || '',
                parameters: item.function.parameters || {},
                source: 'openai',
                confidence: 'high',
                extractor: 'markdown-code',
                rawMatch: match[0],
              })
            }
          }
        } else if (parsed.type === 'function' && parsed.function?.name) {
          tools.push({
            name: parsed.function.name,
            description: parsed.function.description || '',
            parameters: parsed.function.parameters || {},
            source: 'openai',
            confidence: 'high',
            extractor: 'markdown-code',
            rawMatch: match[0],
          })
        } else if (parsed.name && parsed.parameters) {
          tools.push({
            name: parsed.name,
            description: parsed.description || '',
            parameters: parsed.parameters,
            source: 'openai',
            confidence: 'medium',
            extractor: 'markdown-code',
            rawMatch: match[0],
          })
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    return tools
  }

  private extractDomAttributeTools(content: string): ExtractedToolDefinition[] {
    const tools: ExtractedToolDefinition[] = []

    // Pattern: data-tool="toolName" or data-function="functionName"
    const domPattern = /<[^>]+(?:data-tool|data-function|data-api-endpoint)\s*=\s*["']([^"']+)["'][^>]*>/gi
    const domMatches = content.matchAll(domPattern)

    for (const match of domMatches) {
      const toolName = match[1].trim()

      if (toolName && !tools.some(t => t.name === toolName)) {
        const tagMatch = match[0].match(/<[^>]+title\s*=\s*["']([^"']+)["']/i)
        const description = tagMatch ? tagMatch[1] : ''

        tools.push({
          name: toolName,
          description: description,
          parameters: {},
          source: 'openai',
          confidence: 'low',
          extractor: 'dom-attribute',
          rawMatch: match[0],
        })
      }
    }

    // Pattern: <form> with action attribute (API endpoint)
    const formPattern = /<form[^>]+action\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/gi
    const formMatches = content.matchAll(formPattern)

    for (const match of formMatches) {
      const action = match[1].trim()
      const formContent = match[2]

      const inputPattern = /<input[^>]+name\s*=\s*["']([^"']+)["'][^>]*>/gi
      const inputMatches = formContent.matchAll(inputPattern)

      const parameters: {
        type: string
        properties: Record<string, { type: string; description: string }>
        required?: string[]
      } = {
        type: 'object',
        properties: {},
      }

      for (const inputMatch of inputMatches) {
        const paramName = inputMatch[1]
        const requiredMatch = inputMatch[0].match(/required/i)
        parameters.properties[paramName] = {
          type: 'string',
          description: 'Form field: ' + paramName,
        }

        if (!parameters.required) {
          parameters.required = []
        }
        if (requiredMatch) {
          parameters.required.push(paramName)
        }
      }

      if (Object.keys(parameters.properties).length > 0) {
        const toolName = 'form_' + Buffer.from(action).toString('base64url').slice(0, 16)

        tools.push({
          name: toolName,
          description: 'Form submission to ' + action,
          parameters: parameters,
          source: 'openai',
          confidence: 'medium',
          extractor: 'dom-attribute',
          rawMatch: match[0],
        })
      }
    }

    return tools
  }

  /**
   * Create summary generator function for context management
   * Uses the current provider and account to generate summaries
   */
  private createSummaryGenerator(
    account: Account,
    provider: Provider,
    actualModel: string,
    context: ProxyContext
  ): SummaryGenerator {
    return async (messages: ContextChatMessage[], prompt?: string): Promise<string> => {
      try {
        proxyDebugLog('[SummaryGenerator] Generating summary for', messages.length, 'messages')

        const summaryPrompt = prompt || '请简洁地总结以下对话，保留关键信息与上下文：'

        const conversationText = messages
          .map(msg => {
            const role = msg.role.toUpperCase()
            const content = typeof msg.content === 'string'
              ? msg.content
              : Array.isArray(msg.content)
                ? msg.content
                    .filter((part: { type?: string; text?: string }) => part.type === 'text' && part.text)
                    .map((part: { type?: string; text?: string }) => part.text)
                    .join('\n')
                : ''
            return `${role}: ${content}`
          })
          .join('\n\n')

        const summaryRequest: ChatCompletionRequest = {
          model: actualModel,
          messages: [
            {
              role: 'system',
              content: summaryPrompt,
            },
            {
              role: 'user',
              content: conversationText,
            },
          ],
          stream: false,
          temperature: 0.3,
        }

        const result = await this.doForward(
          summaryRequest,
          account,
          provider,
          actualModel,
          context
        )

        if (result.success && result.body) {
          const summaryContent = result.body.choices?.[0]?.message?.content || ''
          proxyDebugLog('[SummaryGenerator] Summary generated successfully, length:', summaryContent.length)
          return summaryContent
        }

        console.warn('[SummaryGenerator] Failed to generate summary:', result.error)
        return '生成对话摘要失败。'
      } catch (error) {
        console.error('[SummaryGenerator] Error generating summary:', error)
        return '因错误导致生成对话摘要失败。'
      }
    }
  }

  /**
   * Forward Chat Completions Request
   */
  async forwardChatCompletion(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    context: ProxyContext
  ): Promise<ForwardResult> {
    const startTime = Date.now()
    proxyDebugLog('[FWD] STEP-4 forwardChatCompletion ENTRY provider=', provider.id, 'model=', actualModel, 'stream=', request.stream, 'msgCount=', request.messages?.length, 'accountId=', account.id)
    const config = storeManager.getConfig()
    const maxRetries = config.retryCount

    // 在真正转发前，先解析「工具管理」里用户选中的生效工具名（供 ToolCallingEngine 收窄工具注入）
    await this.warmToolAllowListCache()

    const sessionContext = sessionManager.getOrCreateSession({
      providerId: provider.id,
      accountId: account.id,
      model: actualModel,
    })

    let lastError: string | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await this.delay(5000)
      }

      // When starting a new session, only send the last user message
      // This prevents sending conversation history from the previous session
      let modifiedRequest = request
      if (sessionContext.isNew && request.messages && request.messages.length > 0) {
        const lastUserMessage = request.messages[request.messages.length - 1]
        modifiedRequest = {
          ...request,
          messages: [lastUserMessage]
        }
        proxyDebugLog('[Forwarder] New session detected, sending only last user message')
      }

      // Save user message to session for multi-turn context (first attempt only to avoid duplicates on retry)
      const sessionConfig = sessionManager.getSessionConfig()
      const multiTurnEnabled = sessionConfig.maxMessagesPerSession > 0
      if (multiTurnEnabled && attempt === 0 && sessionContext.sessionId && request.messages && request.messages.length > 0) {
        const lastUserMessage = request.messages[request.messages.length - 1]
        if (lastUserMessage.role === 'user') {
          sessionManager.addMessage(sessionContext.sessionId, {
            role: lastUserMessage.role,
            content: typeof lastUserMessage.content === 'string'
              ? lastUserMessage.content
              : JSON.stringify(lastUserMessage.content),
            providerMessageId: lastUserMessage.providerMessageId,
            toolCallId: lastUserMessage.tool_call_id,
          })
        }
      }

      if (config.contextManagement?.enabled && modifiedRequest.messages && modifiedRequest.messages.length > 0) {
        try {
          const summaryGenerator = this.createSummaryGenerator(
            account,
            provider,
            actualModel,
            context
          )

          const contextService = createContextManagementService(
            config.contextManagement || {},
            summaryGenerator
          )

          const originalCount = modifiedRequest.messages.length
          const contextMessages: ContextChatMessage[] = modifiedRequest.messages.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
            content: msg.content,
            timestamp: Date.now(),
          }))

          const processResult = await contextService.process(contextMessages)

          if (processResult.finalCount !== originalCount) {
            console.log(
              `[Forwarder] Context management applied: ${originalCount} -> ${processResult.finalCount} messages`
            )

            processResult.strategyResults.forEach(result => {
              if (result.trimmed) {
                console.log(
                  `[Forwarder] Strategy ${result.strategyName}: ${result.originalCount} -> ${result.processedCount} messages`
                )
              }
            })

            modifiedRequest = {
              ...modifiedRequest,
              messages: processResult.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
              })),
            }
          }
        } catch (error) {
          console.error('[Forwarder] Context management failed:', error)
        }
      }

      try {
        proxyDebugLog('[FWD] STEP-13 calling doForward sessionNew=', sessionContext.isNew)
        const result = await this.doForward(modifiedRequest, account, provider, actualModel, context)
        proxyDebugLog('[FWD] STEP-14 doForward RETURNED success=', result.success, 'status=', result.status, 'stream=', !!result.stream, 'body=', !!result.body, 'error=', (result.error || 'none').slice(0, 200))

        if (result.success) {
          if (result.providerSessionId) {
            sessionManager.updateProviderSessionId(
              sessionContext.sessionId,
              result.providerSessionId
            )
          }
          if (result.parentMessageId) {
            sessionManager.updateParentMessageId(
              sessionContext.sessionId,
              result.parentMessageId
            )
          }
          return result
        }

        lastError = result.error

        if (result.status && result.status < 500 && result.status !== 429) {
          break
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : '未知错误'
        console.error('[StepFun][DIAG-FWD] doForward threw exception:', lastError, error instanceof Error ? error.stack?.slice(0, 300) : '')
      }
    }

    return {
      success: false,
      error: lastError || '重试后仍然请求失败',
      latency: Date.now() - startTime,
    }
  }

  /**
   * Execute Forward
   */
  private async doForward(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    context: ProxyContext
  ): Promise<ForwardResult> {
    const startTime = Date.now()
    proxyDebugLog('[FWD] STEP-5 doForward ENTRY provider=', provider.id, 'model=', actualModel)

    // Inject cookie session credentials if available (web-based auth)
    const mergedAccount = await this.maybeMergeCookieCredentials(account, provider)
    proxyDebugLog('[FWD] STEP-6 cookie merged, accountId=', mergedAccount.id, 'hasCredentials=', !!mergedAccount.credentials?.token, 'tokenPrefix=', mergedAccount.credentials?.token ? mergedAccount.credentials.token.slice(0, 30) : 'null')

    const dedicatedForwarder = this.providerForwarders.find(forwarder => forwarder.matches(provider))
    proxyDebugLog('[FWD] STEP-7 matched forwarder=', dedicatedForwarder?.name || 'none', 'provider.id=', provider.id, 'apiEndpoint=', provider.apiEndpoint, 'provider.name=', provider.name)
    if (dedicatedForwarder) {
      const logConfig = storeManager.getConfig().requestLogConfig
      proxyDebugLog('[FWD] STEP-8 calling forwardStepFun provider=', provider.id, 'forwarder=', dedicatedForwarder.name)
      const result = await dedicatedForwarder.forward(request, mergedAccount, provider, actualModel, startTime)
      proxyDebugLog('[FWD] STEP-9 forwarder RETURNED success=', result.success, 'status=', result.status, 'hasStream=', !!result.stream, 'hasBody=', !!result.body, 'error=', (result.error || 'none').slice(0, 200))
      if (logConfig.logToConsole) {
        const resBody = result.stream ? '(stream)' : (result.body ? JSON.stringify(result.body).slice(0, 500) : '(no body)')
        console.log(`[API-RES] ${provider.name} | forwarder=${dedicatedForwarder.name} | success=${result.success} | status=${result.status || 'n/a'} | latency=${result.latency}ms | error=${result.error || 'none'} | body=${resBody}`)
      }
      return result
    }

    try {

      const chatPath = provider.chatPath || '/chat/completions'
      const url = this.buildUrl(provider, chatPath)
      const headers = this.buildHeaders(provider, mergedAccount)
      const body = this.buildRequestBody(request, actualModel, mergedAccount)

      const axiosConfig: AxiosRequestConfig = {
        method: 'POST',
        url,
        headers,
        data: body,
        timeout: proxyStatusManager.getConfig().timeout,
        responseType: request.stream ? 'stream' : 'json',
        validateStatus: () => true,
      }

      const logConfig = storeManager.getConfig().requestLogConfig
      if (logConfig.logToConsole) {
        const reqBody = typeof body === 'string' ? body : JSON.stringify(body)
        console.log(`[API-REQ] ${provider.name} → ${url} | model=${actualModel} | body=${reqBody.slice(0, 500)}`)
      }

      const response: AxiosResponse = await this.axiosInstance.request(axiosConfig)
      const latency = Date.now() - startTime

      if (logConfig.logToConsole) {
        const resBody = request.stream ? '(stream)' : JSON.stringify(response.data).slice(0, 500)
        console.log(`[API-RES] ${provider.name} ← ${url} | status=${response.status} | latency=${latency}ms | body=${resBody}`)
      }

      if (response.status >= 400) {
        return {
          success: false,
          status: response.status,
          error: this.extractErrorMessage(response),
          latency,
          url,
        }
      }

      if (request.stream) {
        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: response.data,
          latency,
          extractedTools: [],
          url,
        }
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: response.data,
        latency,
        extractedTools: this.extractToolsFromContent(JSON.stringify(response.data)),
        url,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      const logConfig = storeManager.getConfig().requestLogConfig
      if (logConfig.logToConsole) {
        console.log(`[API-ERR] ${provider.name} | error=${error instanceof Error ? error.message : 'Unknown'}`)
      }

      if (error instanceof AxiosError) {
        return {
          success: false,
          status: error.response?.status,
          error: error.message,
          latency,
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * DeepSeek Dedicated Forward
   */
  private async forwardDeepSeek(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=deepseek | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      const transformedRequest = {
        ...request,
        messages: transformed.messages,
        tools: transformed.tools,
      }

      const adapter = new DeepSeekAdapter(provider, account)
      
      const { response, sessionId } = await adapter.chatCompletion({
        model: request.model,
        messages: transformedRequest.messages as any,
        stream: transformedRequest.stream,
        temperature: transformedRequest.temperature,
        web_search: transformedRequest.web_search,
        reasoning_effort: transformedRequest.reasoning_effort,
      })

      const latency = Date.now() - startTime

      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        if (response.data) {
          if (typeof response.data === 'string') {
            errorMessage = response.data
          } else if (response.data.msg) {
            errorMessage = response.data.msg
          } else if (response.data.error?.message) {
            errorMessage = response.data.error.message
          }
        }
        return {
          success: false,
          status: response.status,
          error: errorMessage,
          latency,
        }
      }

      // Prepare callback for deleting session
      const deleteSessionCallback = shouldDeleteSession()
        ? async () => {
            try {
              await adapter.deleteSession(sessionId)
            } catch (error) {
              console.error('[DeepSeek] Failed to delete session:', error)
            }
          }
        : undefined

      // DeepSeek always returns streaming response
      const handler = new DeepSeekStreamHandler(
        actualModel,
        sessionId,
        deleteSessionCallback,
        transformedRequest.web_search,
        transformedRequest.reasoning_effort,
        transformed.plan,
        request.model
      )
      
      if (request.stream) {
        const transformedStream = await handler.handleStream(response.data)
        
        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: transformedStream,
          skipTransform: true,
          latency,
          providerSessionId: sessionId,
        }
      }

      // Non-streaming requests need to collect stream data and convert
      const result = await handler.handleNonStream(response.data)
      
      this.applyToolCallsToResponse(result, transformed)
      
      if (deleteSessionCallback) {
        await deleteSessionCallback()
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: result,
        latency,
        providerSessionId: sessionId,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * GLM Dedicated Forward
   */
  private async forwardGLM(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=glm | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      const transformedRequest = {
        ...request,
        messages: transformed.messages,
        tools: transformed.tools,
      }

      proxyDebugLog(`[Forwarder] GLM request tools=${JSON.stringify(transformedRequest.tools)?.slice(0, 500)}, tool_choice=${JSON.stringify(request.tool_choice)}, messages=${JSON.stringify(transformedRequest.messages)?.slice(0, 500)}`)

      const adapter = new GLMAdapter(provider, account)
      const { response, conversationId } = await adapter.chatCompletion({
        model: actualModel,
        originalModel: request.model,
        messages: transformedRequest.messages,
        stream: transformedRequest.stream,
        temperature: transformedRequest.temperature,
        web_search: transformedRequest.web_search,
        reasoning_effort: transformedRequest.reasoning_effort,
        deep_research: transformedRequest.deep_research,
      })

      const latency = Date.now() - startTime

      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        if (response.data) {
          if (typeof response.data === 'string') {
            errorMessage = response.data
          } else if (response.data.msg) {
            errorMessage = response.data.msg
          } else if (response.data.message) {
            errorMessage = response.data.message
          } else if (response.data.error?.message) {
            errorMessage = response.data.error.message
          }
        }
        return {
          success: false,
          status: response.status,
          error: errorMessage,
          latency,
        }
      }

      const handler = new GLMStreamHandler(actualModel, undefined, undefined, transformed.plan)
      
      if (request.stream) {
        const transformedStream = await handler.handleStream(response.data)

        // If delete session after chat is enabled, we need to handle it after stream ends
        if (shouldDeleteSession()) {
          const originalEnd = transformedStream.end.bind(transformedStream)
          transformedStream.end = function(chunk?: any, encoding?: any, callback?: any) {
            const convId = handler.getConversationId()
            if (convId) {
              adapter.deleteConversation(convId).catch(err => {
                console.error('[GLM] Failed to delete session:', err)
              })
            }
            return originalEnd(chunk, encoding, callback)
          }
        }
        
        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: transformedStream,
          skipTransform: true,
          latency,
          providerSessionId: handler.getConversationId(),
        }
      }

      const result = await handler.handleNonStream(response.data)
      
      this.applyToolCallsToResponse(result, transformed)
      
      if (shouldDeleteSession()) {
        const convId = handler.getConversationId()
        if (convId) {
          await adapter.deleteConversation(convId)
        }
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: result,
        latency,
        providerSessionId: handler.getConversationId() ?? undefined,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  private async forwardKimi(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=kimi | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      
      const adapter = new KimiAdapter(provider, account)
      const { response, conversationId } = await adapter.chatCompletion({
        model: actualModel,
        originalModel: request.model,
        messages: transformed.messages,
        stream: request.stream,
        temperature: request.temperature,
        enableThinking: !!request.reasoning_effort,
        enableWebSearch: !!request.web_search,
      })

      const latency = Date.now() - startTime

      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        return {
          success: false,
          status: response.status,
          error: errorMessage,
          latency,
        }
      }

      const handler = new KimiStreamHandler(actualModel, conversationId, !!request.reasoning_effort, transformed.plan)
      
      if (request.stream) {
        const transformedStream = await handler.handleStream(response.data)
        
        // Add delete conversation callback if needed
        if (shouldDeleteSession()) {
          const originalEnd = transformedStream.end.bind(transformedStream)
          transformedStream.end = function(chunk?: any, encoding?: any, callback?: any) {
            const realChatId = handler.getConversationId()
            if (realChatId) {
              adapter.deleteConversation(realChatId).catch(err => {
                console.error('[Kimi] Failed to delete conversation:', err)
              })
            }
            return originalEnd(chunk, encoding, callback)
          }
        }
        
        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: transformedStream,
          skipTransform: true,
          latency,
          providerSessionId: handler.getConversationId() ?? undefined,
        }
      }

      const result = await handler.handleNonStream(response.data)

      this.applyToolCallsToResponse(result, transformed)

      if (shouldDeleteSession()) {
        const realChatId = handler.getConversationId()
        if (realChatId) {
          await adapter.deleteConversation(realChatId)
        }
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: result,
        latency,
        providerSessionId: handler.getConversationId() ?? undefined,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * Qwen Dedicated Forward
   */
  private async forwardQwen(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=qwen | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      const transformedRequest = {
        ...request,
        messages: transformed.messages,
        tools: transformed.tools,
      }

      const adapter = new QwenAdapter(provider, account)
      const { response, sessionId, reqId } = await adapter.chatCompletion({
        model: actualModel,
        originalModel: request.model,
        messages: transformedRequest.messages as any,
        stream: request.stream,
        temperature: request.temperature,
        enableThinking: !!request.reasoning_effort,
        enableWebSearch: !!request.web_search,
      })

      const latency = Date.now() - startTime

      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        return {
          success: false,
          status: response.status,
          error: errorMessage,
          latency,
        }
      }

      const deleteSessionCallback = shouldDeleteSession()
        ? async (sid: string) => {
            try {
              await adapter.deleteSession(sid)
            } catch (err) {
              console.error('[Qwen] Failed to delete session:', err)
            }
          }
        : undefined

      const handler = new QwenStreamHandler(actualModel, deleteSessionCallback, transformed.plan)

      if (request.stream) {
        const transformedStream = await handler.handleStream(response.data, response)

        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: transformedStream,
          skipTransform: true,
          latency,
          providerSessionId: sessionId,
        }
      }

      const result = await handler.handleNonStream(response.data, response)

      this.applyToolCallsToResponse(result, transformed)

      const sid = handler.getSessionId()
      if (deleteSessionCallback && sid) {
        await deleteSessionCallback(sid)
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: result,
        latency,
        providerSessionId: sessionId,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * Qwen AI (International) Dedicated Forward
   */
  private async forwardQwenAi(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=qwen-ai | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      
      const adapter = new QwenAiAdapter(provider, account)
      const { response, chatId, parentId } = await adapter.chatCompletion({
        model: actualModel,
        originalModel: request.model,
        messages: transformed.messages as any,
        stream: request.stream,
        temperature: request.temperature,
        enable_thinking: !!request.reasoning_effort,
      })

      const latency = Date.now() - startTime

      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        return {
          success: false,
          status: response.status,
          error: errorMessage,
          latency,
        }
      }

      const handler = new QwenAiStreamHandler(actualModel)
      handler.setChatId(chatId)

      if (request.stream) {
        const transformedStream = await handler.handleStream(response.data)

        if (shouldDeleteSession()) {
          const originalEnd = transformedStream.end.bind(transformedStream)
          transformedStream.end = function(chunk?: any, encoding?: any, callback?: any) {
            adapter.deleteChat(chatId).catch(err => {
              console.error('[QwenAI] Failed to delete chat:', err)
            })
            return originalEnd(chunk, encoding, callback)
          }
        }

        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: transformedStream,
          skipTransform: true,
          latency,
          providerSessionId: chatId,
        }
      }

      const result = await handler.handleNonStream(response.data)

      this.applyToolCallsToResponse(result, transformed)

      if (shouldDeleteSession()) {
        await adapter.deleteChat(chatId)
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: result,
        latency,
        providerSessionId: chatId,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * Z.ai Dedicated Forward
   */
  private async forwardZai(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=zai | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    proxyDebugLog('[forwardZai] actualModel:', actualModel)
    proxyDebugLog('[forwardZai] provider.modelMappings:', provider.modelMappings)
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      
      const adapter = new ZaiAdapter(provider, account)
      const { response, chatId, requestId } = await adapter.chatCompletion({
        model: actualModel,
        originalModel: request.model,
        messages: transformed.messages as any,
        stream: request.stream,
        temperature: request.temperature,
        web_search: request.web_search,
        reasoning_effort: request.reasoning_effort,
      })

      const latency = Date.now() - startTime

      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        return {
          success: false,
          status: response.status,
          error: errorMessage,
          latency,
        }
      }

      const deleteChatCallback = shouldDeleteSession()
        ? async (cid: string) => {
            try {
              await adapter.deleteChat(cid)
            } catch (error) {
              console.error('[Z.ai] Failed to delete chat:', error)
            }
          }
        : undefined

      const handler = new ZaiStreamHandler(actualModel, deleteChatCallback)
      handler.setChatId(chatId)
      
      if (request.stream === true) {
        const transformedStream = await handler.handleStream(response.data)
        
        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: transformedStream,
          skipTransform: true,
          latency,
          providerSessionId: chatId,
        }
      }

      const result = await handler.handleNonStream(response.data)

      this.applyToolCallsToResponse(result, transformed)
      
      if (deleteChatCallback) {
        await deleteChatCallback(chatId)
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: result,
        latency,
        providerSessionId: chatId,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * MiniMax Dedicated Forward
   */
  private async forwardMiniMax(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=minimax | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    proxyDebugLog('[forwardMiniMax] actualModel:', actualModel)
    proxyDebugLog('[forwardMiniMax] provider.modelMappings:', provider.modelMappings)
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      
      const adapter = new MiniMaxAdapter(provider, account)
      const { response, stream, chatId } = await adapter.chatCompletion({
        model: actualModel,
        messages: transformed.messages as any,
        stream: request.stream,
        temperature: request.temperature,
      })

      const latency = Date.now() - startTime

      if (response && response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        return {
          success: false,
          status: response.status,
          error: errorMessage,
          latency,
        }
      }

      const deleteChatCallback = shouldDeleteSession()
        ? async (cid: string) => {
            try {
              await adapter.deleteChat(cid)
            } catch (error) {
              console.error('[MiniMax] Failed to delete chat:', error)
            }
          }
        : undefined

      if (request.stream === true && stream) {
        proxyDebugLog('[forwardMiniMax] Using polling stream')
        
        if (deleteChatCallback) {
          const originalStream = stream.stream as unknown as PassThrough
          const originalEnd = originalStream.end.bind(originalStream)
          originalStream.end = function(chunk?: any, encoding?: any, callback?: any) {
            deleteChatCallback(chatId).catch(err => {
              console.error('[MiniMax] Failed to delete chat:', err)
            })
            return originalEnd(chunk, encoding, callback)
          }
        }
        
        return {
          success: true,
          status: 200,
          headers: {},
          stream: stream.stream as any,
          skipTransform: true,
          latency,
          providerSessionId: chatId,
        }
      }

      if (response) {
        this.applyToolCallsToResponse(response.data, transformed)
        
        if (deleteChatCallback) {
          await deleteChatCallback(chatId)
        }

        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          body: response.data,
          latency,
          providerSessionId: chatId,
        }
      }

      return {
        success: false,
        error: '未收到响应或流数据',
        latency,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * Mimo Dedicated Forward
   * Uses Mimo adapter for Xiaomi AI Studio
   */
  private async forwardMimo(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=mimo | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      const transformedRequest = {
        ...request,
        messages: transformed.messages,
        tools: transformed.tools,
      }
      const adapter = new MimoAdapter(provider, account)

      const { response, conversationId, query } = await adapter.chatCompletion({
        model: actualModel,
        originalModel: request.originalModel,
        messages: transformedRequest.messages as any,
        stream: transformedRequest.stream,
        temperature: transformedRequest.temperature,
      })

      const latency = Date.now() - startTime

      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`
        return {
          success: false,
          status: response.status,
          error: errorMessage,
          latency,
        }
      }

      const deleteSessionCallback = shouldDeleteSession()
        ? async (sessionId: string) => {
            try {
              await adapter.deleteSession(sessionId)
            } catch (error) {
              console.error('[Mimo] Failed to delete session:', error)
            }
          }
        : undefined

      const handler = new MimoStreamHandler(actualModel, conversationId, 'separate', transformed.plan)

      if (request.stream) {
        const transformedStream = new PassThrough()
        const openAIStream = handler.handleStream(response.data)

        ;(async () => {
          try {
            for await (const chunk of openAIStream) {
              transformedStream.write(chunk)
            }
            await adapter.generateConversationTitle(
              conversationId,
              query,
              handler.getAssistantContentForTitle()
            )
            if (deleteSessionCallback) {
              await deleteSessionCallback(conversationId)
            }
            transformedStream.end()
          } catch (error) {
            console.error('[Mimo] Stream error:', error)
            transformedStream.end()
          }
        })()

        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: transformedStream,
          skipTransform: true,
          latency,
          providerSessionId: conversationId,
        }
      }

      const result = await handler.handleNonStream(response.data)
      const parsedResult = JSON.parse(result)
      this.applyToolCallsToResponse(parsedResult, transformed)
      await adapter.generateConversationTitle(
        conversationId,
        query,
        handler.getAssistantContentForTitle()
      )
      if (deleteSessionCallback) {
        await deleteSessionCallback(conversationId)
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: parsedResult,
        skipTransform: true,
        latency,
        providerSessionId: conversationId,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      console.error('[Mimo] Forward error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * Perplexity Dedicated Forward
   * Uses Electron's net API to bypass Cloudflare protection
   */
  private async forwardPerplexity(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    const logConfig = storeManager.getConfig().requestLogConfig
    if (logConfig.logToConsole) {
      console.log(`[API-REQ] ${provider.name} | forwarder=perplexity | model=${actualModel} | stream=${request.stream} | body=${JSON.stringify(request).slice(0, 500)}`)
    }
    proxyDebugLog('[forwardPerplexity] actualModel:', actualModel)
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      
      const adapter = new PerplexityAdapter(provider, account)
      
      const { stream, sessionId } = await adapter.chatCompletion({
        model: actualModel,
        messages: transformed.messages as any,
        stream: request.stream,
        temperature: request.temperature,
      })

      const latency = Date.now() - startTime

      if (request.stream === true) {
        const deleteSessionCallback = shouldDeleteSession()
          ? async () => {
              try {
                await adapter.deleteSession(sessionId)
              } catch (error) {
                console.error('[Perplexity] Failed to delete session:', error)
              }
            }
          : undefined

        const handler = new PerplexityStreamHandler(actualModel, sessionId, deleteSessionCallback, adapter)
        const transformedStream = await handler.handleStream(stream)
        
        return {
          success: true,
          status: 200,
          headers: {},
          stream: transformedStream as any,
          skipTransform: true,
          latency,
          providerSessionId: sessionId,
        }
      }

      const handler = new PerplexityStreamHandler(actualModel, sessionId, undefined, adapter)
      const result = await handler.handleNonStream(stream)
      
      this.applyToolCallsToResponse(result, transformed)
      
      if (shouldDeleteSession()) {
        await adapter.deleteSession(sessionId)
      }
      
      return {
        success: true,
        status: 200,
        headers: {},
        body: result,
        latency,
        providerSessionId: sessionId,
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * StepFun Dedicated Forward
   * Uses standard OpenAI-compatible API format
   */
  private async forwardStepFun(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    proxyDebugLog('[StepFun][DIAG-FWD] forwardStepFun ENTRY, stream=', request.stream, 'model=', actualModel, 'provider.id=', provider.id, 'provider.apiEndpoint=', provider.apiEndpoint)
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      const transformedRequest = {
        ...request,
        messages: transformed.messages,
        tools: transformed.tools,
      }
      proxyDebugLog('[StepFun][DIAG-FWD] toolCalling transformed, messageCount=', transformedRequest.messages?.length, 'toolCount=', transformedRequest.tools?.length)

      const decryptedAccount = storeManager.getAccountById(account.id, true) || account
      const adapter = new StepFunAdapter(provider, decryptedAccount)
      proxyDebugLog('[StepFun][DIAG-FWD] calling adapter.chatCompletion...')
      const result = await adapter.chatCompletion({
        model: actualModel,
        messages: transformedRequest.messages as any,
        stream: transformedRequest.stream,
        temperature: transformedRequest.temperature,
        reasoning_effort: transformedRequest.reasoning_effort,
        max_tokens: transformedRequest.max_tokens,
        top_p: transformedRequest.top_p,
        frequency_penalty: transformedRequest.frequency_penalty,
        stop: toStopArray(transformedRequest.stop),
        n: transformedRequest.n,
        tools: transformedRequest.tools ?? [],
        tool_choice: transformedRequest.tool_choice,
      })
      proxyDebugLog('[StepFun][DIAG-FWD] adapter returned! result.success=', result.success, 'status=', result.status, 'hasStream=', !!result.stream, 'hasBody=', !!result.body, 'error=', (result.error || '').slice(0, 200))

      const latency = Date.now() - startTime
      proxyDebugLog('[StepFun][DIAG-FWD] request.stream=', request.stream, 'result.stream type=', result.stream?.constructor?.name)

      if (!result.success) {
        return {
          success: false,
          status: result.status,
          error: result.error || '请求失败',
          latency,
        }
      }

      if (result.stream) {
        proxyDebugLog('[StepFun][DIAG-FWD] adapter returned stream, consuming via handleStream, request.stream=', request.stream)
        const handler = new StepFunStreamHandler(actualModel, null, transformed.plan)
        const transformedStream = await handler.handleStream(result.stream)

        if (request.stream) {
          proxyDebugLog('[StepFun][DIAG-FWD] stream mode, returning transformedStream')
          return {
            success: true,
            status: result.status || 200,
            headers: result.headers || {},
            stream: transformedStream,
            skipTransform: true,
            latency,
          }
        }

        // Non-stream request but adapter always returns gRPC-Web stream.
        // Consume the transformed SSE stream into a single response body.
        proxyDebugLog('[StepFun][DIAG-FWD] non-stream request, consuming transformedStream into body')
        const chunks: Buffer[] = []
        for await (const chunk of transformedStream) {
          chunks.push(Buffer.from(chunk))
        }
        const bodyText = Buffer.concat(chunks).toString('utf-8')

        let fullContent = ''
        const lines = bodyText.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            if (delta?.content) fullContent += delta.content
          } catch {
            // skip unparseable
          }
        }

        const completionBody = {
          id: actualModel,
          model: actualModel,
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: fullContent },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }

        return {
          success: true,
          status: result.status || 200,
          headers: result.headers || {},
          body: completionBody,
          skipTransform: true,
          latency,
        }
      }

      proxyDebugLog('[StepFun][DIAG-FWD] no stream from adapter, falling through to non-stream path')
      const handler = new StepFunStreamHandler(actualModel, null, transformed.plan)
      proxyDebugLog('[StepFun][DIAG-FWD] non-stream: calling handleNonStream with body=', !!result.body)
      const body = await handler.handleNonStream(result.body)
      this.applyToolCallsToResponse(body, transformed)

      return {
        success: true,
        status: result.status || 200,
        headers: result.headers || {},
        body,
        skipTransform: true,
        latency,
      }
    } catch (error) {
      console.error('[StepFun][DIAG-FWD] CATCH ERROR:', error)
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  private async forwardStepFunStudio(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    proxyDebugLog('[StepFunStudio][DIAG-FWD] ENTRY, stream=', request.stream, 'model=', actualModel)
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      const transformedRequest = {
        ...request,
        messages: transformed.messages,
        tools: transformed.tools,
      }

      const decryptedAccount = storeManager.getAccountById(account.id, true) || account
      const adapter = new StepFunStudioAdapter(provider, decryptedAccount)
      const result = await adapter.chatCompletion({
        model: actualModel,
        messages: transformedRequest.messages as any,
        stream: transformedRequest.stream,
        temperature: transformedRequest.temperature,
        reasoning_effort: transformedRequest.reasoning_effort,
        max_tokens: transformedRequest.max_tokens,
        top_p: transformedRequest.top_p,
        frequency_penalty: transformedRequest.frequency_penalty,
        stop: toStopArray(transformedRequest.stop),
        n: transformedRequest.n,
        tools: transformedRequest.tools ?? [],
        tool_choice: transformedRequest.tool_choice,
      })

      const latency = Date.now() - startTime

      if (!result.success) {
        return {
          success: false,
          status: result.status,
          error: result.error || '请求失败',
          latency,
        }
      }

      if (result.stream) {
        const handler = new StepFunStreamHandler(actualModel, null, transformed.plan)
        const transformedStream = await handler.handleStream(result.stream)

        if (request.stream) {
          return {
            success: true,
            status: result.status || 200,
            headers: result.headers || {},
            stream: transformedStream,
            skipTransform: true,
            latency,
          }
        }

        const chunks: Buffer[] = []
        for await (const chunk of transformedStream) {
          chunks.push(Buffer.from(chunk))
        }
        const bodyText = Buffer.concat(chunks).toString('utf-8')

        let fullContent = ''
        for (const line of bodyText.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta
            if (delta?.content) fullContent += delta.content
          } catch {
            // skip unparseable
          }
        }

        return {
          success: true,
          status: result.status || 200,
          headers: result.headers || {},
          body: buildOpenAICompletion(fullContent, actualModel),
          skipTransform: true,
          latency,
        }
      }

      const handler = new StepFunStreamHandler(actualModel, null, transformed.plan)
      const body = await handler.handleNonStream(result.body)
      this.applyToolCallsToResponse(body, transformed)

      return {
        success: true,
        status: result.status || 200,
        headers: result.headers || {},
        body,
        skipTransform: true,
        latency,
      }
    } catch (error) {
      console.error('[StepFunStudio][DIAG-FWD] CATCH ERROR:', error)
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  // ============================================================
  // OpenAI-compatible generic forwarder factory
  // ============================================================
  /**
   * OpenAI 兼容协议的通用转发器。
   *
   * 这些适配器（openai/groq/together/mistral/xai/siliconcloud）都只暴露
   * chat() / chatStream()，没有 chatCompletion()。此前这里用 `any` 绕开类型检查
   * 去调 chatCompletion，编译能过但运行时必然 TypeError。
   */
  private createOpenAICompatibleForward(
    adapterClass: new (provider: Provider, account: Account) => {
      chat: (request: any) => Promise<any>
      chatStream: (request: any) => AsyncGenerator<string, void, unknown>
    },
    providerName: string
  ) {
    return async (
      request: ChatCompletionRequest,
      account: Account,
      provider: Provider,
      actualModel: string,
      startTime: number
    ): Promise<ForwardResult> => {
      try {
        const transformed = this.transformRequestForPromptToolUse(request, provider)
        const transformedRequest = {
          ...request,
          messages: transformed.messages,
          tools: transformed.tools,
        }

        const adapter = new adapterClass(provider, account)
        const upstreamRequest = {
          model: actualModel,
          messages: transformedRequest.messages as any,
          stream: transformedRequest.stream,
          temperature: transformedRequest.temperature,
          max_tokens: transformedRequest.max_tokens,
          top_p: transformedRequest.top_p,
          frequency_penalty: transformedRequest.frequency_penalty,
          presence_penalty: transformedRequest.presence_penalty,
          stop: toStopArray(transformedRequest.stop),
          n: transformedRequest.n,
          tools: transformedRequest.tools,
          tool_choice: transformedRequest.tool_choice,
        }

        if (transformedRequest.stream) {
          const latency = Date.now() - startTime
          const transformedStream = this.rawEventStreamToOpenAI(
            adapter.chatStream(upstreamRequest),
            actualModel,
            (raw) => {
              const parsed = JSON.parse(raw)
              const delta = parsed?.choices?.[0]?.delta
              return typeof delta?.content === 'string' ? delta.content : ''
            }
          )
          return {
            success: true,
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            stream: transformedStream,
            skipTransform: true,
            latency,
          }
        }

        const data = await adapter.chat(upstreamRequest)
        const latency = Date.now() - startTime

        const choice = data?.choices?.[0]
        const body: Record<string, any> = {
          id: data?.id ?? `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: data?.created ?? Math.floor(Date.now() / 1000),
          model: actualModel,
          choices: data?.choices ?? [
            { index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' },
          ],
          usage: data?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }
        if (choice?.message?.tool_calls) {
          body.choices[0].message.tool_calls = choice.message.tool_calls
        }
        this.applyToolCallsToResponse(body, transformed)

        return {
          success: true,
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body,
          skipTransform: true,
          latency,
        }
      } catch (error) {
        console.error(`[${providerName}][DIAG-FWD] CATCH ERROR:`, error)
        const latency = Date.now() - startTime
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
          latency,
        }
      }
    }
  }

  private forwardOpenAI = this.createOpenAICompatibleForward(OpenAIAdapter, 'OpenAI')
  private forwardGroq = this.createOpenAICompatibleForward(GroqAdapter, 'Groq')
  private forwardTogether = this.createOpenAICompatibleForward(TogetherAdapter, 'Together')
  private forwardMistral = this.createOpenAICompatibleForward(MistralAdapter, 'Mistral')
  private forwardXAI = this.createOpenAICompatibleForward(XAIAdapter, 'XAI')
  private forwardSiliconCloud = this.createOpenAICompatibleForward(SiliconCloudAdapter, 'SiliconCloud')

  // ============================================================
  // Specialized forwarders for non-OpenAI-compatible providers
  // ============================================================

  /**
   * 各家 chatStream 产出的都是「已剥离 data: 前缀的裸事件串」，这里统一转成 OpenAI SSE。
   * extractText 由各家协议自己决定怎么取文本。
   */
  private rawEventStreamToOpenAI(
    source: AsyncGenerator<string, void, unknown>,
    model: string,
    extractText: (raw: string) => string
  ): PassThrough {
    const output = new PassThrough()
    void (async () => {
      try {
        for await (const raw of source) {
          let text = ''
          try {
            text = extractText(raw)
          } catch {
            text = ''
          }
          if (text) output.write(buildOpenAIStreamChunk(text, model, false))
        }
        output.write(buildOpenAIStreamChunk('', model, true))
        output.write('data: [DONE]\n\n')
        output.end()
      } catch (error) {
        output.destroy(error instanceof Error ? error : new Error(String(error)))
      }
    })()
    return output
  }

  /** Anthropic SSE 事件 → 文本 */
  private anthropicStreamToOpenAI(
    source: AsyncGenerator<string, void, unknown>,
    model: string
  ): PassThrough {
    return this.rawEventStreamToOpenAI(source, model, (raw) => {
      const parsed = JSON.parse(raw)
      if (parsed?.type === 'content_block_delta') {
        return typeof parsed?.delta?.text === 'string' ? parsed.delta.text : ''
      }
      return ''
    })
  }

  /** Anthropic Messages 响应 → OpenAI completion */
  private anthropicToOpenAICompletion(data: any, model: string): Record<string, unknown> {
    const blocks = data?.content ?? []
    const content = Array.isArray(blocks)
      ? blocks.map((b: any) => (b?.type === 'text' ? String(b.text ?? '') : '')).join('')
      : ''
    const body = buildOpenAICompletion(content, model)
    body.usage = {
      prompt_tokens: data?.usage?.input_tokens ?? 0,
      completion_tokens: data?.usage?.output_tokens ?? 0,
      total_tokens: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0),
    }
    return body
  }

  private async forwardAnthropic(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    try {
      const adapter = new AnthropicAdapter(provider, account)
      const anthropicRequest = {
        model: actualModel,
        max_tokens: request.max_tokens ?? 4096,
        messages: request.messages as any,
        stream: request.stream,
        temperature: request.temperature,
        top_p: request.top_p,
        stop_sequences: toStopArray(request.stop),
      }

      const latency0 = Date.now() - startTime

      if (request.stream) {
        const stream = adapter.chatStream(anthropicRequest)
        const transformedStream = this.anthropicStreamToOpenAI(stream, actualModel)
        return {
          success: true,
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          stream: transformedStream,
          skipTransform: true,
          latency: latency0,
        }
      }

      const data = await adapter.chat(anthropicRequest)
      const latency = Date.now() - startTime

      return {
        success: true,
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: this.anthropicToOpenAICompletion(data, actualModel),
        skipTransform: true,
        latency,
      }
    } catch (error) {
      console.error('[Anthropic][DIAG-FWD] CATCH ERROR:', error)
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }


  private async forwardGoogle(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    try {
      const adapter = new GoogleAdapter(provider, account)
      const geminiRequest: GeminiRequest = {
        contents: toGeminiContents(request.messages),
        generationConfig: {
          temperature: request.temperature,
          topP: request.top_p,
          maxOutputTokens: request.max_tokens,
          stopSequences: toStopArray(request.stop),
        },
      }

      const latency0 = Date.now() - startTime

      if (request.stream) {
        const stream = adapter.chatStream(geminiRequest, actualModel)
        const transformedStream = this.rawEventStreamToOpenAI(stream, actualModel, (raw) => {
          const parsed = JSON.parse(raw)
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
          return typeof text === 'string' ? text : ''
        })
        return {
          success: true,
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          stream: transformedStream,
          skipTransform: true,
          latency: latency0,
        }
      }

      const data = await adapter.chat(geminiRequest, actualModel)
      const latency = Date.now() - startTime
      const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''

      return {
        success: true,
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: buildOpenAICompletion(content, actualModel),
        skipTransform: true,
        latency,
      }
    } catch (error) {
      console.error('[Google][DIAG-FWD] CATCH ERROR:', error)
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }


  private async forwardOllama(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    try {
      const adapter = new OllamaAdapter(provider, account)
      const ollamaRequest = {
        model: actualModel,
        messages: request.messages as any,
        stream: request.stream,
        options: {
          temperature: request.temperature,
          top_p: request.top_p,
          num_ctx: request.max_tokens,
          stop: toStopArray(request.stop),
        },
      }

      const latency0 = Date.now() - startTime

      if (request.stream) {
        const stream = adapter.chatStream(ollamaRequest)
        const transformedStream = this.rawEventStreamToOpenAI(stream, actualModel, (raw) => {
          const parsed = JSON.parse(raw)
          const text = parsed?.message?.content
          return typeof text === 'string' ? text : ''
        })
        return {
          success: true,
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          stream: transformedStream,
          skipTransform: true,
          latency: latency0,
        }
      }

      const data = await adapter.chat(ollamaRequest)
      const latency = Date.now() - startTime

      return {
        success: true,
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: buildOpenAICompletion(data?.message?.content ?? '', actualModel),
        skipTransform: true,
        latency,
      }
    } catch (error) {
      console.error('[Ollama][DIAG-FWD] CATCH ERROR:', error)
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }


  private async forwardCoze(
    request: ChatCompletionRequest,
    account: Account,
    provider: Provider,
    actualModel: string,
    startTime: number
  ): Promise<ForwardResult> {
    try {
      const transformed = this.transformRequestForPromptToolUse(request, provider)
      const transformedRequest = {
        ...request,
        messages: transformed.messages,
        tools: transformed.tools,
      }

      const adapter = new CozeAdapter(provider, account)
      const cozeRequest = {
        bot_id: actualModel,
        user_id: account.id || 'default',
        stream: transformedRequest.stream,
        auto_save_history: true,
        additional_messages: transformedRequest.messages as any,
      }

      const latency0 = Date.now() - startTime

      if (transformedRequest.stream) {
        const stream = adapter.chatStream(cozeRequest)
        const transformedStream = this.rawEventStreamToOpenAI(stream, actualModel, (raw) => {
          const parsed = JSON.parse(raw)
          if (parsed?.event !== 'conversation.message.delta') return ''
          return typeof parsed?.data?.content === 'string' ? parsed.data.content : ''
        })
        return {
          success: true,
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          stream: transformedStream,
          skipTransform: true,
          latency: latency0,
        }
      }

      const data = await adapter.chat(cozeRequest)
      const latency = Date.now() - startTime

      if (data?.code != null && data.code !== 0) {
        return {
          success: false,
          status: 502,
          error: data.msg || 'Coze 请求失败',
          latency,
        }
      }

      const body = buildOpenAICompletion(data?.data?.content ?? '', actualModel)
      this.applyToolCallsToResponse(body, transformed)

      return {
        success: true,
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body,
        skipTransform: true,
        latency,
      }
    } catch (error) {
      console.error('[Coze][DIAG-FWD] CATCH ERROR:', error)
      const latency = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  // ============================================================
  // URL / Headers / Body builders
  // ============================================================

  /**
   * Build URL
   */
  private buildUrl(provider: Provider, path: string): string {
    let baseUrl = provider.apiEndpoint

    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1)
    }

    if (!path.startsWith('/')) {
      path = '/' + path
    }

    if (baseUrl.includes('/v1') && path.startsWith('/v1')) {
      path = path.slice(3)
    }

    return `${baseUrl}${path}`
  }

  /**
   * Build Request Headers
   */
  private buildHeaders(provider: Provider, account: Account): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...provider.headers,
    }

    const credentials = account.credentials

    if (credentials.token) {
      headers['Authorization'] = `Bearer ${credentials.token}`
    } else if (credentials.apiKey) {
      headers['Authorization'] = `Bearer ${credentials.apiKey}`
    } else if (credentials.accessToken) {
      headers['Authorization'] = `Bearer ${credentials.accessToken}`
    } else if (credentials.refreshToken) {
      headers['Authorization'] = `Bearer ${credentials.refreshToken}`
    }

    if (credentials.cookie) {
      headers['Cookie'] = credentials.cookie
    }

    if (credentials.sessionKey) {
      headers['X-Session-Key'] = credentials.sessionKey
    }

    return headers
  }

  /**
   * Build Request Body
   */
  private buildRequestBody(
    request: ChatCompletionRequest,
    actualModel: string,
    account: Account
  ): any {
    const body: any = {
      model: actualModel,
      messages: request.messages,
      stream: request.stream || false,
    }

    if (request.temperature !== undefined) {
      body.temperature = request.temperature
    }

    if (request.top_p !== undefined) {
      body.top_p = request.top_p
    }

    if (request.n !== undefined) {
      body.n = request.n
    }

    if (request.stop !== undefined) {
      body.stop = request.stop
    }

    if (request.max_tokens !== undefined) {
      body.max_tokens = request.max_tokens
    }

    if (request.presence_penalty !== undefined) {
      body.presence_penalty = request.presence_penalty
    }

    if (request.frequency_penalty !== undefined) {
      body.frequency_penalty = request.frequency_penalty
    }

    if (request.logit_bias !== undefined) {
      body.logit_bias = request.logit_bias
    }

    if (request.user !== undefined) {
      body.user = request.user
    }

    return body
  }

  /**
   * Extract Response Headers
   */
  private extractHeaders(headers: any): Record<string, string> {
    const result: Record<string, string> = {}

    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        result[key] = value
      } else if (Array.isArray(value)) {
        result[key] = value.join(', ')
      }
    }

    return result
  }

  /**
   * Extract Error Message
   */
  private extractErrorMessage(response: AxiosResponse): string {
    if (response.data) {
      if (typeof response.data === 'string') {
        return response.data
      }

      if (response.data.error?.message) {
        return response.data.error.message
      }

      if (response.data.message) {
        return response.data.message
      }

      if (response.data.msg) {
        return response.data.msg
      }

      try {
        return JSON.stringify(response.data)
      } catch {
        return '未知错误'
      }
    }

    return `HTTP ${response.status}`
  }

  /**
   * Delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Forward Request to Specified URL
   */
  async forwardToUrl(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    isStream: boolean = false
  ): Promise<ForwardResult> {
    const startTime = Date.now()

    try {
      const config: AxiosRequestConfig = {
        method,
        url,
        headers,
        data: body,
        timeout: proxyStatusManager.getConfig().timeout,
        responseType: isStream ? 'stream' : 'json',
        validateStatus: () => true,
      }

      const response: AxiosResponse = await this.axiosInstance.request(config)
      const latency = Date.now() - startTime

      if (response.status >= 400) {
        return {
          success: false,
          status: response.status,
          error: this.extractErrorMessage(response),
          latency,
        }
      }

      if (isStream) {
        return {
          success: true,
          status: response.status,
          headers: this.extractHeaders(response.headers),
          stream: response.data,
          latency,
        }
      }

      return {
        success: true,
        status: response.status,
        headers: this.extractHeaders(response.headers),
        body: response.data,
        latency,
      }
    } catch (error) {
      const latency = Date.now() - startTime

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        latency,
      }
    }
  }

  /**
   * Merge cookie session credentials into account if available.
   * This allows web-based auth to supplement or override stored credentials.
   */
  private async maybeMergeCookieCredentials(
    account: Account,
    provider: Provider
  ): Promise<Account> {
    // provider.id 对自定义 provider 是 'custom'，ProviderType 联合里没有它，
    // 所以先按 string 判断跳过，再收窄成 ProviderType 去查 cookie 凭证。
    if (!provider.id || provider.id === 'custom') return account
    const providerType = provider.id as ProviderType

    try {
      const creds = await cookieSessionManager.getCredentials(providerType)
      if (!creds || Object.keys(creds).length === 0) return account

      proxyDebugLog(`[Forwarder][DIAG] cookie session creds for ${providerType}: keys=${Object.keys(creds).join(',')}, tokenLen=${creds.token?.length || creds['Oasis-Token']?.length || 0}`)

      // Cookie session credentials are the source of truth for session-based auth.
      // Always use the latest values from the live session (cookies may be refreshed).
      const mergedCredentials = { ...account.credentials }
      let changed = false

      for (const [key, value] of Object.entries(creds)) {
        if (!value || value.length === 0) continue
        // Skip values that are clearly invalid (e.g. quoted empty strings from cookies)
        if (/^["']+$/.test(value)) continue
        const prev = mergedCredentials[key]
        if (!prev) {
          // Fill in missing credentials
          mergedCredentials[key] = value
          changed = true
        } else if (key === 'token' || key === 'Oasis-Token') {
          // Token is short-lived; always use the latest from cookie session
          if (prev !== value) {
            mergedCredentials[key] = value
            changed = true
          }
        }
        // web_id / Oasis-Webid: don't overwrite if already present
      }

      if (changed) {
        proxyDebugLog(`[Forwarder] Updated cookie session credentials for ${providerType}:`, Object.keys(mergedCredentials).join(', '))
      }

      return { ...account, credentials: mergedCredentials }
    } catch {
      return account
    }
  }
}

export const requestForwarder = new RequestForwarder()
export default requestForwarder
