/**
 * engine/tasks/types.ts — 任务系统核心类型定义
 *
 * 吸收自 D:\src\Task.ts 的类型体系。
 */

/** 任务类型 */
export type TaskType = 'agent' | 'human' | 'shell' | 'plan' | 'workflow'

/** 任务状态 */
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked'

/** 是否为终止态任务状态 */
export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return ['completed', 'failed', 'cancelled'].includes(status)
}

/** 任务句柄 */
export interface TaskHandle {
  id: string
  cancel(): void
  onProgress(cb: (progress: TaskProgress) => void): () => void
}

/** 任务进度 */
export interface TaskProgress {
  percent: number
  message?: string
  stage?: string
}

/** 任务状态基类 */
export interface TaskStateBase {
  id: string
  type: TaskType
  status: TaskStatus
  createdAt: number
  updatedAt: number
  metadata: Record<string, unknown>
}

/** 创建任务状态基类 */
export function createTaskStateBase(type: TaskType, metadata: Record<string, unknown> = {}): TaskStateBase {
  const now = Date.now()
  return {
    id: `${type}_${now}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    metadata,
  }
}
