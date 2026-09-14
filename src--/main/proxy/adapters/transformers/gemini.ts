/**
 * Gemini Request/Response Transformer
 * Converts between Google Gemini API format and internal format
 */

import type { ChatMessage, ChatCompletionTool } from '../types'

/**
 * Convert internal ChatMessage to Gemini format
 */
export function toGeminiMessages(messages: ChatMessage[]): Array<{ role: string; parts: Array<{ text?: string }> }> {
  return messages.map(msg => {
    if (msg.role === 'system') {
      return {
        role: 'user',
        parts: [{ text: `[System] ${typeof msg.content === 'string' ? msg.content : ''}` }],
      }
    }

    if (msg.role === 'assistant') {
      const parts: Array<{ text?: string }> = []
      if (typeof msg.content === 'string' && msg.content) {
        parts.push({ text: msg.content })
      }
      return { role: 'model', parts }
    }

    return {
      role: 'user',
      parts: [{ text: typeof msg.content === 'string' ? msg.content : '' }],
    }
  })
}

/**
 * Convert internal tools to Gemini format
 */
export function toGeminiTools(tools: ChatCompletionTool[]): any[] {
  return tools.map(tool => ({
    functionDeclarations: [
      {
        name: tool.function.name,
        description: tool.function.description || '',
        parameters: tool.function.parameters || { type: 'object', properties: {} },
      },
    ],
  }))
}

/**
 * Convert Gemini response to internal format
 */
export function fromGeminiResponse(resp: any): any {
  const candidate = resp.candidates?.[0]
  const parts = candidate?.content?.parts || []
  let textContent = ''

  for (const part of parts) {
    if (part.text) {
      textContent += part.text
    }
  }

  return {
    id: resp.candidates?.[0]?.groundingChunks?.map?.((_: any, i: number) => `gemini-${i}`).join(',') || `gemini-${Date.now()}`,
    object: 'chat.completion',
    created: Date.now(),
    model: resp.modelVersion || '',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: textContent || null,
        },
        finish_reason: candidate?.finishReason || 'stop',
      },
    ],
    usage: resp.usageMetadata ? {
      promptTokens: resp.usageMetadata.promptTokenCount,
      completionTokens: resp.usageMetadata.candidatesTokenCount,
      totalTokens: resp.usageMetadata.totalTokenCount,
    } : undefined,
  }
}
