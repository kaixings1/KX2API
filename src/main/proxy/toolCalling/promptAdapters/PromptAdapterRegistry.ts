/**
 * Prompt Adapter Registry
 * Central registry for managing client-specific prompt adapters
 *
 * This is the integration point between the fork project's client detection
 * system and the current project's ToolCallingEngine.
 *
 * Usage in ToolCallingEngine.transformRequest():
 *   1. Before injecting our own prompt, ask the registry if a known client
 *      has already injected one
 *   2. If KiloCode injected its prompt → clean it, then inject our standard format
 *   3. If Cherry Studio / unknown → skip duplicate injection
 *   4. If no client detected → proceed with normal injection
 */

import { ChatMessage, ChatCompletionTool } from '../types'
import {
  PromptAdapter,
  PromptVariant,
  TransformResult,
  ParseResult,
  ToolCallFormat,
} from './BasePromptAdapter'
import { DefaultPromptAdapter, defaultPromptAdapter } from './DefaultPromptAdapter'
import { CherryStudioPromptAdapter, cherryStudioPromptAdapter } from './CherryStudioPromptAdapter'
import { KiloCodePromptAdapter, kiloCodePromptAdapter } from './KiloCodePromptAdapter'
import {
  detectClientFromContent,
  ClientType,
  hasGeneralToolPromptSignature,
} from '../../constants/signatures'

/**
 * Registry for prompt adapters
 * Manages adapter registration, client detection, and request transformation
 */
export class PromptAdapterRegistry {
  private adapters: Map<string, PromptAdapter> = new Map()
  private defaultAdapter: PromptAdapter

  constructor() {
    this.defaultAdapter = defaultPromptAdapter
    this.register(defaultPromptAdapter)
    this.register(cherryStudioPromptAdapter)
    this.register(kiloCodePromptAdapter)
  }

  /**
   * Register a prompt adapter
   */
  register(adapter: PromptAdapter): void {
    this.adapters.set(adapter.name, adapter)
    console.log(`[PromptAdapterRegistry] Registered adapter: ${adapter.name}`)
  }

  /**
   * Unregister a prompt adapter
   */
  unregister(name: string): boolean {
    return this.adapters.delete(name)
  }

  /**
   * Get adapter by name
   */
  getAdapter(name: string): PromptAdapter | undefined {
    return this.adapters.get(name)
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): PromptAdapter[] {
    return Array.from(this.adapters.values())
  }

  /**
   * Detect which client has injected the prompt from messages.
   * Returns the most appropriate adapter, or null if unknown.
   */
  detect(messages: ChatMessage[]): PromptAdapter | null {
    const allContent = this.extractAllContent(messages)

    if (!allContent) {
      return undefined
    }

    const detectionResult = detectClientFromContent(allContent)

    if (detectionResult.clientType === 'unknown') {
      return undefined
    }

    const adapter = this.findAdapterByClientType(detectionResult.clientType)

    if (adapter) {
      console.log(
        `[PromptAdapterRegistry] Detected client: ${detectionResult.clientType} (confidence: ${detectionResult.confidence.toFixed(2)})`
      )
    }

    return adapter
  }

  /**
   * Check if any known client has injected a tool prompt
   */
  hasPromptInjected(messages: ChatMessage[]): boolean {
    const allContent = this.extractAllContent(messages)
    return hasGeneralToolPromptSignature(allContent)
  }

  /**
   * Transform request using the appropriate adapter for the detected client
   *
   * This is the main entry point called by ToolCallingEngine before injecting
   * its own prompt. It handles:
   * - Detecting client-injected prompts
   * - Cleaning KiloCode's incompatible format
   * - Skipping injection if Cherry Studio already injected one
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

    // Check if any known client has already injected a prompt
    const detectedAdapter = this.detect(messages)

    if (detectedAdapter) {
      console.log(`[PromptAdapterRegistry] Using detected adapter: ${detectedAdapter.name}`)
      return detectedAdapter.transformRequest(messages, tools, model, provider)
    }

    // No known client detected — use default adapter
    console.log('[PromptAdapterRegistry] Using default adapter')
    return this.defaultAdapter.transformRequest(messages, tools, model, provider)
  }

  /**
   * Parse tool calls using the appropriate adapter
   */
  parseToolCalls(content: string, adapterName?: string): ParseResult {
    const adapter = adapterName
      ? this.adapters.get(adapterName)
      : this.detectAdapterFromContent(content)

    if (adapter) {
      return adapter.parseToolCalls(content)
    }

    return this.defaultAdapter.parseToolCalls(content)
  }

  /**
   * Get prompt variant for a specific model
   */
  getPromptVariant(model: string, provider?: string, adapterName?: string): PromptVariant | null {
    const adapter = adapterName
      ? this.adapters.get(adapterName)
      : this.defaultAdapter

    return adapter?.getPromptVariant(model, provider) || null
  }

  /**
   * Find adapter by client type
   */
  private findAdapterByClientType(clientType: ClientType): PromptAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.clientType === clientType) {
        return adapter
      }
    }
    return undefined
  }

  /**
   * Detect adapter from response content format
   */
  private detectAdapterFromContent(content: string): PromptAdapter | undefined {
    if (content.includes('<tool_use>')) {
      return this.adapters.get('cherryStudio')
    }

    if (content.includes('[function_calls]')) {
      return this.defaultAdapter
    }

    if (content.includes('<antml:function_calls>')) {
      return undefined
    }

    return undefined
  }

  /**
   * Extract all text content from messages
   */
  private extractAllContent(messages: ChatMessage[]): string {
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
}

/**
 * Singleton instance
 */
export const promptAdapterRegistry = new PromptAdapterRegistry()
