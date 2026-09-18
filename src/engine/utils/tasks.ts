/**
 * engine/utils/tasks.ts — TodoV2 文件级任务系统
 *
 * 吸收自 D:\src\utils\tasks.ts 的 TodoV2 核心功能。
 * 简化版：文件级存储 + 事件通知 + 任务认领/更新。
 *
 * 任务持久化在 userData/tasks/<taskListId>/ 目录下，
 * 每个任务一个 JSON 文件（<id>.json）。
 */

import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TodoTaskStatus = 'pending' | 'in_progress' | 'completed'

export interface Task {
  id: string
  subject: string
  description: string
  activeForm?: string
  owner?: string
  status: TodoTaskStatus
  blocks: string[]
  blockedBy: string[]
  metadata?: Record<string, unknown>
}

export interface ClaimTaskResult {
  success: boolean
  reason?: 'task_not_found' | 'already_claimed' | 'already_resolved' | 'blocked' | 'agent_busy'
  task?: Task
  blockedByTasks?: string[]
}

// ---------------------------------------------------------------------------
// Event System
// ---------------------------------------------------------------------------

type TasksUpdatedCallback = () => void
const tasksUpdatedListeners = new Set<TasksUpdatedCallback>()

export function onTasksUpdated(cb: TasksUpdatedCallback): () => void {
  tasksUpdatedListeners.add(cb)
  return () => tasksUpdatedListeners.delete(cb)
}

/**
 * 通知所有订阅者任务已变更。
 *
 * ⚠️ try/catch 必须**逐个监听器**包夹，不能包住整个循环：否则第一个
 * 监听器抛错会中断循环，它后面的所有监听器都收不到这次通知 ——
 * 表现为"UI 有时不刷新"，且取决于监听器注册顺序，极难复现。
 */
export function notifyTasksUpdated(): void {
  for (const cb of tasksUpdatedListeners) {
    try {
      cb()
    } catch {
      // 单个监听器异常不影响其它监听器
    }
  }
}

// ---------------------------------------------------------------------------
// Task List Resolution
// ---------------------------------------------------------------------------

export function getTaskListId(): string {
  return process.env.KX2_TASK_LIST_ID || 'default'
}

// ---------------------------------------------------------------------------
// File Storage
// ---------------------------------------------------------------------------

function getTasksDir(taskListId: string): string {
  const base = process.env.KX2_TASKS_DIR || join(process.cwd(), 'tasks')
  return join(base, taskListId)
}

function getTaskPath(taskListId: string, taskId: string): string {
  return join(getTasksDir(taskListId), `${taskId}.json`)
}

async function ensureTasksDir(taskListId: string): Promise<void> {
  const dir = getTasksDir(taskListId)
  try {
    await mkdir(dir, { recursive: true })
  } catch {
    // 目录已存在或创建失败，后续操作会暴露错误
  }
}

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

export async function getTask(taskListId: string, taskId: string): Promise<Task | null> {
  const path = getTaskPath(taskListId, taskId)
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content) as Task
  } catch {
    return null
  }
}

export async function listTasks(taskListId: string): Promise<Task[]> {
  const dir = getTasksDir(taskListId)
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }

  const taskIds = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
  const tasks = await Promise.all(taskIds.map(id => getTask(taskListId, id)))
  return tasks.filter((t): t is Task => t !== null)
}

export async function updateTask(
  taskListId: string,
  taskId: string,
  updates: Partial<Omit<Task, 'id'>>,
): Promise<Task | null> {
  const existing = await getTask(taskListId, taskId)
  if (!existing) return null

  const updated: Task = { ...existing, ...updates, id: taskId }
  const path = getTaskPath(taskListId, taskId)
  await writeFile(path, JSON.stringify(updated, null, 2))
  notifyTasksUpdated()
  return updated
}

export async function claimTask(
  taskListId: string,
  taskId: string,
  claimantAgentId: string,
): Promise<ClaimTaskResult> {
  const task = await getTask(taskListId, taskId)
  if (!task) {
    return { success: false, reason: 'task_not_found' }
  }

  if (task.owner && task.owner !== claimantAgentId) {
    return { success: false, reason: 'already_claimed', task }
  }

  if (task.status === 'completed') {
    return { success: false, reason: 'already_resolved', task }
  }

  // 检查 blockedBy
  const allTasks = await listTasks(taskListId)
  const unresolvedTaskIds = new Set(allTasks.filter(t => t.status !== 'completed').map(t => t.id))
  const blockedByTasks = task.blockedBy.filter(id => unresolvedTaskIds.has(id))
  if (blockedByTasks.length > 0) {
    return { success: false, reason: 'blocked', task, blockedByTasks }
  }

  const updated = await updateTask(taskListId, taskId, { owner: claimantAgentId })
  return { success: true, task: updated! }
}

export async function createTask(
  taskListId: string,
  taskData: Omit<Task, 'id'>,
): Promise<string> {
  await ensureTasksDir(taskListId)

  const dir = getTasksDir(taskListId)
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    files = []
  }

  const maxId = files
    .filter(f => f.endsWith('.json'))
    .map(f => parseInt(f.replace('.json', ''), 10))
    .filter(n => !isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0)

  const id = String(maxId + 1)
  const task: Task = { id, ...taskData }
  await writeFile(getTaskPath(taskListId, id), JSON.stringify(task, null, 2))
  notifyTasksUpdated()
  return id
}
