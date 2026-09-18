/**
 * engine/orchestrator/teamRunner.ts — TeamRunner
 *
 * 连接 Orchestrator 和任务执行的胶水层。
 *
 * 吸收自 D:\src\engine\orchestrator\teamRunner.ts。
 * KX2API 版简化了 TaskEngine 依赖，直接包装 Orchestrator 执行。
 */

import { Orchestrator, type OrchestratorDeps } from './orchestrator.ts'
import type { OrchestratorConfig, OrchestrationResult } from './messages.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeamRunnerEvent =
  | { type: 'task_submitted'; taskId: string; description: string }
  | { type: 'orchestrator_started'; mode: string }
  | { type: 'stage_started'; stage: string; role: string }
  | { type: 'stage_completed'; stage: string; role: string; duration: number }
  | { type: 'stage_failed'; stage: string; role: string; error: string }
  | { type: 'orchestrator_completed'; result: OrchestrationResult }
  | { type: 'task_completed'; task: Task }
  | { type: 'task_failed'; task: Task; error: string }

/** 简化任务接口（用于 TeamRunner 状态回写） */
export interface Task {
  id: string
  description: string
}

export interface TeamRunnerOptions {
  /** 编排器配置 */
  orchestratorConfig?: Partial<OrchestratorConfig>
  /** LLM 调用函数 */
  llmCall: (role: string, systemPrompt: string, userPrompt: string, context: string) => Promise<string>
  /** 进度回调 */
  onProgress?: (event: TeamRunnerEvent) => void
}

export interface TeamRunnerResult {
  status: 'completed' | 'failed'
  result?: string
  error?: string
}

// ---------------------------------------------------------------------------
// TeamRunner
// ---------------------------------------------------------------------------

export class TeamRunner {
  private orchestrator: Orchestrator
  private llmCall: (role: string, systemPrompt: string, userPrompt: string, context: string) => Promise<string>
  private onProgress?: (event: TeamRunnerEvent) => void
  private taskCounter = 0

  constructor(options: TeamRunnerOptions) {
    this.llmCall = options.llmCall
    this.onProgress = options.onProgress

    const deps: OrchestratorDeps = {
      executeLLM: (role, systemPrompt, userPrompt, context) =>
        this.executeRole(role, systemPrompt, userPrompt, context),
    }

    this.orchestrator = new Orchestrator(options.orchestratorConfig, deps)
  }

  /**
   * 提交并执行任务
   */
  async submitAndRun(description: string): Promise<TeamRunnerResult> {
    this.taskCounter++
    const taskId = `task_${this.taskCounter}_${Date.now()}`
    this.emit({ type: 'task_submitted', taskId, description })

    this.emit({ type: 'orchestrator_started', mode: this.orchestrator['config'].mode })

    try {
      const result = await this.orchestrator.run(description)

      this.emit({
        type: 'orchestrator_completed',
        result,
      })

      if (result.success) {
        return { status: 'completed', result: result.mergedOutput }
      } else {
        return { status: 'failed', error: result.mergedOutput || 'Orchestration failed' }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Task failed'
      this.emit({
        type: 'task_failed',
        task: { id: taskId, description } as Task,
        error: errorMessage,
      })
      return { status: 'failed', error: errorMessage }
    }
  }

  /**
   * 执行角色（注入 LLM 调用）
   */
  private async executeRole(role: string, systemPrompt: string, userPrompt: string, context: string): Promise<string> {
    this.emit({ type: 'stage_started', stage: role, role })

    try {
      const output = await this.llmCall(role, systemPrompt, userPrompt, context)
      this.emit({ type: 'stage_completed', stage: role, role, duration: 0 })
      return output
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      this.emit({ type: 'stage_failed', stage: role, role, error })
      throw err
    }
  }

  /**
   * 发送事件
   */
  private emit(event: TeamRunnerEvent): void {
    if (this.onProgress) {
      this.onProgress(event)
    }
  }
}

// ---------------------------------------------------------------------------
// 便捷函数
// ---------------------------------------------------------------------------

export function createTeamRunner(options: TeamRunnerOptions): TeamRunner {
  return new TeamRunner(options)
}
