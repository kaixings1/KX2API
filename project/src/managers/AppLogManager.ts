import * as fs from 'fs/promises';
import * as path from 'path';

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  module: string;
  message: string;
  data?: any;
}

export class AppLogManager {
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private logFile: string;
  private maxBufferSize = 100;

  constructor(logDir = 'logs') {
    this.logFile = path.join(logDir, `app-${Date.now()}.log`);
    this.initFlushTimer();
  }

  private initFlushTimer(): void {
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  log(level: LogEntry['level'], module: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      module,
      message,
      data
    };
    
    this.logBuffer.push(entry);
    
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const lines = this.logBuffer.map(entry => 
      JSON.stringify({
        ...entry,
        time: new Date(entry.timestamp).toISOString()
      })
    ).join('\n') + '\n';

    await fs.appendFile(this.logFile, lines);
    this.logBuffer = [];
  }

  async getLogs(filter?: { level?: string; module?: string; limit?: number }): Promise<LogEntry[]> {
    await this.flush();
    
    const content = await fs.readFile(this.logFile, 'utf-8');
    let logs: LogEntry[] = content.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .reverse();

    if (filter?.level) {
      logs = logs.filter(l => l.level === filter.level);
    }
    if (filter?.module) {
      logs = logs.filter(l => l.module === filter.module);
    }
    if (filter?.limit) {
      logs = logs.slice(0, filter.limit);
    }

    return logs;
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}
