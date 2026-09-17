/**
 * Anthropic Request/Response Transformer
 * Converts between Anthropic Messages API format and internal format
 */

import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, ChatCompletionTool } from '../../types'

/**
 * Convert internal ChatMessage array to Anthropic Messages format
 */
export function toAnthropicMessages(messages: ChatMessage[], systemPrompt?: string): {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string | any[] }>
} {
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string | any[] }> = []
  let systemContent: string | undefined

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemContent = typeof msg.content === 'string' ? msg.content : ''
      continue
    }

    if (msg.role === 'tool') {
      // Tool result messages in Anthropic format
      anthropicMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id || '',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          },
        ],
      })
    } else if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      // Assistant messages with tool calls
      const toolUseBlocks = msg.tool_calls.map((tc: any) => ({
        type: 'tool_use',
        id: tc.id || `call_${Date.now()}`,
        name: tc.function?.name || 'unknown',
        input: JSON.parse(tc.function?.arguments || '{}'),
      }))

      const textContent = typeof msg.content === 'string' ? msg.content : ''
      const content: any[] = []

      if (textContent) {
        content.push({ type: 'text', text: textContent })
      }
      content.push(...toolUseBlocks)

      anthropicMessages.push({
        role: 'assistant',
        content,
      })
    } else {
      anthropicMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: typeof msg.content === 'string' ? msg.content : '',
      })
    }
  }

  const result: any = { messages: anthropicMessages }
  if (systemContent) {
    result.system = systemContent
  }
  return result
}

/**
 * Convert Anthropic tools to internal format
 */
export function fromAnthropicTools(tools: any[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    },
  }))
}

/**
 * Convert internal tools to Anthropic format
 */
export function toAnthropicTools(tools: ChatCompletionTool[]): any[] {
  return tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description || '',
    input_schema: tool.function.parameters || { type: 'object', properties: {} },
  }))
}

/**
 * Convert Anthropic response to internal format
 */
export function fromAnthropicResponse(resp: any): ChatCompletionResponse {
  const content = resp.content || []
  let textContent: string | null = null
  const toolCalls: any[] = []

  for (const block of content) {
    if (block.type === 'text') {
      textContent = block.text
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input || {}),
        },
      })
    }
  }

  return {
    id: resp.id || `msg_${Date.now()}`,
    object: 'chat.completion',
    created: Date.now(),
    model: resp.model || '',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: textContent,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: resp.stop_reason === 'end_turn' ? 'stop' : resp.stop_reason || 'stop',
      },
    ],
    usage: resp.usage
      ? {
          prompt_tokens: resp.usage.input_tokens,
          completion_tokens: resp.usage.output_tokens,
          total_tokens: resp.usage.input_tokens + resp.usage.output_tokens,
        }
      : undefined,
  }
}
