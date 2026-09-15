/**
 * RequestQueue — KX2API 适配版
 *
 * 从 doge-desktop src/performance/RequestQueue.ts 移植
 * 带优先级和并发控制的请求队列
 */

export interface QueuedRequest<T = any> {
  id: string
  priority: number
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: any) => void
}

export class RequestQueue<T = any> {
  private queue: QueuedRequest[] = []
  private activeRequests = 0
  private maxConcurrent: number
  private processing = false

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent
  }

  async add(request: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        priority,
        execute: request,
        resolve: resolve as (value: any) => void,
        reject,
      }

      this.queue.push(queuedRequest)
      this.queue.sort((a, b) => b.priority - a.priority)

      this.process()
    })
  }

  private async process(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const request = this.queue.shift()
      if (!request) break

      this.activeRequests++

      request
        .execute()
        .then(request.resolve)
        .catch(request.reject)
        .finally(() => {
          this.activeRequests--
          this.process()
        })
    }

    this.processing = false
  }

  getStatus(): {
    queueLength: number
    activeRequests: number
    maxConcurrent: number
  } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent,
    }
  }

  clear(): void {
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'))
    }
    this.queue = []
  }
}
