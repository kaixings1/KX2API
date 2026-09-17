/**
 * main/tasks/tasksStore.ts — 任务数据存储
 *
 * 职责：
 * - 提供任务的 CRUD + setStatus 接口
 * - 数据持久化到项目数据目录下的 tasks.json
 */

import { join, dirname } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { app } from 'electron'

const DATA_FILE = join(app.getPath('userData'), 'tasks.json')

export interface TaskRecord {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  // 以下字段落盘时会显式写 null（表示「明确了：目前没有」），
  // 与「字段缺失」的 undefined 语义不同，故类型允许 null。
  assignee?: string | null
  tags: string[]
  createdAt: number
  dueAt?: number | null
  completedAt?: number | null
  /** 执行结果（AI 回复） */
  result?: string | null
  /** 执行日志 */
  executionLog?: Array<{ time: number; event: string; detail?: string }>
}

function loadAll(): TaskRecord[] {
  try {
    if (!existsSync(DATA_FILE)) return []
    const raw = readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveAll(tasks: TaskRecord[]): void {
  const dir = dirname(DATA_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8')
}

export const tasksStore = {
  getAll(): TaskRecord[] {
    return loadAll()
  },

  getById(id: string): TaskRecord | undefined {
    return loadAll().find(t => t.id === id)
  },

  create(data: Partial<TaskRecord> & { title: string; description: string }): TaskRecord {
    const tasks = loadAll()
    const now = Date.now()
    const record: TaskRecord = {
      id: 'task_' + now + '_' + Math.random().toString(36).slice(2, 8),
      title: data.title,
      description: data.description,
      status: data.status || 'todo',
      priority: data.priority || 'medium',
      assignee: data.assignee || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: now,
      dueAt: data.dueAt || null,
      completedAt: null,
      result: null,
      executionLog: [],
    }
    tasks.push(record)
    saveAll(tasks)
    return record
  },

  update(id: string, patch: Partial<TaskRecord>): TaskRecord | undefined {
    const tasks = loadAll()
    const idx = tasks.findIndex(t => t.id === id)
    if (idx === -1) return undefined
    tasks[idx] = { ...tasks[idx], ...patch }
    saveAll(tasks)
    return tasks[idx]
  },

  delete(id: string): boolean {
    const tasks = loadAll()
    const next = tasks.filter(t => t.id !== id)
    if (next.length === tasks.length) return false
    saveAll(next)
    return true
  },

  setStatus(id: string, status: TaskRecord['status']): TaskRecord | undefined {
    const patch: Partial<TaskRecord> = { status }
    if (status === 'done' || status === 'cancelled') {
      patch.completedAt = Date.now()
    }
    return this.update(id, patch)
  },
}
