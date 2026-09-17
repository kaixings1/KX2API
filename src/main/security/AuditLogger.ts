/**
 * 审计日志器
 * 将审计条目写入文件，支持缓冲和定时刷新
 */

import { promises as fs } from 'fs'
import { join } from 'path'

export type AuditLevel = 'info' | 'warning' | 'error' | 'critical'

export interface AuditEntry {
  id: string
  timestamp: Date
  level: AuditLevel
  category: string
  action: string
  userId?: string
  sessionId?: string
  tool?: string
  details: Record<string, any>
  result: 'success' | 'failure' | 'denied'
  ipAddress?: string
}

/** 审计日志默认缓冲条数（达到即落盘，默认 100） */
export const DEFAULT_AUDIT_BUFFER_SIZE = 100
/** 审计日志默认落盘间隔（毫秒，默认 10000） */
export const DEFAULT_AUDIT_FLUSH_INTERVAL_MS = 10_000

export interface AuditLoggerOptions {
  /** 缓冲达到多少条即落盘 */
  maxBufferSize?: number
  /** 定时落盘间隔（毫秒）；越短越不易丢日志，但 I/O 更频繁 */
  flushIntervalMs?: number
}

export class AuditLogger {
  private logFile: string
  private entries: AuditEntry[] = []
  private maxBufferSize: number = DEFAULT_AUDIT_BUFFER_SIZE
  private flushInterval: number = DEFAULT_AUDIT_FLUSH_INTERVAL_MS
  private flushTimer: ReturnType<typeof setInterval> | null = null

  constructor(logFile: string, options: AuditLoggerOptions = {}) {
    this.logFile = logFile
    this.setLimits(options)
    this.startFlushTimer()
  }

  /**
   * 更新审计落盘策略（设置界面改完即时生效）。
   * 缓冲越大写入越少但崩溃时可能丢失更多未落盘记录；
   * 间隔越短越安全，但频繁 I/O。
   */
  setLimits(options: AuditLoggerOptions): void {
    const { maxBufferSize, flushIntervalMs } = options
    if (
      typeof maxBufferSize === 'number' &&
      Number.isFinite(maxBufferSize) &&
      maxBufferSize > 0
    ) {
      this.maxBufferSize = Math.floor(maxBufferSize)
    }
    if (
      typeof flushIntervalMs === 'number' &&
      Number.isFinite(flushIntervalMs) &&
      flushIntervalMs > 0
    ) {
      this.flushInterval = Math.floor(flushIntervalMs)
      // 间隔变更需重建定时器才生效
      if (this.flushTimer) {
        clearInterval(this.flushTimer)
        this.startFlushTimer()
      }
    }
  }

  /** 当前落盘策略（供 UI 回显） */
  getLimits(): { maxBufferSize: number; flushIntervalMs: number } {
    return { maxBufferSize: this.maxBufferSize, flushIntervalMs: this.flushInterval }
  }

  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    const auditEntry: AuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    }

    this.entries.push(auditEntry)

    if (entry.level === 'critical' || entry.level === 'error') {
      this.flush()
    } else if (this.entries.length >= this.maxBufferSize) {
      this.flush()
    }
  }

  logToolCall(params: {
    tool: string
    action: string
    params: Record<string, any>
    result: 'success' | 'failure' | 'denied'
    userId?: string
    sessionId?: string
    error?: string
  }): void {
    this.log({
      level: params.result === 'denied' ? 'warning' : params.result === 'failure' ? 'error' : 'info',
      category: 'tool_call',
      action: params.action,
      tool: params.tool,
      userId: params.userId,
      sessionId: params.sessionId,
      details: {
        params: this.sanitizeParams(params.params),
        error: params.error,
      },
      result: params.result,
    })
  }

  logPermissionChange(params: {
    action: string
    tool: string
    decision: string
    userId?: string
    sessionId?: string
  }): void {
    this.log({
      level: 'info',
      category: 'permission',
      action: params.action,
      tool: params.tool,
      userId: params.userId,
      sessionId: params.sessionId,
      details: {
        decision: params.decision,
      },
      result: 'success',
    })
  }

  logSecurityEvent(params: {
    event: string
    severity: AuditLevel
    details: Record<string, any>
    userId?: string
    sessionId?: string
  }): void {
    this.log({
      level: params.severity,
      category: 'security',
      action: params.event,
      userId: params.userId,
      sessionId: params.sessionId,
      details: params.details,
      result: 'failure',
    })
  }

  async flush(): Promise<void> {
    if (this.entries.length === 0) return

    const entriesToFlush = [...this.entries]
    this.entries = []

    try {
      const lines = entriesToFlush
        .map((entry) => JSON.stringify(entry))
        .join('\n')

      await fs.appendFile(this.logFile, lines + '\n', 'utf-8')
    } catch (error) {
      console.error('Failed to flush audit log:', error)
      this.entries.unshift(...entriesToFlush)
    }
  }

  async query(options: {
    startTime?: Date
    endTime?: Date
    level?: AuditLevel
    category?: string
    tool?: string
    limit?: number
  } = {}): Promise<AuditEntry[]> {
    let content: string
    try {
      content = await fs.readFile(this.logFile, 'utf-8')
    } catch {
      return []
    }

    const lines = content.split('\n').filter((line) => line.trim())

    let entries: AuditEntry[] = lines.map((line) => {
      try {
        return JSON.parse(line) as AuditEntry
      } catch {
        return null
      }
    }).filter((e): e is AuditEntry => e !== null)

    if (options.startTime) {
      entries = entries.filter((e) => new Date(e.timestamp) >= options.startTime!)
    }

    if (options.endTime) {
      entries = entries.filter((e) => new Date(e.timestamp) <= options.endTime!)
    }

    if (options.level) {
      entries = entries.filter((e) => e.level === options.level)
    }

    if (options.category) {
      entries = entries.filter((e) => e.category === options.category)
    }

    if (options.tool) {
      entries = entries.filter((e) => e.tool === options.tool)
    }

    if (options.limit) {
      entries = entries.slice(-options.limit)
    }

    return entries
  }

  private sanitizeParams(params: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}
    const sensitiveKeys = ['password', 'token', 'secret', 'apikey', 'api_key']

    for (const [key, value] of Object.entries(params)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***'
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  /**
   * 只停止定时器，不触发落盘。
   *
   * 与 stop() 的区别：stop() 会顺带 flush（有 I/O 副作用，且返回浮空 Promise）。
   * 测试、临时实例、参数校验这类场景只需要释放定时器句柄
   * （否则 setInterval 会让进程/vitest 无法退出），不应附带写入。
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  /**
   * 停止定时器并落盘剩余缓冲。
   *
   * 注意：定时器不释放会让 Node 进程无法退出，因此即使 flush 失败也会
   * 先清掉句柄（用 try/finally 保证）。
   */
  async stop(): Promise<void> {
    this.stopFlushTimer()
    try {
      await this.flush()
    } catch {
      // flush 内部已处理异常（会回滚缓冲），此处不向上抛，避免退出流程被阻断
    }
  }
}
