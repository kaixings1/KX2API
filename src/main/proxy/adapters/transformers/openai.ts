/**
 * OpenAI Request/Response Transformer
 * Converts between OpenAI format and internal format
 */

import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, ChatCompletionTool } from '../../types'

/**
 * Convert internal ChatMessage to OpenAI format
 *
 * 注意：internal 的 ChatMessage（../../types）本身就是 OpenAI 线格式，
 * 字段是 snake_case（tool_call_id / tool_calls），不是 camelCase。
 */
export function toOpenAIMessage(msg: ChatMessage): Record<string, any> {
  const result: Record<string, any> = {
    role: msg.role,
    content: msg.content,
  }

  if (msg.tool_call_id) {
    result.tool_call_id = msg.tool_call_id
  }

  if (msg.tool_calls) {
    result.tool_calls = msg.tool_calls
  }

  if (msg.name) {
    result.name = msg.name
  }

  return result
}

/**
 * Convert OpenAI response to internal format
 */
export function fromOpenAIResponse(resp: Record<string, any>): ChatCompletionResponse {
  const choice = resp.choices?.[0]
  const message = choice?.message || {}

  return {
    id: resp.id || `chatcmpl-${Date.now()}`,
    object: resp.object || 'chat.completion',
    created: resp.created || Date.now(),
    model: resp.model,
    choices: [
      {
        index: choice?.index || 0,
        message: {
          role: message.role || 'assistant',
          content: message.content,
          tool_calls: message.tool_calls,
        },
        finish_reason: choice?.finish_reason || 'stop',
      },
    ],
    usage: resp.usage
      ? {
          prompt_tokens: resp.usage.prompt_tokens,
          completion_tokens: resp.usage.completion_tokens,
          total_tokens: resp.usage.total_tokens,
        }
      : undefined,
  }
}

/**
 * Convert internal ChatCompletionRequest to OpenAI format
 */
export function fromOpenAIRequest(req: ChatCompletionRequest): Record<string, any> {
  const result: Record<string, any> = {
    model: req.model,
    messages: req.messages.map(toOpenAIMessage),
  }

  if (req.temperature !== undefined) result.temperature = req.temperature
  if (req.top_p !== undefined) result.top_p = req.top_p
  if (req.max_tokens !== undefined) result.max_tokens = req.max_tokens
  if (req.stop) result.stop = req.stop
  if (req.stream !== undefined) result.stream = req.stream
  if (req.presence_penalty !== undefined) result.presence_penalty = req.presence_penalty
  if (req.frequency_penalty !== undefined) result.frequency_penalty = req.frequency_penalty
  if (req.logit_bias) result.logit_bias = req.logit_bias
  if (req.user) result.user = req.user
  if (req.web_search) result.web_search = req.web_search
  if (req.reasoning_effort) result.reasoning_effort = req.reasoning_effort

  if (req.tools && req.tools.length > 0) {
    result.tools = req.tools.map((tool: ChatCompletionTool) => ({
      type: tool.type,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }))
  }

  if (req.tool_choice) {
    result.tool_choice = req.tool_choice
  }

  return result
}
