/**
 * engine/unifiedScheduler.ts — 统一调度器
 *
 * 调度 TodoV2 任务列表，对每个可执行任务判断走"单 agent 直接执行"
 * 还是"多角色编排"（TeamRunner）。
 *
 * 吸收自 D:\src\engine\unifiedScheduler.ts。
 * KX2API 版已适配现有工具系统（utils/tasks.ts + orchestrator/teamRunner.ts）。
 */

import type { Task } from './utils/tasks.ts'
import {
  listTasks,
  claimTask,
  updateTask,
  getTaskListId,
  onTasksUpdated,
  notifyTasksUpdated,
} from './utils/tasks.ts'
import { createTeamRunner, type TeamRunner } from './orchestrator/teamRunner.ts'
import { type OrchestratorConfig } from './orchestrator/messages.ts'
import { logForDebugging } from './utils/debug.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SchedulerMode = 'auto' | 'single' | 'orchestrated'

export interface SchedulerOptions {
  /** 调度模式：auto=自动判断, single=单agent, orchestrated=多角色编排 */
  mode?: SchedulerMode
  /** 编排器配置（orchestrated 模式使用） */
  orchestratorConfig?: Partial<OrchestratorConfig>
  /** LLM 调用函数 */
  llmCall: (role: string, systemPrompt: string, userPrompt: string, context: string) => Promise<string>
  /** 进度回调 */
  onProgress?: (event: SchedulerEvent) => void
  /** 判断任务是否需要多角色编排。默认：description 长度 > 50 且包含"重构/架构/设计/实现/测试"等关键词 */
  needsOrchestration?: (task: Task) => boolean
  /** 轮询间隔（ms），默认 2000 */
  pollIntervalMs?: number
}

export type SchedulerEvent =
  | { type: 'scheduler_started'; taskListId: string; mode: SchedulerMode }
  | { type: 'task_discovered'; taskId: string; subject: string }
  | { type: 'task_routing'; taskId: string; mode: 'single' | 'orchestrated'; reason: string }
  | { type: 'task_claimed'; taskId: string }
  | { type: 'orchestration_started'; taskId: string }
  | { type: 'orchestration_stage'; taskId: string; stage: string; role: string }
  | { type: 'orchestration_completed'; taskId: string; success: boolean; summary: string }
  | { type: 'task_completed'; taskId: string; output: string }
  | { type: 'task_failed'; taskId: string; error: string }
  | { type: 'task_released'; taskId: string; reason: string }
  | { type: 'scheduler_stopped' }

// ---------------------------------------------------------------------------
// UnifiedScheduler
// ---------------------------------------------------------------------------

export class UnifiedScheduler {
  private options: Required<SchedulerOptions>
  private taskListId: string
  private running = false
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private teamRunner: TeamRunner | null = null
  private executingTaskIds: Set<string> = new Set()

  constructor(options: SchedulerOptions) {
    this.options = {
      mode: options.mode ?? 'auto',
      orchestratorConfig: options.orchestratorConfig ?? {},
      llmCall: options.llmCall,
      onProgress: options.onProgress ?? (() => {}),
      needsOrchestration: options.needsOrchestration ?? defaultNeedsOrchestration,
      pollIntervalMs: options.pollIntervalMs ?? 2000,
    }
    this.taskListId = getTaskListId()
  }

  // -----------------------------------------------------------------------
  // 生命周期
  // -----------------------------------------------------------------------

  start(): void {
    if (this.running) return
    this.running = true
    this.emit({ type: 'scheduler_started', taskListId: this.taskListId, mode: this.options.mode })

    // 订阅任务列表变化
    this.unsubscribeTasksUpdated = onTasksUpdated(() => {
      this.schedulePoll()
    })

    // 初始扫描 + 轮询兜底
    void this.poll()
    this.pollTimer = setInterval(() => void this.poll(), this.options.pollIntervalMs)
    this.pollTimer.unref()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.unsubscribeTasksUpdated?.()
    this.unsubscribeTasksUpdated = undefined
    this.teamRunner = null
    this.emit({ type: 'scheduler_stopped' })
  }

  get isRunning(): boolean {
    return this.running
  }

  // -----------------------------------------------------------------------
  // 核心调度循环
  // -----------------------------------------------------------------------

  private pollDebounce: ReturnType<typeof setTimeout> | null = null

  private schedulePoll(): void {
    if (this.pollDebounce) clearTimeout(this.pollDebounce)
    this.pollDebounce = setTimeout(() => void this.poll(), 300)
    this.pollDebounce.unref()
  }

  private unsubscribeTasksUpdated: (() => void) | undefined

  private async poll(): Promise<void> {
    if (!this.running) return

    try {
      const tasks = await listTasks(this.taskListId)
      const available = findAvailableTasks(tasks)

      for (const task of available) {
        if (!this.running) break
        if (this.executingTaskIds.has(task.id)) continue
        await this.dispatchTask(task)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logForDebugging(`[Scheduler] poll error: ${message}`)
    }
  }

  // -----------------------------------------------------------------------
  // 任务分发
  // -----------------------------------------------------------------------

  private async dispatchTask(task: Task): Promise<void> {
    this.executingTaskIds.add(task.id)

    try {
      this.emit({ type: 'task_discovered', taskId: task.id, subject: task.subject })

      // 1. 认领任务
      const claimResult = await claimTask(this.taskListId, task.id, 'scheduler')
      if (!claimResult.success) {
        this.executingTaskIds.delete(task.id)
        this.emit({
          type: 'task_released',
          taskId: task.id,
          reason: claimResult.reason ?? 'claim_failed',
        })
        return
      }

      await updateTask(this.taskListId, task.id, { status: 'in_progress' })
      this.emit({ type: 'task_claimed', taskId: task.id })

      // 2. 路由决策
      const routeMode = this.resolveRouteMode(task)
      this.emit({
        type: 'task_routing',
        taskId: task.id,
        mode: routeMode,
        reason: routeMode === 'orchestrated' ? 'needs multi-role orchestration' : 'simple single-agent task',
      })

      // 3. 执行
      if (routeMode === 'orchestrated') {
        await this.runOrchestrated(task)
      } else {
        await this.runSingle(task)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      await this.failTask(task.id, message)
    } finally {
      this.executingTaskIds.delete(task.id)
    }
  }

  private resolveRouteMode(task: Task): 'single' | 'orchestrated' {
    if (this.options.mode === 'single') return 'single'
    if (this.options.mode === 'orchestrated') return 'orchestrated'
    // auto
    return this.options.needsOrchestration(task) ? 'orchestrated' : 'single'
  }

  // -----------------------------------------------------------------------
  // 单 agent 路径
  // -----------------------------------------------------------------------

  private async runSingle(task: Task): Promise<void> {
    const result = await this.options.llmCall(
      'engineer',
      'You are a general-purpose agent. Complete the task thoroughly.',
      task.description ?? task.subject,
      '',
    )
    await this.completeTask(task.id, result)
  }

  // -----------------------------------------------------------------------
  // 多角色编排路径（TeamRunner + Orchestrator）
  // -----------------------------------------------------------------------

  private async runOrchestrated(task: Task): Promise<void> {
    this.emit({ type: 'orchestration_started', taskId: task.id })

    if (!this.teamRunner) {
      this.teamRunner = createTeamRunner({
        orchestratorConfig: this.options.orchestratorConfig,
        llmCall: this.options.llmCall,
        onProgress: (event) => {
          if (event.type === 'stage_completed' || event.type === 'stage_failed') {
            this.emit({
              type: 'orchestration_stage',
              taskId: task.id,
              stage: event.stage,
              role: event.role,
            } as SchedulerEvent)
          }
          if (event.type === 'orchestrator_completed') {
            const success = event.result.success
            this.emit({
              type: 'orchestration_completed',
              taskId: task.id,
              success,
              summary: event.result.summary,
            })
            if (success) {
              this.completeTask(task.id, event.result.mergedOutput)
            } else {
              this.failTask(task.id, event.result.mergedOutput || 'Orchestration failed')
            }
          }
        },
      })
    }

    try {
      const result = await this.teamRunner.submitAndRun(task.description ?? task.subject)
      if (result.status === 'completed') {
        await this.completeTask(task.id, result.result ?? 'Done')
      } else {
        await this.failTask(task.id, result.error ?? 'Task failed')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      await this.failTask(task.id, message)
    }
  }

  // -----------------------------------------------------------------------
  // 状态回写
  // -----------------------------------------------------------------------

  private async completeTask(taskId: string, output: string): Promise<void> {
    await updateTask(this.taskListId, taskId, {
      status: 'completed',
      description: output.slice(0, 500),
    })
    this.emit({ type: 'task_completed', taskId, output })
    notifyTasksUpdated()
  }

  private async failTask(taskId: string, error: string): Promise<void> {
    await updateTask(this.taskListId, taskId, {
      status: 'completed',
      description: `[FAILED] ${error}`,
    })
    this.emit({ type: 'task_failed', taskId, error })
    notifyTasksUpdated()
  }

  // -----------------------------------------------------------------------
  // 事件发射
  // -----------------------------------------------------------------------

  private emit(event: SchedulerEvent): void {
    this.options.onProgress(event)
  }
}

// ---------------------------------------------------------------------------
// 默认编排判断函数
// ---------------------------------------------------------------------------

function defaultNeedsOrchestration(task: Task): boolean {
  const text = `${task.subject} ${task.description ?? ''}`.toLowerCase()
  if (text.length < 50) return false
  const orchestrationKeywords = [
    '重构', '架构', '设计', '实现', '编写', '测试', '部署',
    'refactor', 'architecture', 'design', 'implement', 'build', 'deploy',
    'rewrite', 'migrate', 'redesign',
  ]
  return orchestrationKeywords.some(kw => text.includes(kw))
}

// ---------------------------------------------------------------------------
// 可用任务筛选（尊重 blockedBy DAG）
// ---------------------------------------------------------------------------

function findAvailableTasks(tasks: Task[]): Task[] {
  const unresolvedTaskIds = new Set(
    tasks.filter(t => t.status !== 'completed').map(t => t.id),
  )

  return tasks.filter(task => {
    if (task.status !== 'pending') return false
    if (task.owner) return false
    return task.blockedBy.every(id => !unresolvedTaskIds.has(id))
  })
}

// ---------------------------------------------------------------------------
// 便捷函数
// ---------------------------------------------------------------------------

export function createUnifiedScheduler(options: SchedulerOptions): UnifiedScheduler {
  return new UnifiedScheduler(options)
}
