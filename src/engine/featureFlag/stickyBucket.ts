/**
 * engine/featureFlag/stickyBucket.ts — 粘性分桶服务
 *
 * 实现 LocalStorageStickyBucketService（内存 Map 后端）。
 */

/** Cookie 属性 */
export interface CookieAttributes {
  domain?: string
  path?: string
  expires?: Date
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

/** Cookie 接口兼容 */
export interface JsCookiesCompat {
  set(key: string, value: string, attrs?: CookieAttributes): void
  get(key: string): string | undefined
  remove(key: string, attrs?: CookieAttributes): void
}

/** Redis 接口兼容 */
export interface IORedisCompat {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl?: number): Promise<void>
  del(key: string): Promise<void>
}

/** 抽象粘性分桶服务 */
export abstract class StickyBucketService {
  abstract getAssignment(namespace: string, attributeValue: string): string | null
  abstract setAssignment(namespace: string, attributeValue: string, variation: string): void
  abstract clearAssignment(namespace: string): void
}

/** 内存粘性分桶服务（开发/测试用） */
export class MemoryStickyBucketService extends StickyBucketService {
  private store = new Map<string, string>()

  getAssignment(namespace: string, attributeValue: string): string | null {
    const key = this.makeKey(namespace, attributeValue)
    return this.store.get(key) ?? null
  }

  setAssignment(namespace: string, attributeValue: string, variation: string): void {
    const key = this.makeKey(namespace, attributeValue)
    this.store.set(key, variation)
  }

  clearAssignment(namespace: string): void {
    const prefix = `${namespace}:`
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
      }
    }
  }

  private makeKey(namespace: string, attributeValue: string): string {
    return `${namespace}:${attributeValue}`
  }
}
