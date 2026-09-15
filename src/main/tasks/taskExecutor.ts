/**
 * main/tasks/taskExecutor.ts — 任务执行器
 *
 * 职责：
 * - 将任务标题+描述作为 prompt 调用 QueryEngine.query()
 * - 实时接收 AgentEvent 流，写入任务 executionLog
 * - 任务状态流转：todo → in_progress → done（成功）/ cancelled（错误/中止）
 * - 执行完成后将 AI 回复保存到 task.result
 * - 支持中止执行
 */

import { getEngineInstance } from '../engine-bridge'
import { tasksStore, type TaskRecord } from './tasksStore'
import type { AgentEvent } from '../../engine/messageLoop.ts'

interface TaskExecutorOptions {
  /** 任务 ID */
  taskId: string
  /** 执行完成后的回调 */
  onComplete?: (task: TaskRecord) => void
  /** 实时事件回调 */
  onEvent?: (event: AgentEvent & { logEntry: { time: number; event: string; detail?: string } }) => void
}

type AbortSignal = { aborted: boolean; reason?: string }

class TaskExecution {
  readonly taskId: string
  readonly abortSignal: AbortSignal
  readonly onComplete?: (task: TaskRecord) => void
  readonly onEvent?: (event: TaskExecutorOptions['onEvent']) => void

  private _aborted = false

  constructor(opts: TaskExecutorOptions) {
    this.taskId = opts.taskId
    this.abortSignal = { aborted: false }
    this.onComplete = opts.onComplete
    this.onEvent = opts.onEvent
  }

  abort(reason?: string): void {
    if (this._aborted) return
    this._aborted = true
    this.abortSignal.aborted = true
    this.abortSignal.reason = reason
    void this.finish('cancelled', reason || '用户中止执行')
  }

  get aborted(): boolean {
    return this._aborted
  }

  async execute(): Promise<void> {
    const task = tasksStore.getById(this.taskId)
    if (!task) return

    // 标记进行中
    tasksStore.update(this.taskId, {
      status: 'in_progress',
      executionLog: [],
    })

    const engine = getEngineInstance()
    if (!engine) {
      await this.finish('cancelled', '引擎未初始化')
      return
    }

    const prompt = `【任务标题】${task.title}\n【任务描述】${task.description}`

    try {
      const result = await engine.query(prompt, (event: AgentEvent) => {
        if (this._aborted) return

        const logEntry = this.eventToLog(event)
        // 追加到任务日志
        const current = tasksStore.getById(this.taskId)
        if (current) {
          const logs = [...(current.executionLog || []), logEntry]
          tasksStore.update(this.taskId, { executionLog: logs })
        }
        this.onEvent?.({ ...event, logEntry })
      })

      if (this._aborted) return

      const lastMsg = result.messages?.[result.messages.length - 1]
      const content = typeof lastMsg?.content === 'string' ? lastMsg.content : ''

      await this.finish('done', undefined, content)
    } catch (e) {
      if (this._aborted) return
      const msg = e instanceof Error ? e.message : String(e)
      await this.finish('cancelled', `执行出错：${msg}`)
    }
  }

  private async finish(status: TaskRecord['status'], errorDetail?: string, resultText?: string): Promise<void> {
    const patch: Partial<TaskRecord> = {
      status,
      completedAt: status === 'done' || status === 'cancelled' ? Date.now() : undefined,
      ...(errorDetail ? { executionLog: [...(tasksStore.getById(this.taskId)?.executionLog || []), { time: Date.now(), event: 'error', detail: errorDetail }] } : {}),
      ...(resultText !== undefined ? { result: resultText } : {}),
    }
    tasksStore.update(this.taskId, patch)
    const updated = tasksStore.getById(this.taskId)
    if (updated) this.onComplete?.(updated)
  }

  private eventToLog(event: AgentEvent): { time: number; event: string; detail?: string } {
    const now = Date.now()
    switch (event.type) {
      case 'response_chunk':
        return { time: now, event: 'response_chunk', detail: `+${(event.content as string).length} chars` }
      case 'reasoning':
        return { time: now, event: 'reasoning', detail: (event.text as string).slice(0, 120) }
      case 'tool_call_start':
        return { time: now, event: 'tool_start', detail: `${event.toolName}(${JSON.stringify(event.input).slice(0, 80)})` }
      case 'tool_result':
        return { time: now, event: 'tool_result', detail: `${event.isError ? '✗' : '✓'} ${(event.content as string).slice(0, 80)}` }
      case 'post_tool_use':
        return { time: now, event: 'post_tool', detail: `${event.toolName} ${event.success ? 'success' : 'failed'}` }
      case 'iteration_start':
        return { time: now, event: 'iteration', detail: `#${event.iteration}` }
      case 'iteration_end':
        return { time: now, event: 'iteration_end', detail: `#${event.iteration} toolCalls=${event.hasToolCalls}` }
      case 'done':
        return { time: now, event: 'done', detail: `iterations=${event.result.iterations}` }
      case 'error':
        return { time: now, event: 'error', detail: event.error }
      case 'aborted':
        return { time: now, event: 'aborted' }
      case 'needs_user':
        return { time: now, event: 'needs_user', detail: event.prompt?.slice(0, 80) }
      case 'pre_tool_use':
        return { time: now, event: 'pre_tool', detail: event.toolName }
      default:
        return { time: now, event: event.type }
    }
  }
}

// 全局执行注册表（支持并发执行多个任务）
const executions = new Map<string, TaskExecution>()

export function executeTask(opts: TaskExecutorOptions): TaskExecution | null {
  // 如果任务已在执行，返回已有实例
  const existing = executions.get(opts.taskId)
  if (existing && !existing.aborted) {
    return existing
  }
  const exec = new TaskExecution(opts)
  executions.set(opts.taskId, exec)
  void exec.execute()
  return exec
}

export function abortTask(taskId: string, reason?: string): boolean {
  const exec = executions.get(taskId)
  if (!exec) return false
  exec.abort(reason)
  executions.delete(taskId)
  return true
}

export function getRunningExecutions(): { taskId: string; aborted: boolean }[] {
  return Array.from(executions.entries()).map(([taskId, exec]) => ({
    taskId,
    aborted: exec.aborted,
  }))
}
