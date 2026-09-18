/**
 * engine/history/historyManager.ts — 时间戳历史管理
 *
 * 吸收自 D:\src\history.ts 的时间戳历史和 CRUD 操作。
 */

import type { Reference } from './references.ts'

/** 带时间戳的历史条目 */
export interface TimestampedHistoryEntry {
  timestamp: number
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  references?: Reference[]
  metadata?: Record<string, unknown>
}

class HistoryManager {
  private entries: TimestampedHistoryEntry[] = []
  private pendingEntries: TimestampedHistoryEntry[] = []

  /** 添加历史条目 */
  addToHistory(entry: Omit<TimestampedHistoryEntry, 'timestamp'>): void {
    const now = Date.now()
    const fullEntry: TimestampedHistoryEntry = { ...entry, timestamp: now }
    this.entries.push(fullEntry)
    this.pendingEntries.push(fullEntry)
  }

  /** 获取完整历史（异步生成器） */
  async *getHistory(): AsyncGenerator<TimestampedHistoryEntry> {
    for (const entry of this.entries) {
      yield { ...entry }
    }
  }

  /** 获取最近的历史条目 */
  getRecentHistory(limit = 100): TimestampedHistoryEntry[] {
    return this.entries.slice(-limit).map(e => ({ ...e }))
  }

  /** 移除最后一条 */
  removeLastFromHistory(): boolean {
    if (this.entries.length === 0) return false
    this.entries.pop()
    return true
  }

  /** 清除待处理条目 */
  clearPendingHistoryEntries(): void {
    this.pendingEntries = []
  }

  /** 清空所有历史 */
  clearHistory(): void {
    this.entries = []
    this.pendingEntries = []
  }

  /** 获取历史条目数量 */
  get size(): number {
    return this.entries.length
  }
}

/** 全局历史管理器实例 */
export const historyManager = new HistoryManager()
