import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { LogEntry, LogLevel, LogCategory, LogCategoryConfig } from '../../shared/types.ts'
import { DEFAULT_LOG_CATEGORIES } from '../../shared/types.ts'
import { IpcChannels } from '../ipc/channels'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

interface LogFilter {
  level?: LogLevel | 'all'
  category?: LogCategory | 'all'
  keyword?: string
  startTime?: number
  endTime?: number
  limit?: number
  offset?: number
}

/** 内存中保留的日志条数上限（默认 10000） */
export const DEFAULT_MAX_LOGS = 10000
/** 日志文件保留天数（默认 7） */
export const DEFAULT_RETENTION_DAYS = 7

export interface LogManagerOptions {
  /** 内存中保留的日志条数上限 */
  maxLogs?: number
  /** 日志文件保留天数 */
  retentionDays?: number
}

export class LogManager {
  private logs: LogEntry[] = []
  private logFile: string
  private debugFileStream: fs.WriteStream | null = null
  private maxLogs: number = DEFAULT_MAX_LOGS
  private retentionDays: number = DEFAULT_RETENTION_DAYS
  private initialized: boolean = false
  private mainWindow: BrowserWindow | null = null
  private categoryConfigs: Record<string, LogCategoryConfig>

  constructor(options: LogManagerOptions = {}) {
    const userDataPath = app.getPath('userData')
    const logDir = path.join(userDataPath, 'logs')

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    this.logFile = path.join(logDir, 'app.log')
    this.categoryConfigs = { ...DEFAULT_LOG_CATEGORIES }
    this.setLimits(options)
  }

  /**
   * 更新日志保留策略（设置界面改完即时生效）。
   * maxLogs 决定内存占用上限；retentionDays 决定磁盘上日志文件保留多久。
   */
  setLimits(options: LogManagerOptions): void {
    const { maxLogs, retentionDays } = options
    if (typeof maxLogs === 'number' && Number.isFinite(maxLogs) && maxLogs > 0) {
      this.maxLogs = Math.floor(maxLogs)
    }
    if (
      typeof retentionDays === 'number' &&
      Number.isFinite(retentionDays) &&
      retentionDays > 0
    ) {
      this.retentionDays = Math.floor(retentionDays)
    }
    // 上限调小后立即裁剪，避免旧数据继续驻留
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  /** 当前保留策略（供 UI 回显） */
  getLimits(): { maxLogs: number; retentionDays: number } {
    return { maxLogs: this.maxLogs, retentionDays: this.retentionDays }
  }

  /**
   * Open an additional debug log file. All debugLog() calls are appended here.
   * Pass null to disable.
   */
  setDebugFile(filePath: string | null): void {
    this.closeDebugFile()

    if (!filePath) return

    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      this.debugFileStream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf-8' })
      this.debugFileStream.write(`\n===== DEBUG LOG START ${new Date().toISOString()} =====\n`)
      console.log('[LogManager] Debug file enabled:', filePath)
    } catch (error) {
      console.error('[LogManager] Failed to open debug file:', error)
      this.debugFileStream = null
    }
  }

  private closeDebugFile(): void {
    if (this.debugFileStream) {
      try {
        this.debugFileStream.write(`\n===== DEBUG LOG END ${new Date().toISOString()} =====\n`)
        this.debugFileStream.end()
      } catch { /* ignore */ }
      this.debugFileStream = null
    }
  }

  /**
   * Write a raw line to the debug file (if enabled). Also echoes to console.
   * This is for verbose protocol-level logging (Connect frames, cookies, etc.)
   */
  debugLog(message: string): void {
    const line = `[${new Date().toISOString()}] ${message}`
    console.log(line)
    if (this.debugFileStream) {
      try {
        this.debugFileStream.write(line + '\n')
      } catch { /* ignore write errors */ }
    }
  }

  /**
   * Get whether debug file logging is active
   */
  isDebugLogging(): boolean {
    return this.debugFileStream !== null
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  setCategoryConfigs(configs: Record<string, LogCategoryConfig>): void {
    this.categoryConfigs = { ...DEFAULT_LOG_CATEGORIES, ...configs }
  }

  getCategoryConfigs(): Record<string, LogCategoryConfig> {
    return { ...this.categoryConfigs }
  }

  async initialize(debugFilePath?: string): Promise<void> {
    if (this.initialized) return

    // Enable debug file logging if --debug-file was specified
    if (debugFilePath) {
      this.setDebugFile(debugFilePath)
    }

    try {
      await this.loadLogs()
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize log manager:', error)
      this.logs = []
      this.initialized = true
    }
  }

  private async loadLogs(): Promise<void> {
    try {
      if (fs.existsSync(this.logFile)) {
        const content = await fs.promises.readFile(this.logFile, 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean)

        this.logs = lines
          .map(line => {
            try {
              return JSON.parse(line) as LogEntry
            } catch {
              return null
            }
          })
          .filter((log): log is LogEntry => log !== null)
          .slice(-this.maxLogs)
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
      this.logs = []
    }
  }

  private async saveLogs(): Promise<void> {
    try {
      const content = this.logs.map(log => JSON.stringify(log)).join('\n')
      await fs.promises.writeFile(this.logFile, content, 'utf-8')
    } catch (error) {
      console.error('Failed to save logs:', error)
    }
  }

  log(
    level: LogLevel,
    message: string,
    options?: {
      category?: LogCategory
      subCategory?: string
      accountId?: string
      providerId?: string
      requestId?: string
      data?: Record<string, unknown>
    }
  ): LogEntry | null {
    const category = options?.category || 'general'
    const config = this.categoryConfigs[category]

    if (config && !config.enabled) {
      return null
    }

    if (config && LEVEL_ORDER[level] < LEVEL_ORDER[config.level]) {
      return null
    }

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      subCategory: options?.subCategory,
      message,
      accountId: options?.accountId,
      providerId: options?.providerId,
      requestId: options?.requestId,
      data: options?.data,
    }

    this.logs.push(entry)

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    this.saveLogs().catch(console.error)

    this.mainWindow?.webContents.send(IpcChannels.LOGS_NEW_LOG, entry)

    return entry
  }

  info(
    message: string,
    options?: {
      category?: LogCategory
      subCategory?: string
      accountId?: string
      providerId?: string
      requestId?: string
      data?: Record<string, unknown>
    }
  ): LogEntry | null {
    return this.log('info', message, options)
  }

  warn(
    message: string,
    options?: {
      category?: LogCategory
      subCategory?: string
      accountId?: string
      providerId?: string
      requestId?: string
      data?: Record<string, unknown>
    }
  ): LogEntry | null {
    return this.log('warn', message, options)
  }

  error(
    message: string,
    options?: {
      category?: LogCategory
      subCategory?: string
      accountId?: string
      providerId?: string
      requestId?: string
      data?: Record<string, unknown>
    }
  ): LogEntry | null {
    return this.log('error', message, options)
  }

  debug(
    message: string,
    options?: {
      category?: LogCategory
      subCategory?: string
      accountId?: string
      providerId?: string
      requestId?: string
      data?: Record<string, unknown>
    }
  ): LogEntry | null {
    return this.log('debug', message, options)
  }

  getLogs(filter?: LogFilter): LogEntry[] {
    let filtered = [...this.logs]

    if (filter?.level && filter.level !== 'all') {
      filtered = filtered.filter(log => log.level === filter.level)
    }

    if (filter?.category && filter.category !== 'all') {
      filtered = filtered.filter(log => log.category === filter.category)
    }

    if (filter?.keyword) {
      const keyword = filter.keyword.toLowerCase()
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(keyword) ||
        log.subCategory?.toLowerCase().includes(keyword) ||
        log.category?.toLowerCase().includes(keyword)
      )
    }

    if (filter?.startTime) {
      filtered = filtered.filter(log => log.timestamp >= (filter.startTime as number))
    }

    if (filter?.endTime) {
      filtered = filtered.filter(log => log.timestamp <= (filter.endTime as number))
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp)

    if (filter?.offset !== undefined) {
      filtered = filtered.slice(filter.offset)
    }

    if (filter?.limit !== undefined) {
      filtered = filtered.slice(0, filter.limit)
    }

    return filtered
  }

  getStats(filter?: { category?: LogCategory | 'all' }): {
    total: number
    info: number
    warn: number
    error: number
    debug: number
    categories: Record<string, { total: number; info: number; warn: number; error: number; debug: number }>
  } {
    let logs = this.logs

    if (filter?.category && filter.category !== 'all') {
      logs = logs.filter(log => log.category === filter.category)
    }

    const stats = {
      total: logs.length,
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
      categories: {} as Record<string, { total: number; info: number; warn: number; error: number; debug: number }>,
    }

    for (const log of logs) {
      ;(stats as Record<string, number>)[log.level]++
      if (!stats.categories[log.category]) {
        stats.categories[log.category] = { total: 0, info: 0, warn: 0, error: 0, debug: 0 }
      }
      stats.categories[log.category].total++
      stats.categories[log.category][log.level]++
    }

    return stats
  }

  getTrend(days: number = 7): { date: string; total: number; info: number; warn: number; error: number }[] {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const trends: { date: string; total: number; info: number; warn: number; error: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (i + 1) * dayMs
      const dayEnd = now - i * dayMs
      const date = new Date(dayStart).toISOString().split('T')[0]

      const dayLogs = this.logs.filter(
        log => log.timestamp >= dayStart && log.timestamp < dayEnd
      )

      trends.push({
        date,
        total: dayLogs.length,
        info: dayLogs.filter(l => l.level === 'info').length,
        warn: dayLogs.filter(l => l.level === 'warn').length,
        error: dayLogs.filter(l => l.level === 'error').length,
      })
    }

    return trends
  }

  destroy(): void {
    this.closeDebugFile()
  }

  async clearLogs(): Promise<void> {
    this.logs = []
    await this.saveLogs()
  }

  async cleanOldLogs(): Promise<void> {
    const now = Date.now()
    const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000

    this.logs = this.logs.filter(log => now - log.timestamp < retentionMs)
    await this.saveLogs()
  }

  setRetentionDays(days: number): void {
    this.retentionDays = days
  }

  setMaxLogs(max: number): void {
    this.maxLogs = max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
      this.saveLogs().catch(console.error)
    }
  }

  exportLogs(format: 'json' | 'txt' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2)
    }

    return this.logs
      .map(log => {
        const time = new Date(log.timestamp).toISOString()
        const level = log.level.toUpperCase().padEnd(5)
        let line = `[${time}] [${level}] [${log.category}] ${log.message}`

        if (log.providerId) {
          line += ` | Provider: ${log.providerId}`
        }
        if (log.accountId) {
          line += ` | Account: ${log.accountId}`
        }
        if (log.requestId) {
          line += ` | Request: ${log.requestId}`
        }
        if (log.data) {
          line += ` | Data: ${JSON.stringify(log.data)}`
        }

        return line
      })
      .join('\n')
  }

  getLogById(id: string): LogEntry | undefined {
    return this.logs.find(log => log.id === id)
  }
}

export const logManager = new LogManager()
