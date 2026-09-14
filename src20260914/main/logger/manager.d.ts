import { BrowserWindow } from 'electron';
import type { LogEntry, LogLevel } from '../../shared/types';
interface LogStats {
    total: number;
    info: number;
    warn: number;
    error: number;
    debug: number;
}
interface LogFilter {
    level?: LogLevel | 'all';
    keyword?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
}
interface LogTrend {
    date: string;
    total: number;
    info: number;
    warn: number;
    error: number;
}
declare class LogManager {
    private logs;
    private logFile;
    private debugFileStream;
    private maxLogs;
    private retentionDays;
    private initialized;
    private mainWindow;
    constructor();
    setMainWindow(window: BrowserWindow | null): void;
    initialize(debugFilePath?: string): Promise<void>;
    setDebugFile(filePath: string | null): void;
    debugLog(message: string): void;
    isDebugLogging(): boolean;
    destroy(): void;
    private loadLogs;
    private saveLogs;
    log(level: LogLevel, message: string, data?: {
        accountId?: string;
        providerId?: string;
        requestId?: string;
        data?: Record<string, unknown>;
    }): LogEntry;
    info(message: string, data?: Parameters<LogManager['log']>[2]): LogEntry;
    warn(message: string, data?: Parameters<LogManager['log']>[2]): LogEntry;
    error(message: string, data?: Parameters<LogManager['log']>[2]): LogEntry;
    debug(message: string, data?: Parameters<LogManager['log']>[2]): LogEntry;
    getLogs(filter?: LogFilter): LogEntry[];
    getStats(): LogStats;
    getTrend(days?: number): LogTrend[];
    clearLogs(): Promise<void>;
    cleanOldLogs(): Promise<void>;
    setRetentionDays(days: number): void;
    setMaxLogs(max: number): void;
    exportLogs(format?: 'json' | 'txt'): string;
    getLogById(id: string): LogEntry | undefined;
}
export declare const logManager: LogManager;
export {};
