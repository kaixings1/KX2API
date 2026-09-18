/**
 * engine/tasks/taskRegistry.ts — 任务注册表
 *
 * 吸收自 D:\src\tasks.ts 的任务管理能力。
 */

import type { TaskHandle, TaskProgress, TaskStateBase, TaskType, TaskStatus } from './types.ts'
import { isTerminalTaskStatus } from './types.ts'

/** 任务条目 */
interface TaskEntry {
  state: TaskStateBase
  cancelFn?: () => void
  listeners: Set<(progress: TaskProgress) => void>
}

class TaskRegistry {
  private tasks = new Map<string, TaskEntry>()

  /** 注册新任务 */
  register(type: TaskType, metadata: Record<string, unknown> = {}): TaskHandle {
    const state: TaskStateBase = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    }

    const entry: TaskEntry = {
      state,
      listeners: new Set(),
    }

    this.tasks.set(state.id, entry)

    return {
      id: state.id,
      cancel: () => {
        entry.state.status = 'cancelled'
        entry.state.updatedAt = Date.now()
        entry.cancelFn?.()
      },
      onProgress: (cb: (progress: TaskProgress) => void) => {
        entry.listeners.add(cb)
        return () => entry.listeners.delete(cb)
      },
    }
  }

  /**
   * 更新任务状态。
   *
   * 终态（completed/failed/cancelled）不可再变更：一旦任务已结束，
   * 迟到的回调把状态改回 running 会让它"复活"（界面上看是一条已完成的
   * 任务重新转圈，且可能被重复取消/重复上报）。幂等重复置同一终态是允许的。
   */
  updateStatus(id: string, status: TaskStatus): boolean {
    const entry = this.tasks.get(id)
    if (!entry) return false
    if (isTerminalTaskStatus(entry.state.status) && entry.state.status !== status) {
      return false
    }
    entry.state.status = status
    entry.state.updatedAt = Date.now()
    return true
  }

  /** 更新任务元数据 */
  updateMetadata(id: string, metadata: Partial<Record<string, unknown>>): boolean {
    const entry = this.tasks.get(id)
    if (!entry) return false
    entry.state.metadata = { ...entry.state.metadata, ...metadata }
    entry.state.updatedAt = Date.now()
    return true
  }

  /** 上报进度 */
  reportProgress(id: string, progress: TaskProgress): boolean {
    const entry = this.tasks.get(id)
    if (!entry) return false
    entry.state.updatedAt = Date.now()
    for (const cb of entry.listeners) {
      try { cb(progress) } catch { /* 忽略监听器错误 */ }
    }
    return true
  }

  /**
   * 获取任务状态（返回副本）。
   *
   * 与 getAllTasks 保持一致：绝不把内部 state 对象暴露出去 ——
   * 调用方改动返回值（如把 status 直接置为 failed）会绕过 updateStatus
   * 的终态保护直接改内部状态，且 updatedAt 不会同步。
   */
  getState(id: string): TaskStateBase | undefined {
    const entry = this.tasks.get(id)
    if (!entry) return void 0
    return { ...entry.state, metadata: { ...entry.state.metadata } }
  }

  /** 获取所有任务（返回副本，metadata 亦做一层拷贝） */
  getAllTasks(): TaskStateBase[] {
    return Array.from(this.tasks.values()).map(e => ({
      ...e.state,
      metadata: { ...e.state.metadata },
    }))
  }

  /** 按类型获取任务 */
  getTasksByType(type: TaskType): TaskStateBase[] {
    return this.getAllTasks().filter(t => t.type === type)
  }

  /** 按状态获取任务 */
  getTasksByStatus(status: TaskStatus): TaskStateBase[] {
    return this.getAllTasks().filter(t => t.status === status)
  }

  /** 获取终止态任务 */
  getTerminalTasks(): TaskStateBase[] {
    return this.getAllTasks().filter(t => isTerminalTaskStatus(t.status))
  }

  /**
   * 清理已终止任务。
   *
   * `olderThanMs = 0`（默认）的语义是"清理全部终态任务"，因此判定必须用
   * `<=`：若用 `<`，在**同一毫秒内**刚终止的任务（`updatedAt === now`）
   * 会被漏掉 —— 表现为"调用清理后任务还在"，且因为时间戳相同还会持续漏掉。
   */
  cleanupTerminal(olderThanMs = 0): TaskStateBase[] {
    const now = Date.now()
    const cleaned: TaskStateBase[] = []
    for (const [id, entry] of this.tasks) {
      if (
        isTerminalTaskStatus(entry.state.status) &&
        entry.state.updatedAt <= now - olderThanMs
      ) {
        cleaned.push({ ...entry.state, metadata: { ...entry.state.metadata } })
        this.tasks.delete(id)
      }
    }
    return cleaned
  }

  /** 注册取消函数 */
  setCancelFn(id: string, fn: () => void): boolean {
    const entry = this.tasks.get(id)
    if (!entry) return false
    entry.cancelFn = fn
    return true
  }

  /** 获取任务数量 */
  get size(): number {
    return this.tasks.size
  }
}

/** 全局任务注册表实例 */
export const taskRegistry = new TaskRegistry()

/** 便捷导出 */
export function getAllTasks(): TaskStateBase[] {
  return taskRegistry.getAllTasks()
}

export function getTaskByType(type: TaskType): TaskStateBase[] {
  return taskRegistry.getTasksByType(type)
}
