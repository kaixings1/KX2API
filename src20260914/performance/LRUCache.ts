/**
 * LRUCache — KX2API 适配版
 *
 * 从 doge-desktop src/performance/LRUCache.ts 移植
 * 带 TTL 的 LRU 缓存，支持 size 限制和过期淘汰
 */

export interface LRUCacheOptions<K = string, V = any> {
  maxSize: number
  defaultTTL?: number
  onEvict?: (key: K, value: V) => void
}

export class LRUCache<K = string, V = any> {
  private cache: Map<K, { value: V; expiresAt: number; size: number }> = new Map()
  private maxSize: number
  private defaultTTL: number
  private onEvict?: (key: K, value: V) => void
  private currentSize: number = 0

  constructor(options: LRUCacheOptions<K, V>) {
    this.maxSize = options.maxSize
    this.defaultTTL = options.defaultTTL || 3600000
    this.onEvict = options.onEvict
  }

  get(key: K): V | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      return null
    }

    // 移动到末尾（最近使用）
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  set(key: K, value: V, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL)
    const size = this.estimateSize(value)

    const existing = this.cache.get(key)
    if (existing) {
      this.currentSize -= existing.size
      this.cache.delete(key)
    }

    this.cache.set(key, { value, expiresAt, size })
    this.currentSize += size

    while (this.currentSize > this.maxSize && this.cache.size > 0) {
      this.evictOldest()
    }
  }

  delete(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    this.cache.delete(key)
    this.currentSize -= entry.size
    this.onEvict?.(key, entry.value)
    return true
  }

  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.currentSize -= entry.size
      return false
    }
    return true
  }

  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache.entries()) {
        this.onEvict(key, entry.value)
      }
    }
    this.cache.clear()
    this.currentSize = 0
  }

  size(): number {
    return this.currentSize
  }

  count(): number {
    return this.cache.size
  }

  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value
    if (oldestKey == null) return

    const entry = this.cache.get(oldestKey)
    if (entry) {
      this.currentSize -= entry.size
      this.cache.delete(oldestKey)
      this.onEvict?.(oldestKey, entry.value)
    }
  }

  private estimateSize(value: V): number {
    if (typeof value === 'string') return value.length
    if (typeof value === 'number' || typeof value === 'boolean') return 8
    if (value === null || value === undefined) return 0
    try {
      return JSON.stringify(value).length
    } catch {
      return 1024
    }
  }
}
