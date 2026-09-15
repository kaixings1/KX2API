/**
 * PerformanceMonitor — KX2API 适配版
 *
 * 从 doge-desktop src/performance/PerformanceMonitor.ts 移植
 * 性能监控器：计时器、计数器、内存监控、指标记录
 */

import { MemoryMonitor, type MemoryStats } from './MemoryMonitor.js'

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags?: Record<string, string>
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private memoryMonitor: MemoryMonitor
  private timers: Map<string, number> = new Map()
  private counters: Map<string, number> = new Map()

  constructor() {
    this.memoryMonitor = new MemoryMonitor()
  }

  startTimer(name: string): void {
    this.timers.set(name, performance.now())
  }

  endTimer(name: string, tags?: Record<string, string>): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      return 0
    }

    const duration = performance.now() - startTime
    this.timers.delete(name)

    this.recordMetric({
      name,
      value: duration,
      unit: 'ms',
      tags,
    })

    return duration
  }

  incrementCounter(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + value)
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0
  }

  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    this.metrics.push({
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      timestamp: Date.now(),
      tags: metric.tags,
    })
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(m => m.name === name)
    }
    return [...this.metrics]
  }

  getMemoryMonitor(): MemoryMonitor {
    return this.memoryMonitor
  }

  getSummary(): {
    metrics: PerformanceMetric[]
    counters: Record<string, number>
    memory: ReturnType<MemoryMonitor['getReport']>
  } {
    const counters: Record<string, number> = {}
    for (const [name, value] of this.counters.entries()) {
      counters[name] = value
    }

    return {
      metrics: this.getMetrics(),
      counters,
      memory: this.memoryMonitor.getReport(),
    }
  }

  clear(): void {
    this.metrics = []
    this.timers.clear()
    this.counters.clear()
  }
}
