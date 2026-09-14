/**
 * ObjectPool — KX2API 适配版
 *
 * 从 doge-desktop src/performance/ObjectPool.ts 移植
 * 通用对象池，支持预填充、复用统计
 */

export class ObjectPool<T> {
  private pool: T[] = []
  private factory: () => T
  private reset: (obj: T) => void
  private maxSize: number
  private created = 0
  private reused = 0

  constructor(factory: () => T, reset: (obj: T) => void, maxSize = 100) {
    this.factory = factory
    this.reset = reset
    this.maxSize = maxSize
  }

  acquire(): T {
    if (this.pool.length > 0) {
      this.reused++
      const obj = this.pool.pop()
      if (obj !== undefined) return obj
    }

    this.created++
    return this.factory()
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj)
      this.pool.push(obj)
    }
  }

  prefill(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory())
    }
  }

  clear(): void {
    this.pool = []
  }

  getStats(): {
    poolSize: number
    created: number
    reused: number
    reuseRate: number
  } {
    const total = this.created + this.reused
    return {
      poolSize: this.pool.length,
      created: this.created,
      reused: this.reused,
      reuseRate: total > 0 ? this.reused / total : 0,
    }
  }
}
