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

export class AuditLogger {
  private logFile: string
  private entries: AuditEntry[] = []
  private maxBufferSize: number = 100
  private flushInterval: number = 10000
  private flushTimer: ReturnType<typeof setInterval> | null = null

  constructor(logFile: string) {
    this.logFile = logFile
    this.startFlushTimer()
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

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flush()
  }
}
