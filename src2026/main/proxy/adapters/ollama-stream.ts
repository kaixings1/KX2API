/**
 * Ollama Stream Handler
 */

import { PassThrough } from 'stream'

export interface OllamaStreamChunk {
  model: string
  created_at: string
  message: { role: string; content: string }
  done: boolean
}

export class OllamaStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }

  static parseChunk(data: string): OllamaStreamChunk | null {
    const trimmed = data.trim()
    if (!trimmed) return null

    try {
      return JSON.parse(trimmed) as OllamaStreamChunk
    } catch {
      return null
    }
  }

  static extractContent(chunk: OllamaStreamChunk): string {
    return chunk.message?.content || ''
  }

  static isDone(chunk: OllamaStreamChunk): boolean {
    return chunk.done === true
  }
}

export default OllamaStreamHandler
