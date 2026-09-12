import { AppLog } from '../types/interfaces';

class Logger {
  private logLevel: number;
  private logs: AppLog[] = [];
  private readonly levelMap: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(logLevel: string = 'info') {
    this.logLevel = this.levelMap[logLevel] || 1;
  }

  private formatLog(level: AppLog['level'], module: string, message: string, metadata?: Record<string, any>): AppLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      metadata
    };
  }

  debug(module: string, message: string, metadata?: Record<string, any>) {
    if (this.levelMap['debug'] < this.logLevel) return;
    const log = this.formatLog('debug', module, message, metadata);
    this.logs.push(log);
    console.debug(`[DEBUG] ${module}: ${message}`, metadata || '');
  }

  info(module: string, message: string, metadata?: Record<string, any>) {
    if (this.levelMap['info'] < this.logLevel) return;
    const log = this.formatLog('info', module, message, metadata);
    this.logs.push(log);
    console.log(`[INFO] ${module}: ${message}`, metadata || '');
  }

  warn(module: string, message: string, metadata?: Record<string, any>) {
    if (this.levelMap['warn'] < this.logLevel) return;
    const log = this.formatLog('warn', module, message, metadata);
    this.logs.push(log);
    console.warn(`[WARN] ${module}: ${message}`, metadata || '');
  }

  error(module: string, message: string, metadata?: Record<string, any>) {
    const log = this.formatLog('error', module, message, metadata);
    this.logs.push(log);
    console.error(`[ERROR] ${module}: ${message}`, metadata || '');
  }

  getLogs(filter?: any): AppLog[] {
    let filtered = [...this.logs];
    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }
    if (filter?.module) {
      filtered = filtered.filter(log => log.module === filter.module);
    }
    if (filter?.keyword) {
      filtered = filtered.filter(log => log.message.includes(filter.keyword));
    }
    if (filter?.startTime) {
      filtered = filtered.filter(log => log.timestamp >= filter.startTime);
    }
    if (filter?.endTime) {
      filtered = filtered.filter(log => log.timestamp <= filter.endTime);
    }
    if (filter?.page && filter?.pageSize) {
      const start = (filter.page - 1) * filter.pageSize;
      filtered = filtered.slice(start, start + filter.pageSize);
    }
    return filtered;
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();
