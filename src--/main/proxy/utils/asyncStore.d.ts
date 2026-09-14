/**
 * Async Store - Asynchronous write queue for data persistence
 * Improves performance by batching and deduplicating writes
 */
export interface WriteTask {
    key: string;
    value: any;
    timestamp: number;
}
export declare class AsyncStore {
    private writeQueue;
    private isProcessing;
    private flushInterval;
    private readonly flushDelay;
    private readonly batchSize;
    private onFlush;
    constructor(onFlush: (tasks: WriteTask[]) => Promise<void>, options?: {
        flushDelay?: number;
        batchSize?: number;
    });
    set(key: string, value: any): void;
    get(key: string): any | undefined;
    delete(key: string): boolean;
    clear(): void;
    size(): number;
    private scheduleFlush;
    flush(): Promise<void>;
    flushSync(): Promise<void>;
    destroy(): void;
}
export declare class AsyncStoreManager {
    private stores;
    createStore(name: string, onFlush: (tasks: WriteTask[]) => Promise<void>, options?: {
        flushDelay?: number;
        batchSize?: number;
    }): AsyncStore;
    getStore(name: string): AsyncStore | undefined;
    flushAll(): Promise<void>;
    destroyAll(): void;
}
export declare const asyncStoreManager: AsyncStoreManager;
