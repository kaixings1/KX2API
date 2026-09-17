/**
 * tasks/tasksService.ts
 *
 * Task 管理后端服务：
 *   - 使用 ModuleDataStore 持久化
 *   - CRUD + setStatus + execute + abort + getRunning
 *
 * 对应的 IPC channels：TASKS_*（定义在 channels.ts）
 */

import { ModuleDataStore } from '../ipc/ModuleDataStore'

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
  /** 若为 true，达到 scheduledAt 时由 taskScheduler 自动置为 in_progress */
  autoExecute?: boolean
  /** 计划自动执行的时刻（时间戳） */
  scheduledAt?: number
  /** 是否已触发过自动执行，避免重复触发 */
  scheduledAtExecuted?: boolean
}

export const tasksStore = new ModuleDataStore<TaskRecord>('tasks')

const DEFAULT_TASKS: TaskRecord[] = [
  {
    id: 'task_default_001',
    title: '实现 Agent 管理页面',
    description: '创建 Agent 管理界面，支持增删改查和执行操作',
    status: 'done',
    priority: 'high',
    assignee: '开发者',
    tags: ['frontend', 'agent'],
    createdAt: Date.now() - 86400000 * 5,
    dueAt: Date.now() - 86400000 * 3,
    completedAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'task_default_002',
    title: '实现 Workflow 管理页面',
    description: '创建工作流管理界面，支持步骤配置和执行',
    status: 'done',
    priority: 'high',
    assignee: '开发者',
    tags: ['frontend', 'workflow'],
    createdAt: Date.now() - 86400000 * 4,
    dueAt: Date.now() - 86400000 * 2,
    completedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'task_default_003',
    title: '实现 MCP 管理页面',
    description: '创建 MCP 服务器配置界面，支持添加、编辑、测试连接',
    status: 'in_progress',
    priority: 'medium',
    assignee: '开发者',
    tags: ['frontend', 'mcp'],
    createdAt: Date.now() - 86400000 * 3,
    dueAt: Date.now() + 86400000,
    completedAt: null,
  },
  {
    id: 'task_default_004',
    title: '添加导入导出功能',
    description: '为所有管理页面添加导入导出和备份恢复功能',
    status: 'in_progress',
    priority: 'medium',
    assignee: '开发者',
    tags: ['feature', 'import-export'],
    createdAt: Date.now() - 86400000 * 2,
    dueAt: Date.now() + 86400000 * 2,
    completedAt: null,
  },
  {
    id: 'task_default_005',
    title: '编写单元测试',
    description: '为关键模块编写单元测试，确保代码质量',
    status: 'todo',
    priority: 'medium',
    assignee: '开发者',
    tags: ['testing'],
    createdAt: Date.now() - 86400000,
    dueAt: Date.now() + 86400000 * 5,
    completedAt: null,
  },
  {
    id: 'task_default_006',
    title: '优化暗色模式支持',
    description: '修复所有页面在暗色模式下的显示问题',
    status: 'todo',
    priority: 'low',
    assignee: null,
    tags: ['ui', 'dark-mode'],
    createdAt: Date.now() - 86400000,
    dueAt: Date.now() + 86400000 * 3,
    completedAt: null,
  },
]

const runningTasks = new Set<string>()

export class TasksService {
  getAll(): TaskRecord[] {
    if (tasksStore.size === 0) this.seedDefaults()
    return Array.from(tasksStore.values())
  }

  getById(id: string): TaskRecord | undefined {
    if (tasksStore.size === 0) this.seedDefaults()
    return tasksStore.get(id)
  }

  create(data: Omit<TaskRecord, 'id' | 'createdAt'>): TaskRecord {
    if (tasksStore.size === 0) this.seedDefaults()
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const task: TaskRecord = { ...data, id, createdAt: Date.now() }
    tasksStore.set(id, task)
    return task
  }

  update(id: string, updates: Partial<TaskRecord>): TaskRecord | null {
    const existing = tasksStore.get(id)
    if (!existing) return null
    const updated = { ...existing, ...updates }
    tasksStore.set(id, updated)
    return updated
  }

  delete(id: string): boolean {
    return tasksStore.delete(id)
  }

  setStatus(id: string, status: TaskRecord['status']): TaskRecord | null {
    const existing = tasksStore.get(id)
    if (!existing) return null
    const completedAt = status === 'done' ? Date.now() : existing.completedAt
    const updated = { ...existing, status, completedAt }
    tasksStore.set(id, updated)
    return updated
  }

  async execute(taskId: string): Promise<{ success: boolean; error?: string }> {
    const task = tasksStore.get(taskId)
    if (!task) return { success: false, error: `任务不存在：${taskId}` }

    runningTasks.add(taskId)
    this.setStatus(taskId, 'in_progress')

    try {
      // 模拟执行延迟
      await new Promise((resolve) => setTimeout(resolve, 500))
      this.setStatus(taskId, 'done')
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    } finally {
      runningTasks.delete(taskId)
    }
  }

  abort(taskId: string): boolean {
    // 实际中止逻辑：从 engine 层面取消正在运行的任务
    // 目前仅从 runningTasks 移除
    if (runningTasks.has(taskId)) {
      runningTasks.delete(taskId)
      return true
    }
    return false
  }

  getRunning(): Array<{ taskId: string; aborted: boolean }> {
    return Array.from(runningTasks).map((taskId) => ({ taskId, aborted: false }))
  }

  private seedDefaults(): void {
    for (const task of DEFAULT_TASKS) {
      if (!tasksStore.has(task.id)) {
        tasksStore.set(task.id, task)
      }
    }
  }
}

export const tasksService = new TasksService()
export default tasksService
