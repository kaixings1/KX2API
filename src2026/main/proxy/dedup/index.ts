/**
 * Request Deduplicator Module
 * Prevents duplicate identical requests from being forwarded to upstream within a time window.
 *
 * 实现原理:
 * - 注册条目时创建共享 PassThrough 流（streaming 模式）
 * - 原始请求将上游响应 pipe 到共享流
 * - 重复请求通过添加 data/end 事件监听器从同一共享流读取
 * - 流结束后仍到达的重复请求从缓冲区重放
 * - 非流式模式使用 Promise 等待原始请求结果
 */

import { PassThrough } from 'stream'

export interface RequestFingerprint {
  model: string
  messagesHash: string
  stream: boolean
}

interface DedupEntry<T> {
  waitingResolves: Array<(value: T) => void>
  resolvedValue: T | null
  resolved: boolean
  sharedStream: PassThrough
  buffer: Buffer[]
  streamEnded: boolean
  timestamp: number
  pendingCount: number
}

const DEFAULT_DEDUP_WINDOW_MS = 2000
const MAX_BUFFER_MB = 10

function computeMessagesHash(messages: any[]): string {
  try {
    const normalized = messages.map((m: any) => ({
      role: m.role,
      content:
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text || '')
                .join('')
            : '',
      tool_call_id: m.tool_call_id,
    }))
    const json = JSON.stringify(normalized)
    let hash = 0
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i)
      hash = ((hash << 5) - hash + char) | 0
    }
    return hash.toString(16)
  } catch {
    return Date.now().toString(36)
  }
}

export function computeFingerprint(request: any): RequestFingerprint {
  return {
    model: request.model || '',
    messagesHash: computeMessagesHash(request.messages || []),
    stream: !!request.stream,
  }
}

export function fingerprintToString(fp: RequestFingerprint): string {
  return `${fp.model}|${fp.messagesHash}|${fp.stream ? 's' : 'n'}`
}

export class RequestDeduplicator {
  private entries: Map<string, DedupEntry<any>> = new Map()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private windowMs: number

  constructor(windowMs: number = DEFAULT_DEDUP_WINDOW_MS) {
    this.windowMs = windowMs
    this.cleanupTimer = setInterval(() => this.cleanup(), 5000)
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    for (const [, entry] of this.entries) {
      if (!entry.sharedStream.destroyed) {
        entry.sharedStream.destroy()
      }
    }
    this.entries.clear()
  }

  setWindowMs(ms: number): void {
    this.windowMs = ms
  }

  getWindowMs(): number {
    return this.windowMs
  }

  getActiveCount(): number {
    return this.entries.size
  }

  /**
   * Check if a duplicate request exists within the dedup window.
   * Returns a promise that resolves to the shared result, or null to proceed with forwarding.
   */
  checkDuplicate<T>(fingerprint: RequestFingerprint): Promise<T> | null {
    const key = fingerprintToString(fingerprint)
    const existing = this.entries.get(key)

    if (!existing) return null
    if (Date.now() - existing.timestamp > this.windowMs) {
      console.log(`[Dedup] EXPIRED key=${key} age=${Date.now() - existing.timestamp}ms`)
      this.entries.delete(key)
      return null
    }

    existing.pendingCount++

    if (fingerprint.stream) {
      if (existing.streamEnded && existing.buffer.length > 0) {
        // Stream finished — replay from buffer
        const replay = new PassThrough()
        const data = Buffer.concat(existing.buffer)
        if (data.length > 0) replay.write(data)
        replay.end()
        console.log(`[Dedup] STREAM-REPLAY key=${key} buffered=${existing.buffer.length}chunks`)
        return Promise.resolve(replay as unknown as T).finally(() => {
          existing.pendingCount = Math.max(0, existing.pendingCount - 1)
        })
      }

      if (!existing.streamEnded) {
        // Stream still active — create a consumer that mirrors the shared stream
        console.log(`[Dedup] STREAM-MIRROR key=${key} pending=${existing.pendingCount}`)
        return new Promise<T>((resolve) => {
          const consumer = new PassThrough()

          // Replay buffered data
          for (const chunk of existing.buffer) {
            consumer.write(chunk)
          }

          // Forward future data from shared stream to this consumer
          const onData = (chunk: Buffer) => consumer.write(chunk)
          const onEnd = () => consumer.end()
          const onError = (err: Error) => {
            // Only destroy the consumer, NOT the shared stream
            // (shared stream may have other consumers)
            if (!consumer.destroyed) {
              consumer.destroy(err)
            }
          }

          existing.sharedStream.on('data', onData)
          existing.sharedStream.on('end', onEnd)
          existing.sharedStream.on('error', onError)

          // Cleanup listeners when consumer ends (avoid leak)
          consumer.on('close', () => {
            existing.sharedStream.removeListener('data', onData)
            existing.sharedStream.removeListener('end', onEnd)
            existing.sharedStream.removeListener('error', onError)
          })

          resolve(consumer as unknown as T)
        }).finally(() => {
          existing.pendingCount = Math.max(0, existing.pendingCount - 1)
        })
      }

      return null
    }

    // Non-streaming mode
    if (existing.resolved && existing.resolvedValue !== null) {
      console.log(`[Dedup] NONSTREAM-CACHED key=${key} result=success:${(existing.resolvedValue as any).success}`)
      return Promise.resolve(existing.resolvedValue).finally(() => {
        existing.pendingCount = Math.max(0, existing.pendingCount - 1)
      })
    }

    if (existing.waitingResolves.length > 0) {
      console.log(`[Dedup] NONSTREAM-WAIT key=${key} waiting=${existing.waitingResolves.length}`)
      return new Promise<T>((resolve) => {
        existing.waitingResolves.push(resolve)
      }).finally(() => {
        existing.pendingCount = Math.max(0, existing.pendingCount - 1)
      })
    }

    return null
  }

  /**
   * Register a new in-flight request and return the entry for the caller to populate.
   * For streaming requests, the caller should pipe upstream data into entry.sharedStream.
   */
  register<T>(fingerprint: RequestFingerprint): DedupEntry<T> {
    const key = fingerprintToString(fingerprint)
    const existing = this.entries.get(key)

    if (existing) {
      existing.pendingCount++
      console.log(`[Dedup] REGISTER-EXISTING key=${key} pending=${existing.pendingCount}`)
      return existing as DedupEntry<T>
    }

    const entry: DedupEntry<T> = {
      waitingResolves: [],
      resolvedValue: null,
      resolved: false,
      sharedStream: new PassThrough(),
      buffer: [],
      streamEnded: false,
      timestamp: Date.now(),
      pendingCount: 1,
    }

    this.entries.set(key, entry)
    console.log(`[Dedup] REGISTER-NEW key=${key} stream=${fingerprint.stream} active=${this.entries.size}`)

    // Buffer data from the shared stream for late-arriving duplicates
    const MAX_BUFFER_BYTES = MAX_BUFFER_MB * 1024 * 1024
    let bufferedBytes = 0

    entry.sharedStream.on('data', (chunk: Buffer) => {
      if (bufferedBytes < MAX_BUFFER_BYTES) {
        entry.buffer.push(chunk)
        bufferedBytes += chunk.length
      }
    })
    entry.sharedStream.on('end', () => {
      entry.streamEnded = true
    })
    entry.sharedStream.on('error', () => {
      entry.streamEnded = true
    })

    return entry
  }

  /**
   * Complete a non-streaming entry with the forward result.
   */
  complete<T>(key: string, entry: DedupEntry<T>, result: T): void {
    entry.pendingCount = Math.max(0, entry.pendingCount - 1)
    entry.resolved = true
    entry.resolvedValue = result

    // Resolve all waiting duplicate promises
    for (const resolve of entry.waitingResolves) {
      resolve(result)
    }
    entry.waitingResolves = []
  }

  /**
   * Complete a streaming entry. Returns the shared stream for the caller to pipe upstream into.
   */
  getSharedStream<T>(key: string, entry: DedupEntry<T>): PassThrough {
    return entry.sharedStream
  }

  /**
   * Fail an entry — destroy shared stream and reject any waiting promise.
   */
  fail<T>(key: string, entry: DedupEntry<T>, error: Error): void {
    entry.pendingCount = 0
    if (!entry.sharedStream.destroyed) {
      entry.sharedStream.destroy(error)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    for (const [key, entry] of this.entries) {
      if (now - entry.timestamp > this.windowMs + 5000 && entry.pendingCount <= 0) {
        expiredKeys.push(key)
      }
    }
    if (expiredKeys.length > 0) {
      console.log(`[Dedup] CLEANUP removed=${expiredKeys.length} active=${this.entries.size - expiredKeys.length}`)
    }
    for (const key of expiredKeys) {
      const entry = this.entries.get(key)
      if (entry && !entry.sharedStream.destroyed) {
        entry.sharedStream.destroy()
      }
      this.entries.delete(key)
    }
  }
}
