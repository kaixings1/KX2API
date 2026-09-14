/**
 * Cache Manager - Unified cache management with LRU strategy
 * Provides memory management and automatic cleanup for all caches
 */
export interface CacheOptions {
    maxSize?: number;
    maxAge?: number;
}
export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    expiresAt?: number;
}
export declare class LRUCache<K, V> {
    private cache;
    private maxSize;
    private maxAge;
    constructor(options?: CacheOptions);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    size(): number;
    keys(): K[];
    values(): V[];
    purgeStale(): number;
    private isExpired;
}
export declare class CacheManager {
    private caches;
    private cleanupInterval?;
    createCache(name: string, options?: CacheOptions): LRUCache<string, any>;
    getCache(name: string): LRUCache<string, any> | undefined;
    hasCache(name: string): boolean;
    deleteCache(name: string): boolean;
    clearCache(name: string): boolean;
    clearAll(): void;
    startCleanup(interval?: number): void;
    stopCleanup(): void;
    getStats(): Record<string, {
        size: number;
        maxSize: number;
    }>;
    getTotalSize(): number;
}
export declare const cacheManager: CacheManager;
