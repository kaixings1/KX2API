import type { RequestLogEntry } from '../store/types.ts';
import type { RequestLogConfig } from './types.ts';
export declare function sanitizeRequestLogEntry(entry: Omit<RequestLogEntry, 'id'>, config: RequestLogConfig): Omit<RequestLogEntry, 'id'>;
export declare function sanitizeRequestLogUpdates(updates: Partial<RequestLogEntry>, config: RequestLogConfig): Partial<RequestLogEntry>;
export declare function trimRequestLogsToMaxEntries(entries: RequestLogEntry[], config: RequestLogConfig): RequestLogEntry[];
