import type { ChatMessage, ChatCompletionTool, ToolCall } from '../types.ts'

// 这三个类型在本模块内部使用（见下方 ToolCallingPlan 等），
// 下游 5 个 promptAdapter 也习惯从本模块导入它们。
// 原实现只 import 不 re-export，导致下游 15 处 TS2459
//（"declares X locally, but it is not exported"）。
// 这里补上 re-export，让本模块成为 toolCalling 领域的统一类型出口。
export type { ChatMessage, ChatCompletionTool, ToolCall }

export type ToolCallingMode = 'managed' | 'disabled'
export type ToolProtocolId =
  | 'openai_chat'
  | 'managed_bracket'
  | 'managed_xml'
  | 'anthropic_tool_use'
  | 'codex_responses'

/**
 * 协议级 fallback 策略：控制流式解析器是否及何时触发纯文本兜底提取。
 *  - always: 每次收到新内容时都尝试兜底提取（默认，适合大多数协议）。
 *  - never: 完全禁用兜底提取（如 managed_xml，其结构化解析自带示例噪声过滤）。
 *  - onlyOnEmpty: 仅在协议解析器返回零工具调用时才尝试兜底。
 */
export type FallbackStrategy = 'always' | 'never' | 'onlyOnEmpty'

export type ToolSource = 'openai' | 'mcp'

export interface NormalizedToolDefinition {
  name: string
  description?: string
  parameters: Record<string, unknown>
  source: ToolSource
}

export interface NormalizedToolCall {
  id: string
  index: number
  name: string
  arguments: string
  protocol: ToolProtocolId
  rawText?: string
}

export interface NormalizedToolResult {
  toolCallId: string
  name?: string
  content: string
}

export interface ToolCallDiagnostics {
  requestId?: string
  clientAdapterId: string
  detectedClientType?: string
  providerId: string
  model?: string
  actualModel?: string
  toolSource: 'openai' | 'mcp' | 'none'
  mode: ToolCallingMode
  protocol: ToolProtocolId
  toolCount: number
  injected: boolean
  reason: string
  parserFormat?: ToolProtocolId | 'unknown'
  parsedToolCallCount?: number
  malformedReason?: string
  invalidToolNames?: string[]
  wrapperLeakDetected?: boolean
  toolChoiceMode?: 'auto' | 'none' | 'required' | 'forced'
  forcedToolName?: string
  allowedToolNames?: string[]
}

export interface ToolCallingPlan {
  mode: ToolCallingMode
  protocol: ToolProtocolId
  clientAdapterId: string
  providerId: string
  tools: NormalizedToolDefinition[]
  shouldInjectPrompt: boolean
  shouldParseResponse: boolean
  toolChoiceMode: 'auto' | 'none' | 'required' | 'forced'
  allowedToolNames: Set<string>
  forcedToolName?: string
  diagnostics: ToolCallDiagnostics
  fallbackStrategy: FallbackStrategy
}

export interface ToolCallingTransformResult {
  messages: ChatMessage[]
  /**
   * 随请求发送的工具定义。
   *
   * - 数组：正常发送（standard 模式）
   * - `null`：**显式不发送**（managed 模式 —— 工具清单已注入提示词，
   *   若再走 tools 字段，模型会同时收到两套协议）
   * - 未设置：沿用既有行为
   *
   * `null` 与「未设置」语义不同，所以这里必须允许 null。
   * 契约由 tests/tool-calling/tool-engine.test.ts 锁定。
   */
  tools?: ChatCompletionTool[] | null
  plan: ToolCallingPlan
}

export interface ToolParseContext {
  tools: NormalizedToolDefinition[]
  protocol: ToolProtocolId
}

export interface ToolParseResult {
  content: string
  toolCalls: ToolCall[]
  protocol: ToolProtocolId | 'unknown'
  rawMatches: string[]
  malformedReason?: string
  invalidToolNames: string[]
}
