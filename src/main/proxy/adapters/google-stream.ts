/**
 * Google Gemini Stream Handler
 * Processes streaming SSE chunks from Google Gemini API
 */

import { PassThrough } from 'stream'

export interface GeminiStreamChunk {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string }>
    }
    finishReason?: string
  }>
}

export class GoogleStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }

  static parseChunk(data: string): GeminiStreamChunk | null {
    const trimmed = data.trim()
    if (!trimmed) return null

    try {
      return JSON.parse(trimmed) as GeminiStreamChunk
    } catch {
      return null
    }
  }

  static extractContent(chunk: GeminiStreamChunk): string {
    const parts = chunk.candidates?.[0]?.content?.parts || []
    return parts.map(p => p.text || '').join('')
  }

  static isDone(chunk: GeminiStreamChunk): boolean {
    const finishReason = chunk.candidates?.[0]?.finishReason
    return finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS'
  }
}

export default GoogleStreamHandler
