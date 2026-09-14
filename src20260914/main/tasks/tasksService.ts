import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

export interface TaskRecord {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  assignee: string | null
  tags: string[]
  createdAt: number
  dueAt: number | null
  completedAt: number | null
}

const DATA_DIR = join(app.getPath('userData'), 'data', 'tasks')
const FILE_PATH = join(DATA_DIR, 'records.json')

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadAll(): TaskRecord[] {
  try {
    if (!existsSync(FILE_PATH)) return []
    const raw = readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[TasksService] load failed:', e)
    return []
  }
}

function saveAll(records: TaskRecord[]): void {
  ensureDir()
  writeFileSync(FILE_PATH, JSON.stringify(records, null, 2), 'utf-8')
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function getAllTasks(): TaskRecord[] {
  return loadAll()
}

export function getTaskById(id: string): TaskRecord | null {
  return loadAll().find(t => t.id === id) ?? null
}

export function createTask(data: Omit<TaskRecord, 'id' | 'createdAt'>): TaskRecord {
  const now = Date.now()
  const task: TaskRecord = {
    ...data,
    id: generateId(),
    createdAt: now,
  }
  const all = loadAll()
  all.push(task)
  saveAll(all)
  return task
}

export function updateTask(id: string, updates: Partial<Omit<TaskRecord, 'id' | 'createdAt'>>): TaskRecord | null {
  const all = loadAll()
  const idx = all.findIndex(t => t.id === id)
  if (idx < 0) return null
  const updated = { ...all[idx], ...updates }
  if (updates.status === 'done' && !updated.completedAt) {
    updated.completedAt = Date.now()
  }
  all[idx] = updated
  saveAll(all)
  return updated
}

export function deleteTask(id: string): boolean {
  const all = loadAll()
  const idx = all.findIndex(t => t.id === id)
  if (idx < 0) return false
  all.splice(idx, 1)
  saveAll(all)
  return true
}

export function setTaskStatus(id: string, status: TaskRecord['status']): TaskRecord | null {
  const updates: Partial<TaskRecord> = { status }
  if (status === 'done') {
    updates.completedAt = Date.now()
  }
  return updateTask(id, updates)
}
