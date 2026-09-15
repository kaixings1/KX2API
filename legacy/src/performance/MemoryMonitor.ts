/**
 * MemoryMonitor — KX2API 适配版
 *
 * 从 doge-desktop src/performance/MemoryMonitor.ts 移植
 * Electron/Node.js 内存监控器，支持阈值告警和趋势分析
 */

export interface MemoryStats {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  arrayBuffers: number
  timestamp: number
}

export interface MemoryThreshold {
  heapUsed?: number
  heapTotal?: number
  rss?: number
}

export class MemoryMonitor {
  private stats: MemoryStats[] = []
  private maxHistorySize = 100
  private monitoringInterval: ReturnType<typeof setInterval> | null = null
  private thresholds: MemoryThreshold = {}
  private callbacks: Array<(stats: MemoryStats) => void> = []

  start(intervalMs = 5000): void {
    if (this.monitoringInterval) {
      return
    }

    this.monitoringInterval = setInterval(() => {
      this.collect()
    }, intervalMs)
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  collect(): MemoryStats {
    const memUsage = process.memoryUsage()

    const stats: MemoryStats = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: (memUsage as any).arrayBuffers ?? 0,
      timestamp: Date.now(),
    }

    this.stats.push(stats)

    if (this.stats.length > this.maxHistorySize) {
      this.stats.shift()
    }

    this.checkThresholds(stats)

    for (const callback of this.callbacks) {
      callback(stats)
    }

    return stats
  }

  getCurrent(): MemoryStats {
    return this.stats[this.stats.length - 1] || this.collect()
  }

  getHistory(): MemoryStats[] {
    return [...this.stats]
  }

  setThresholds(thresholds: MemoryThreshold): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  onStats(callback: (stats: MemoryStats) => void): () => void {
    this.callbacks.push(callback)
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback)
    }
  }

  private checkThresholds(stats: MemoryStats): void {
    if (this.thresholds.heapUsed && stats.heapUsed > this.thresholds.heapUsed) {
      console.warn(`Memory threshold exceeded: heapUsed ${stats.heapUsed} > ${this.thresholds.heapUsed}`)
      if ((global as any).gc) {
        ;(global as any).gc()
      }
    }

    if (this.thresholds.heapTotal && stats.heapTotal > this.thresholds.heapTotal) {
      console.warn(`Memory threshold exceeded: heapTotal ${stats.heapTotal} > ${this.thresholds.heapTotal}`)
    }

    if (this.thresholds.rss && stats.rss > this.thresholds.rss) {
      console.warn(`Memory threshold exceeded: rss ${stats.rss} > ${this.thresholds.rss}`)
    }
  }

  getReport(): {
    current: MemoryStats
    average: MemoryStats
    peak: MemoryStats
    trend: 'increasing' | 'decreasing' | 'stable'
  } {
    if (this.stats.length === 0) {
      const current = this.collect()
      return { current, average: current, peak: current, trend: 'stable' }
    }

    const current = this.stats[this.stats.length - 1]

    const average: MemoryStats = {
      heapUsed: this.average(s => s.heapUsed),
      heapTotal: this.average(s => s.heapTotal),
      external: this.average(s => s.external),
      rss: this.average(s => s.rss),
      arrayBuffers: this.average(s => s.arrayBuffers),
      timestamp: Date.now(),
    }

    const peak: MemoryStats = {
      heapUsed: Math.max(...this.stats.map(s => s.heapUsed)),
      heapTotal: Math.max(...this.stats.map(s => s.heapTotal)),
      external: Math.max(...this.stats.map(s => s.external)),
      rss: Math.max(...this.stats.map(s => s.rss)),
      arrayBuffers: Math.max(...this.stats.map(s => s.arrayBuffers)),
      timestamp: Date.now(),
    }

    const recentStats = this.stats.slice(-10)
    const firstHalf = recentStats.slice(0, 5)
    const secondHalf = recentStats.slice(5)

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.heapUsed, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.heapUsed, 0) / secondHalf.length

    const diff = (secondAvg - firstAvg) / firstAvg
    const trend = diff > 0.1 ? 'increasing' : diff < -0.1 ? 'decreasing' : 'stable'

    return { current, average, peak, trend }
  }

  private average(selector: (s: MemoryStats) => number): number {
    if (this.stats.length === 0) return 0
    return this.stats.reduce((sum, s) => sum + selector(s), 0) / this.stats.length
  }
}
