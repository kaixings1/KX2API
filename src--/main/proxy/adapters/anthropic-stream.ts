/**
 * Anthropic Stream Handler
 * Processes streaming SSE chunks from Anthropic Messages API
 */

import { PassThrough } from 'stream'

export interface AnthropicStreamChunk {
  type: string
  index?: number
  delta?: {
    type: string
    text?: string
    partial_json?: string
    stop_reason?: string
  }
  content_block?: any
  message?: any
  usage?: {
    output_tokens: number
  }
}

export class AnthropicStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }

  static parseChunk(data: string): AnthropicStreamChunk | null {
    const trimmed = data.trim()
    if (!trimmed || !trimmed.startsWith('data: ')) return null

    const jsonStr = trimmed.slice(6)
    try {
      return JSON.parse(jsonStr) as AnthropicStreamChunk
    } catch {
      return null
    }
  }

  static extractContent(chunk: AnthropicStreamChunk): string {
    if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
      return chunk.delta.text
    }
    return ''
  }

  static isDone(chunk: AnthropicStreamChunk): boolean {
    return chunk.type === 'message_stop' || chunk.type === 'content_block_stop'
  }
}

export default AnthropicStreamHandler
