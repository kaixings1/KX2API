/**
 * OpenAI Stream Handler
 * Processes streaming SSE chunks from OpenAI-compatible APIs
 */

import { PassThrough } from 'stream'

export interface StreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      tool_calls?: any[]
    }
    finish_reason: string | null
  }>
}

export class OpenAIStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }

  static parseChunk(data: string): StreamChunk | null {
    const trimmed = data.trim()
    if (!trimmed || !trimmed.startsWith('data: ')) return null

    const jsonStr = trimmed.slice(6)
    if (jsonStr === '[DONE]') return null

    try {
      return JSON.parse(jsonStr) as StreamChunk
    } catch {
      return null
    }
  }

  static extractContent(chunk: StreamChunk): string {
    const delta = chunk.choices?.[0]?.delta
    return delta?.content || ''
  }

  static isDone(chunk: StreamChunk): boolean {
    const finishReason = chunk.choices?.[0]?.finish_reason
    return finishReason !== null && finishReason !== undefined
  }
}

export default OpenAIStreamHandler
