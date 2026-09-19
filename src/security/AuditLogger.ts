/**
 * 审计日志器
 * 文件：src/security/AuditLogger.ts
 * 文档 16 §8.1
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';

export type AuditLevel = 'info' | 'warning' | 'error' | 'critical';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  level: AuditLevel;
  category: string;
  action: string;
  userId?: string;
  sessionId?: string;
  tool?: string;
  details: Record<string, any>;
  result: 'success' | 'failure' | 'denied';
  ipAddress?: string;
}

/** 审计缓冲默认条数（达到即落盘） */
export const DEFAULT_AUDIT_BUFFER_SIZE = 100;
/** 审计默认落盘间隔（毫秒） */
export const DEFAULT_AUDIT_FLUSH_INTERVAL_MS = 10000;

export interface AuditLoggerOptions {
  /** 缓冲达到多少条即落盘 */
  maxBufferSize?: number;
  /** 定时落盘间隔（毫秒） */
  flushIntervalMs?: number;
}

export class AuditLogger {
  private logFile: string;
  private entries: AuditEntry[] = [];
  private maxBufferSize: number = DEFAULT_AUDIT_BUFFER_SIZE;
  private flushInterval: number = DEFAULT_AUDIT_FLUSH_INTERVAL_MS;
  // 不用 Node 的全局 `Timer` 别名：它在 tsconfig.check.json 下解析不到
  // （该别名由 @types/node 的 globals 提供，主应用未加载）。
  // 用 setInterval 的返回值类型，跨环境稳定。
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(logFile: string, options: AuditLoggerOptions = {}) {
    this.logFile = logFile;
    this.setLimits(options);
    this.startFlushTimer();
  }

  /**
   * 更新落盘策略（设置界面改完即时生效）。
   * 缓冲越大写入越少但异常退出可能丢失更多记录；间隔越短越安全但 I/O 更频繁。
   */
  setLimits(options: AuditLoggerOptions): void {
    const { maxBufferSize, flushIntervalMs } = options;
    if (
      typeof maxBufferSize === 'number' &&
      Number.isFinite(maxBufferSize) &&
      maxBufferSize > 0
    ) {
      this.maxBufferSize = Math.floor(maxBufferSize);
    }
    if (
      typeof flushIntervalMs === 'number' &&
      Number.isFinite(flushIntervalMs) &&
      flushIntervalMs > 0
    ) {
      this.flushInterval = Math.floor(flushIntervalMs);
      // 间隔变更需重建定时器才生效；否则旧间隔会继续沿用
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
        this.startFlushTimer();
      }
    }
  }

  /** 当前落盘策略（供 UI 回显） */
  getLimits(): { maxBufferSize: number; flushIntervalMs: number } {
    return {
      maxBufferSize: this.maxBufferSize,
      flushIntervalMs: this.flushInterval,
    };
  }

  /**
   * 记录审计日志
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    const auditEntry: AuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    this.entries.push(auditEntry);

    // 高危日志立即刷新
    if (entry.level === 'critical' || entry.level === 'error') {
      this.flush();
    } else if (this.entries.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * 记录工具调用
   */
  logToolCall(params: {
    tool: string;
    action: string;
    params: Record<string, any>;
    result: 'success' | 'failure' | 'denied';
    userId?: string;
    sessionId?: string;
    error?: string;
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
    });
  }

  /**
   * 记录权限变更
   */
  logPermissionChange(params: {
    action: string;
    tool: string;
    decision: string;
    userId?: string;
    sessionId?: string;
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
    });
  }

  /**
   * 记录安全事件
   */
  logSecurityEvent(params: {
    event: string;
    severity: AuditLevel;
    details: Record<string, any>;
    userId?: string;
    sessionId?: string;
  }): void {
    this.log({
      level: params.severity,
      category: 'security',
      action: params.event,
      userId: params.userId,
      sessionId: params.sessionId,
      details: params.details,
      result: 'failure',
    });
  }

  /**
   * 刷新日志到文件
   */
  async flush(): Promise<void> {
    if (this.entries.length === 0) return;

    const entriesToFlush = [...this.entries];
    this.entries = [];

    try {
      const lines = entriesToFlush
        .map((entry) => JSON.stringify(entry))
        .join('\n');

      // appendFile 不会创建目录。审计目录（如 userData/audit）在首次运行时
      // 并不存在，不先建目录会导致每次落盘都 ENOENT —— 缓冲被回滚、
      // 审计静默失效，而调用方毫无感知。
      await fs.mkdir(dirname(this.logFile), { recursive: true });
      await fs.appendFile(this.logFile, lines + '\n', 'utf-8');
    } catch (error) {
      console.error('Failed to flush audit log:', error);
      // 恢复未写入的日志
      this.entries.unshift(...entriesToFlush);
    }
  }

  /**
   * 查询日志
   */
  async query(options: {
    startTime?: Date;
    endTime?: Date;
    level?: AuditLevel;
    category?: string;
    tool?: string;
    limit?: number;
  } = {}): Promise<AuditEntry[]> {
    // 文件尚不存在（首次运行/从未落盘）时返回空，而不是抛 ENOENT ——
    // 否则「stop 后立刻 query」这类合法调用会被异常打断。坏行（部分写入）
    // 也跳过而非整份拒绝，保证历史审计不因单行损坏而全不可读。
    let content: string;
    try {
      content = await fs.readFile(this.logFile, 'utf-8');
    } catch {
      return [];
    }

    const lines = content.split('\n').filter((line) => line.trim());

    let entries: AuditEntry[] = lines
      .map((line) => {
        try {
          return JSON.parse(line) as AuditEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditEntry => e !== null);

    if (options.startTime) {
      entries = entries.filter((e) => new Date(e.timestamp) >= options.startTime!);
    }

    if (options.endTime) {
      entries = entries.filter((e) => new Date(e.timestamp) <= options.endTime!);
    }

    if (options.level) {
      entries = entries.filter((e) => e.level === options.level);
    }

    if (options.category) {
      entries = entries.filter((e) => e.category === options.category);
    }

    if (options.tool) {
      entries = entries.filter((e) => e.tool === options.tool);
    }

    if (options.limit) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  /**
   * 净化参数（移除敏感信息）
   */
  private sanitizeParams(params: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    // 全部用小写。脱敏判定走 `key.toLowerCase().includes(s)`，
    // 单独写 `apiKey` 会因大小写不匹配而永远命中不了（`apikey`.includes('apiKey') 为 false），
    // 导致 apiKey 明文落盘。用全小写 s 才能覆盖 apiKey / api_key / API_KEY 三种写法。
    const sensitiveKeys = ['password', 'token', 'secret', 'apikey', 'api_key'];

    for (const [key, value] of Object.entries(params)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
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
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 停止定时器并落盘剩余缓冲。
   *
   * 注意：定时器不释放会让 Node 进程无法退出，因此即使 flush 失败也会
   * 先清掉句柄（用 try/finally 保证）。
   */
  async stop(): Promise<void> {
    this.stopFlushTimer();
    try {
      await this.flush();
    } catch {
      // flush 内部已处理异常（会回滚缓冲），此处不向上抛，避免退出流程被阻断
    }
  }
}
