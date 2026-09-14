import type { RequestLogEntry } from '../store/types.ts';
import type { RequestLogConfig, RequestLogFilter, RequestLogStats, RequestLogTrendPoint } from './types.ts';
interface RequestLogManagerOptions {
    storageDir: string;
    config?: Partial<RequestLogConfig>;
}
export declare class RequestLogManager {
    private readonly logFile;
    private readonly storageDir;
    private requestLogs;
    private config;
    private initialized;
    private persistTimer;
    private dirty;
    private readonly persistDelayMs;
    constructor(options: RequestLogManagerOptions);
    initialize(): Promise<void>;
    setConfig(config: Partial<RequestLogConfig>): void;
    migrateLegacyLogs(legacyLogs: RequestLogEntry[]): Promise<boolean>;
    addRequestLog(entry: Omit<RequestLogEntry, 'id'>): RequestLogEntry;
    updateRequestLog(id: string, updates: Partial<RequestLogEntry>): boolean;
    getRequestLogs(limit?: number, filter?: RequestLogFilter): RequestLogEntry[];
    getRequestLogById(id: string): RequestLogEntry | undefined;
    clearRequestLogs(): void;
    getRequestLogStats(): RequestLogStats;
    getRequestLogTrend(days?: number): RequestLogTrendPoint[];
    exportRequestLogs(): RequestLogEntry[];
    flushSync(): void;
    private ensureInitialized;
    private loadRequestLogs;
    private schedulePersist;
    private persistNow;
}
export {};
