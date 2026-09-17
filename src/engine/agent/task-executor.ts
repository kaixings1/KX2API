/**
 * TaskExecutor — 子任务执行器 + 进度追踪 + 结果校验
 *
 * 职责：
 *   1. 按依赖关系顺序执行子任务
 *   2. 每个子任务执行后自动校验结果（非空检查、错误码检查）
 *   3. 失败自动重试（最多 N 次）
 *   4. 结果合并为最终输出
 *   5. 全程进度可观测
 *   6. 崩溃后自动续跑
 *
 * 用法：
 *   const executor = new TaskExecutor({ registry: commandRegistry, toolCollection })
 *   const result = await executor.execute(plan, {
 *     onProgress: (current, total, subtask) => console.log(`${current}/${total}: ${subtask.description}`),
 *     onComplete: (finalResult) => console.log("全部完成"),
 *   })
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { type Command, commandRegistry } from "../commands/registry.ts"
import { type CommandRunner, commandRunners } from "./command-runners.ts"
import { type DecompositionPlan, type SubTaskResult, type Subtask, TaskDecomposer } from "./task-decomposer.ts"

// ==================== 类型定义 ====================

export interface ExecutorOptions {
  /** 命令注册表 */
  registry?: typeof commandRegistry
  /** 命令运行器映射 */
  runners?: typeof commandRunners
  /** 工作目录 */
  cwd?: string
  /** 子任务重试次数 */
  maxRetries?: number
  /** 结果校验器 */
  validators?: Map<string, (output: string) => boolean>
  /** 持久化目录（断点续跑） */
  stateDir?: string
  /** LLM 配置（用于 llm 类型子任务） */
  /** LLM 配置（用于 llm 类型子任务）；形状与 ApiConfig 对齐，避免两侧漂移 */
  llmConfig?: {
    provider: 'anthropic' | 'openai' | 'custom'
    apiKey: string
    model: string
    baseUrl?: string
    maxTokens?: number
  }
}

export interface ExecuteResult {
  /** 是否全部成功 */
  success: boolean
  /** 合并后的最终输出 */
  output: string
  /** 每个子任务的结果 */
  subtaskResults: SubTaskResult[]
  /** 总耗时 */
  totalDurationMs: number
  /** 失败的子任务 */
  failedSubtasks: Array<{ id: number; description: string; error: string }>
}

export type ProgressCallback = (current: number, total: number, subtask: Subtask) => void
export type CompleteCallback = (result: ExecuteResult) => void

// ==================== 执行器 ====================

export class TaskExecutor {
  private registry: typeof commandRegistry
  private runners: typeof commandRunners
  private cwd: string
  private maxRetries: number
  private validators: Map<string, (output: string) => boolean>
  private stateDir: string
  private llmConfig?: ExecutorOptions["llmConfig"]

  constructor(opts: ExecutorOptions = {}) {
    this.registry = opts.registry ?? commandRegistry
    this.runners = opts.runners ?? commandRunners
    this.cwd = opts.cwd ?? process.cwd()
    this.maxRetries = opts.maxRetries ?? 2
    this.validators = opts.validators ?? new Map()
    this.stateDir = opts.stateDir ?? path.join(".kx2code", "tasks")
    this.llmConfig = opts.llmConfig
  }

  /**
   * 执行完整计划
   */
  async execute(
    plan: DecompositionPlan,
    callbacks?: { onProgress?: ProgressCallback; onComplete?: CompleteCallback }
  ): Promise<ExecuteResult> {
    const startTime = Date.now()
    const results: SubTaskResult[] = []
    const failed: ExecuteResult["failedSubtasks"] = []
    let aborted = false

    // 检查是否需要续跑
    const resumeFrom = this.findResumePoint(plan)

    for (let i = 0; i < plan.subtasks.length; i++) {
      const subtask = plan.subtasks[i]

      // 如果这个子任务已经成功完成，跳过
      if (subtask.result?.success && subtask.id <= resumeFrom) {
        results.push(subtask.result)
        callbacks?.onProgress?.(i + 1, plan.subtasks.length, subtask)
        continue
      }

      // 检查依赖是否都已完成
      if (subtask.dependsOn && subtask.dependsOn.length > 0) {
        const depsMet = subtask.dependsOn.every(
          (depId) => results.some((r) => r.success && plan.subtasks.find((s) => s.id === depId)?.result?.success)
        )
        if (!depsMet) {
          const depErrors = subtask.dependsOn
            .map((id) => {
              const dep = plan.subtasks.find((s) => s.id === id)
              return dep?.result?.error ? `#${id}: ${dep.result.error}` : null
            })
            .filter(Boolean)
          results.push({
            success: false,
            output: "",
            error: `依赖未满足: ${depErrors?.join(", ")}`,
            durationMs: 0,
          })
          failed.push({ id: subtask.id, description: subtask.description, error: "依赖未满足" })
          continue
        }
      }

      // 执行子任务（带重试）
      let attempts = 0
      let lastResult: SubTaskResult | null = null

      while (attempts <= this.maxRetries) {
        attempts++
        try {
          lastResult = await this.executeSubtask(subtask, results)
        } catch (e) {
          lastResult = {
            success: false,
            output: "",
            error: (e as Error).message,
            durationMs: 0,
          }
        }

        // 校验结果
        if (lastResult.success && !this.validateResult(subtask, lastResult)) {
          lastResult.success = false
          lastResult.error = `结果校验失败: 输出不符合预期`
        }

        // 更新计划中的子任务结果
        subtask.result = lastResult
        this.persistPlan(plan)

        if (lastResult.success) break
        if (attempts <= this.maxRetries) {
          console.log(`[Executor] 子任务 #${subtask.id} 重试 ${attempts}/${this.maxRetries}: ${subtask.description}`)
        }
      }

      results.push(lastResult!)

      if (!lastResult!.success) {
        failed.push({ id: subtask.id, description: subtask.description, error: lastResult!.error ?? "未��错误" })
        // 非关键子任务失败继续，关键失败中断
        if (!subtask.toolHint) {
          aborted = true
          break
        }
      }

      callbacks?.onProgress?.(i + 1, plan.subtasks.length, subtask)
    }

    // 合并结果
    const mergedOutput = this.mergeResults(results, plan)

    const totalDurationMs = Date.now() - startTime
    const finalResult: ExecuteResult = {
      success: failed.length === 0 && !aborted,
      output: mergedOutput,
      subtaskResults: results,
      totalDurationMs,
      failedSubtasks: failed,
    }

    // 持久化最终结果
    this.persistResult(plan, finalResult)

    callbacks?.onComplete?.(finalResult)
    return finalResult
  }

  // ==================== 子任务执行 ====================

  private async executeSubtask(subtask: Subtask, previousResults: SubTaskResult[]): Promise<SubTaskResult> {
    const startTime = Date.now()
    const toolName = subtask.toolHint
    const args = subtask.args ?? []

    // 构建下游上下文（上游结果注入）
    const context = this.buildContext(previousResults)

    let output = ""

    if (toolName) {
      // 优先从 commandRunners 查找
      const runner = this.runners.get(toolName)
      if (runner) {
        output = await runner.execute([...args, ...(context.args ?? [])], this.cwd, this.toLlmConfig())
      } else {
        // 降级：从 commandRegistry 查找
        const cmd = this.registry.get(toolName)
        if (cmd) {
          const result = await cmd.execute([...args, ...(context.args ?? [])])
          output = result.error || result.output || "命令执行完成"
        } else {
          output = `[Executor] 工具 "${toolName}" 未找到，跳过`
        }
      }
    } else {
      // 无 toolHint：作为自由文本任务，返回上下文摘要
      output = `[Executor] 子任务: ${subtask.description}\n上下文:\n${context.summary}`
    }

    return {
      success: !output.includes("错误") && !output.includes("Error") && !output.includes("失败"),
      output,
      durationMs: Date.now() - startTime,
      artifact: { tool: toolName, args, context },
    }
  }

  // ==================== 结果校验 ====================

  private validateResult(subtask: Subtask, result: SubTaskResult): boolean {
    // 基础校验：必须有输出
    if (!result.output || result.output.trim().length === 0) return false

    // 校验器映射
    const validator = this.validators.get(subtask.toolHint ?? "")
    if (validator) return validator(result.output)

    // 默认校验：不包含致命错误标记
    const errorMarkers = ["FATAL", "segmentation fault", "Out of memory", "Unhandled"]
    return !errorMarkers.some((m) => result.output.includes(m))
  }

  // ==================== 结果合并 ====================

  private mergeResults(results: SubTaskResult[], plan: DecompositionPlan): string {
    if (results.length === 0) return "无结果"

    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    const parts: string[] = []
    parts.push(`# 任务执行结果: ${plan.originalRequest}`)
    parts.push(`# 总子任务: ${results.length} | 成功: ${successful.length} | 失败: ${failed.length}`)
    parts.push("")

    for (const r of results) {
      const status = r.success ? "✓" : "✗"
      parts.push(`## [${status}] ${r.success ? "成功" : "失败"} (${r.durationMs}ms)`)
      parts.push(r.output.slice(0, 2000))
      if (r.error) parts.push(`错误: ${r.error}`)
      parts.push("")
    }

    return parts.join("\n")
  }

  // ==================== 持久化 ====================

  private persistPlan(plan: DecompositionPlan): void {
    try {
      fs.mkdirSync(this.stateDir, { recursive: true })
      const file = path.join(this.stateDir, `${plan.sessionId}.plan.json`)
      const tmp = file + ".tmp"
      fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), "utf-8")
      fs.renameSync(tmp, file)
    } catch { /* ignore */ }
  }

  private findResumePoint(plan: DecompositionPlan): number {
    const completed = plan.subtasks.filter((s) => s.result?.success)
    if (completed.length === 0) return 0
    return Math.max(...completed.map((s) => s.id))
  }

  // ==================== 上下文构建 ====================

  private buildContext(previousResults: SubTaskResult[]): { summary: string; args?: string[] } {
    if (previousResults.length === 0) return { summary: "" }

    const successful = previousResults.filter((r) => r.success)
    if (successful.length === 0) return { summary: "(前序步骤均失败)" }

    const summary = successful
      .map((r, i) => `[步骤 ${i + 1}] ${r.output.slice(0, 500)}`)
      .join("\n\n")

    return { summary, args: [] }
  }

  private toLlmConfig() {
    if (!this.llmConfig) return undefined
    const { provider, apiKey, model, baseUrl, maxTokens } = this.llmConfig
    // 条件展开：ApiConfig 的可选字段不接受显式 undefined
    return {
      provider,
      apiKey,
      model,
      ...(baseUrl ? { baseUrl } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
    }
  }

  // ==================== 结果持久化 ====================

  private persistResult(plan: DecompositionPlan, result: ExecuteResult): void {
    try {
      fs.mkdirSync(this.stateDir, { recursive: true })
      const file = path.join(this.stateDir, `${plan.sessionId}.result.json`)
      const tmp = file + ".tmp"
      fs.writeFileSync(
        tmp,
        JSON.stringify(
          {
            sessionId: plan.sessionId,
            originalRequest: plan.originalRequest,
            success: result.success,
            totalDurationMs: result.totalDurationMs,
            subtaskCount: plan.subtasks.length,
            successCount: result.subtaskResults.filter((r) => r.success).length,
            failedSubtasks: result.failedSubtasks,
            finishedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        "utf-8"
      )
      fs.renameSync(tmp, file)

      // 完成标记
      const doneFile = path.join(this.stateDir, `${plan.sessionId}.done`)
      fs.writeFileSync(doneFile, result.success ? "SUCCESS" : "FAILED", "utf-8")
    } catch { /* ignore */ }
  }
}

export default TaskExecutor
