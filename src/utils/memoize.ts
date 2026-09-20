/**
 * utils/memoize.ts — 记忆化缓存工具（自 D:\src\utils\memoize.ts 移植）
 *
 * - memoizeWithTTL: 同步写穿缓存，过期后返回陈旧值并后台刷新
 * - memoizeWithTTLAsync: 异步写穿缓存 + 并发冷却去重
 * - memoizeWithLRU: LRU 逐出的记忆化（内置 Map 实现，避免新增 lru-cache 第三方依赖——
 *   与 K 侧 LSPDiagnosticRegistry 的做法一致）
 *
 * 适配：上游的 logError（内部 ./log.js）与 jsonStringify（key 序列化）改用本地轻量实现；
 * 上游的 lru-cache 包换用内置 SimpleLRU（K 装的 lru-cache 是 v5 老版 CJS 命名导出不兼容）。
 */

/** 轻量 key 序列化。 */
function keyJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/** 轻量错误日志（降级为 stderr）。 */
function logMemoError(e: unknown): void {
  // eslint-disable-next-line no-console
  console.error('[memoize]', e)
}

type CacheEntry<T> = { value: T; timestamp: number; refreshing: boolean }

type MemoizedFunction<Args extends unknown[], Result> = {
  (...args: Args): Result
  cache: { clear: () => void }
}

type LRUMemoizedFunction<Args extends unknown[], Result> = {
  (...args: Args): Result
  cache: {
    clear: () => void
    size: () => number
    delete: (key: string) => boolean
    get: (key: string) => Result | undefined
    has: (key: string) => boolean
  }
}

/**
 * 内置简单 LRU：基于 Map 维护最近使用顺序（get/set 会提升到末尾），
 * 超上限时淘汰最久未用条目。避免对 lru-cache 第三方包的版本/导出方式依赖。
 */
class SimpleLRU<T> {
  private map = new Map<string, T>()
  constructor(private readonly max: number) {}

  get(key: string): T | undefined {
    if (!this.map.has(key)) return undefined
    const v = this.map.get(key)!
    // 提升到末尾（最近使用）
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }

  peek(key: string): T | undefined {
    return this.map.get(key)
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.max) {
      // 淘汰最旧的（第一个键）
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  delete(key: string): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }
}

/**
 * 同步写穿缓存：新鲜即返回；过期返回陈旧值并后台刷新；无缓存则阻塞计算。
 */
export function memoizeWithTTL<Args extends unknown[], Result>(
  f: (...args: Args) => Result,
  cacheLifetimeMs: number = 5 * 60 * 1000,
): MemoizedFunction<Args, Result> {
  const cache = new Map<string, CacheEntry<Result>>()

  const memoized = (...args: Args): Result => {
    const key = keyJson(args)
    const cached = cache.get(key)
    const now = Date.now()

    if (!cached) {
      const value = f(...args)
      cache.set(key, { value, timestamp: now, refreshing: false })
      return value
    }

    if (
      cached &&
      now - cached.timestamp > cacheLifetimeMs &&
      !cached.refreshing
    ) {
      cached.refreshing = true
      Promise.resolve()
        .then(() => {
          const newValue = f(...args)
          if (cache.get(key) === cached) {
            cache.set(key, { value: newValue, timestamp: Date.now(), refreshing: false })
          }
        })
        .catch(e => {
          logMemoError(e)
          if (cache.get(key) === cached) cache.delete(key)
        })
      return cached.value
    }

    return cache.get(key)!.value
  }

  memoized.cache = { clear: () => cache.clear() }
  return memoized
}

/**
 * 异步写穿缓存 + 并发冷却去重：并发冷却命中共享一次 f() 调用。
 */
export function memoizeWithTTLAsync<Args extends unknown[], Result>(
  f: (...args: Args) => Promise<Result>,
  cacheLifetimeMs: number = 5 * 60 * 1000,
): ((...args: Args) => Promise<Result>) & { cache: { clear: () => void } } {
  const cache = new Map<string, CacheEntry<Result>>()
  const inFlight = new Map<string, Promise<Result>>()

  const memoized = async (...args: Args): Promise<Result> => {
    const key = keyJson(args)
    const cached = cache.get(key)
    const now = Date.now()

    if (!cached) {
      const pending = inFlight.get(key)
      if (pending) return pending
      const promise = f(...args)
      inFlight.set(key, promise)
      try {
        const result = await promise
        if (inFlight.get(key) === promise) {
          cache.set(key, { value: result, timestamp: now, refreshing: false })
        }
        return result
      } finally {
        if (inFlight.get(key) === promise) inFlight.delete(key)
      }
    }

    if (
      cached &&
      now - cached.timestamp > cacheLifetimeMs &&
      !cached.refreshing
    ) {
      cached.refreshing = true
      const staleEntry = cached
      f(...args)
        .then(newValue => {
          if (cache.get(key) === staleEntry) {
            cache.set(key, { value: newValue, timestamp: Date.now(), refreshing: false })
          }
        })
        .catch(e => {
          logMemoError(e)
          if (cache.get(key) === staleEntry) cache.delete(key)
        })
      return cached.value
    }

    return cache.get(key)!.value
  }

  memoized.cache = {
    clear: () => {
      cache.clear()
      inFlight.clear()
    },
  }
  return memoized as ((...args: Args) => Promise<Result>) & { cache: { clear: () => void } }
}

/**
 * LRU 记忆化：达到上限时淘汰最久未用条目，防无界内存增长。
 */
export function memoizeWithLRU<
  Args extends unknown[],
  Result extends NonNullable<unknown>,
>(
  f: (...args: Args) => Result,
  cacheFn: (...args: Args) => string,
  maxCacheSize: number = 100,
): LRUMemoizedFunction<Args, Result> {
  const cache = new SimpleLRU<Result>(maxCacheSize)

  const memoized = (...args: Args): Result => {
    const key = cacheFn(...args)
    const cached = cache.get(key)
    if (cached !== undefined) return cached
    const result = f(...args)
    cache.set(key, result)
    return result
  }

  memoized.cache = {
    clear: () => cache.clear(),
    size: () => cache.size,
    delete: (key: string) => cache.delete(key),
    get: (key: string) => cache.peek(key),
    has: (key: string) => cache.has(key),
  }
  return memoized
}