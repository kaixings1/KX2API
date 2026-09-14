import type { LogEntry } from '../store/types.ts';
import type { AppLogFilter, AppLogStats, AppLogTrendPoint } from './types.ts';
interface AppLogManagerOptions {
    storageDir: string;
    maxEntries?: number;
}
export declare class AppLogManager {
    private readonly logFile;
    private readonly storageDir;
    private logs;
    private maxEntries;
    private initialized;
    private persistTimer;
    private dirty;
    private readonly persistDelayMs;
    constructor(options: AppLogManagerOptions);
    initialize(): Promise<void>;
    setMaxEntries(maxEntries: number): void;
    migrateLegacyLogs(legacyLogs: LogEntry[]): Promise<boolean>;
    addLog(entry: LogEntry): LogEntry;
    replaceLogs(logs: LogEntry[]): void;
    getLogs(filter?: AppLogFilter): LogEntry[];
    getLogById(id: string): LogEntry | undefined;
    clearLogs(): void;
    getStats(): AppLogStats;
    getTrend(days?: number): AppLogTrendPoint[];
    getAccountTrend(accountId: string, days?: number): AppLogTrendPoint[];
    exportLogs(): LogEntry[];
    flushSync(): void;
    private getTrendFromLogs;
    private ensureInitialized;
    private loadLogs;
    private trimLogs;
    private schedulePersist;
    private persistNow;
}
export {};
