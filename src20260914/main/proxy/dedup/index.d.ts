/**
 * Request Deduplicator Module
 * Prevents duplicate identical requests from being forwarded to upstream within a time window.
 *
 * 实现原理:
 * - 注册条目时创建共享 PassThrough 流（streaming 模式）
 * - 原始请求将上游响应 pipe 到共享流
 * - 重复请求通过添加 data/end 事件监听器从同一共享流读取
 * - 流结束后仍到达的重复请求从缓冲区重放
 * - 非流式模式使用 Promise 等待原始请求结果
 */
import { PassThrough } from 'stream';
export interface RequestFingerprint {
    model: string;
    messagesHash: string;
    stream: boolean;
}
interface DedupEntry<T> {
    waitingResolves: Array<(value: T) => void>;
    resolvedValue: T | null;
    resolved: boolean;
    sharedStream: PassThrough;
    buffer: Buffer[];
    streamEnded: boolean;
    timestamp: number;
    pendingCount: number;
}
export declare function computeFingerprint(request: any): RequestFingerprint;
export declare function fingerprintToString(fp: RequestFingerprint): string;
export declare class RequestDeduplicator {
    private entries;
    private cleanupTimer;
    private windowMs;
    constructor(windowMs?: number);
    destroy(): void;
    setWindowMs(ms: number): void;
    getWindowMs(): number;
    getActiveCount(): number;
    /**
     * Check if a duplicate request exists within the dedup window.
     * Returns a promise that resolves to the shared result, or null to proceed with forwarding.
     */
    checkDuplicate<T>(fingerprint: RequestFingerprint): Promise<T> | null;
    /**
     * Register a new in-flight request and return the entry for the caller to populate.
     * For streaming requests, the caller should pipe upstream data into entry.sharedStream.
     */
    register<T>(fingerprint: RequestFingerprint): DedupEntry<T>;
    /**
     * Complete a non-streaming entry with the forward result.
     */
    complete<T>(key: string, entry: DedupEntry<T>, result: T): void;
    /**
     * Complete a streaming entry. Returns the shared stream for the caller to pipe upstream into.
     */
    getSharedStream<T>(key: string, entry: DedupEntry<T>): PassThrough;
    /**
     * Fail an entry — destroy shared stream and reject any waiting promise.
     */
    fail<T>(key: string, entry: DedupEntry<T>, error: Error): void;
    private cleanup;
}
export {};
