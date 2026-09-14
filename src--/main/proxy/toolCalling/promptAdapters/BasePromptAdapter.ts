/**
 * Base Prompt Adapter
 * Abstract base class for client-specific prompt adapters
 *
 * Each adapter handles:
 * - Detecting if the client has already injected tool prompts
 * - Converting tools to prompt text (client-specific format)
 * - Parsing tool calls from response content (client-specific format)
 * - Selecting the best prompt variant for a model
 */

import { ChatMessage, ChatCompletionTool, ToolCall } from '../types'
import { ClientType, detectClientFromContent } from '../../constants/signatures'

/**
 * Tool call output format
 */
export type ToolCallFormat = 'bracket' | 'xml' | 'anthropic' | 'json' | 'native'

/**
 * Prompt variant configuration
 * A variant defines how tools are presented to a specific model/provider
 */
export interface PromptVariant {
  id: string
  name: string
  description?: string
  modelPatterns: string[]
  systemPrompt: string
  toolPromptTemplate: string
  toolCallFormat: ToolCallFormat
  examples?: string[]
  priority?: number
}

/**
 * Result of prompt transformation
 */
export interface TransformResult {
  messages: ChatMessage[]
  tools: ChatCompletionTool[] | undefined
  injected: boolean
  variant?: PromptVariant
  cleaned?: boolean // true if KiloCode-style prompt was cleaned before re-injection
}

/**
 * Result of tool call parsing
 */
export interface ParseResult {
  content: string
  toolCalls: ToolCall[]
  format: ToolCallFormat
}

/**
 * Base interface for prompt adapters
 */
export interface PromptAdapter {
  name: string
  clientType: ClientType
  detectSignatures: string[]

  hasPromptInjected(messages: ChatMessage[]): boolean
  toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string
  parseToolCalls(content: string): ParseResult
  getPromptVariant(model: string, provider?: string): PromptVariant | null
  transformRequest(
    messages: ChatMessage[],
    tools: ChatCompletionTool[] | undefined,
    model: string,
    provider?: string
  ): TransformResult
}

/**
 * Abstract base class for prompt adapters
 * Provides common functionality for all adapters
 */
export abstract class BasePromptAdapter implements PromptAdapter {
  abstract name: string
  abstract clientType: ClientType
  abstract detectSignatures: string[]

  protected variants: PromptVariant[] = []

  /**
   * Check if this adapter's prompt has already been injected into messages
   */
  hasPromptInjected(messages: ChatMessage[]): boolean {
    const allContent = this.extractAllContent(messages)

    for (const sig of this.detectSignatures) {
      if (allContent.includes(sig)) {
        console.log(`[${this.name}] Detected existing prompt injection with signature: ${sig}`)
        return true
      }
    }

    return false
  }

  /**
   * Convert tools array to prompt text string
   * Must be implemented by each adapter
   */
  abstract toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string

  /**
   * Parse tool calls from response content
   * Must be implemented by each adapter
   */
  abstract parseToolCalls(content: string): ParseResult

  /**
   * Get the best prompt variant for a given model
   */
  getPromptVariant(model: string, provider?: string): PromptVariant | null {
    const lowerModel = model.toLowerCase()

    for (const variant of this.variants) {
      for (const pattern of variant.modelPatterns) {
        if (lowerModel.includes(pattern.toLowerCase())) {
          return variant
        }
      }
    }

    return null
  }

  /**
   * Transform request by injecting tool prompt into messages
   * If prompt already injected, skip injection
   */
  transformRequest(
    messages: ChatMessage[],
    tools: ChatCompletionTool[] | undefined,
    model: string,
    provider?: string
  ): TransformResult {
    if (!tools || tools.length === 0) {
      return { messages, tools: undefined, injected: false }
    }

    if (this.hasPromptInjected(messages)) {
      return { messages, tools: undefined, injected: false }
    }

    const variant = this.getPromptVariant(model, provider)
    const toolsPrompt = this.toolsToPrompt(tools, variant)

    const transformedMessages = this.injectPrompt(messages, toolsPrompt)

    return {
      messages: transformedMessages,
      tools: undefined,
      injected: true,
      variant,
    }
  }

  /**
   * Inject prompt into messages by appending to system message
   * or creating a new system message
   */
  protected injectPrompt(messages: ChatMessage[], prompt: string): ChatMessage[] {
    const result: ChatMessage[] = []
    let systemInjected = false

    for (const msg of messages) {
      if (msg.role === 'system' && !systemInjected) {
        const enhancedContent = typeof msg.content === 'string'
          ? `${msg.content}\n\n${prompt}`
          : msg.content
        result.push({ ...msg, content: enhancedContent })
        systemInjected = true
      } else {
        result.push(msg)
      }
    }

    if (!systemInjected) {
      result.unshift({ role: 'system', content: prompt })
    }

    return result
  }

  /**
   * Extract all text content from messages for signature detection
   */
  protected extractAllContent(messages: ChatMessage[]): string {
    const parts: string[] = []

    for (const msg of messages) {
      if (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          parts.push(msg.content)
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (typeof part === 'string') {
              parts.push(part)
            } else if (part && typeof part === 'object' && 'text' in part) {
              parts.push((part as { text: string }).text)
            }
          }
        }
      }
    }

    return parts.join('\n')
  }

  /**
   * Register a prompt variant
   */
  protected registerVariant(variant: PromptVariant): void {
    this.variants.push(variant)
  }
}
