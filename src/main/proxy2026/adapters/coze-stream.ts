/**
 * Coze Stream Handler
 */

import { PassThrough } from 'stream'

export interface CozeStreamEvent {
  event: string
  data: {
    id?: string
    conversation_id?: string
    bot_id?: string
    content?: string
    status?: string
    error?: string
  }
}

export class CozeStreamHandler {
  static createPassThrough(): PassThrough {
    return new PassThrough()
  }

  static parseChunk(data: string): CozeStreamEvent | null {
    const trimmed = data.trim()
    if (!trimmed || !trimmed.startsWith('event:')) return null

    const lines = trimmed.split('\n')
    const event: CozeStreamEvent = { event: '', data: {} }

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event.event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        try {
          event.data = JSON.parse(line.slice(5).trim())
        } catch {
          event.data = { content: line.slice(5).trim() }
        }
      }
    }

    return event.event ? event : null
  }

  static extractContent(chunk: CozeStreamEvent): string {
    return chunk.data?.content || ''
  }

  static isDone(chunk: CozeStreamEvent): boolean {
    return chunk.event === 'conversation.message.completed' || chunk.event === 'error'
  }
}

export default CozeStreamHandler
