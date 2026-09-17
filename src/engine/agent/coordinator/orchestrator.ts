/**
 * Orchestrator — 多目标协调器
 *
 * 职责：
 *   1. 接收高层目标（可能包含多个子目标）
 *   2. 用 Planner 生成执行计划（多角色讨论）
 *   3. 执行计划（并行/串行任务）
 *   4. 生成执行报告
 *   5. 全程持久化，支持断点续跑
 *
 * 用法：
 *   const orchestrator = new Orchestrator({ llm: { provider, apiKey, model } })
 *   const report = await orchestrator.execute({
 *     id: "obj-1",
 *     description: "重构认证模块并写测试",
 *   })
 *   // report 包含所有任务的执行结果、讨论记录、总耗时
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { TaskExecutor } from "../task-executor.ts"
import { TaskDecomposer } from "../task-decomposer.ts"
import { Planner, BUILTIN_ROLES } from "./planner.ts"
import type {
  AgentRole,
  CoordinatorConfig,
  CoordinatorCallbacks,
  DiscussionRound,
  ExecutionReport,
  Objective,
  Plan,
  TaskNode,
  TaskNodeResult,
} from "./types.ts"
import { type DecompositionPlan, type SubTaskResult } from "../task-decomposer.ts"
import { commandRegistry } from "../../commands/registry.ts"

// ==================== Orchestrator ====================

export class Orchestrator {
  private config: CoordinatorConfig
  private callbacks?: CoordinatorCallbacks
  private roles: AgentRole[]

  constructor(config: CoordinatorConfig, callbacks?: CoordinatorCallbacks, roles?: AgentRole[]) {
    this.config = {
      maxDiscussionRounds: config.maxDiscussionRounds ?? 3,
      maxParallelTasks: config.maxParallelTasks ?? 4,
      maxRetries: config.maxRetries ?? 2,
      plansDir: config.plansDir ?? path.join(".kx2code", "plans"),
      cwd: config.cwd ?? process.cwd(),
      ...config,
    }
    this.callbacks = callbacks
    this.roles = roles ?? BUILTIN_ROLES
  }

  /**
   * 执行一个高层目标
   *
   * 流程：
   *   1. 检查是否有未完成的计划（续跑）
   *   2. 如果有子目标，递归执行
   *   3. 生成计划（多角色讨论）
   *   4. 执行计划
   *   5. 返回报告
   */
  async execute(objective: Objective): Promise<ExecutionReport> {
    const startTime = Date.now()
    const plans: Plan[] = []
    const allTaskResults: ExecutionReport["taskResults"] = []
    const allDiscussions: DiscussionRound[] = []

    // 递归处理子目标
    if (objective.subObjectives && objective.subObjectives.length > 0) {
      for (const sub of objective.subObjectives) {
        const report = await this.execute(sub)
        allTaskResults.push(...report.taskResults)
        // discussions 来自 plan.discussions，不在 report 中
      }
      return this.buildReport(objective.id, startTime, allTaskResults, allDiscussions, "子目标全部执行完成")
    }

    // 单目标：检查是否有未完成的计划
    const existingPlan = this.tryResumePlan(objective.id)
    if (existingPlan && existingPlan.status === "executing") {
      // 恢复执行
      return await this.resumePlan(objective, existingPlan, startTime)
    }

    // 生成新计划
    this.callbacks?.onPhaseChange?.("planning", `为目标 "${objective.description}" 生成执行计划`)

    const planner = new Planner({
      config: this.config,
      roles: this.roles,
      callbacks: this.callbacks,
    })

    const plan = await planner.generatePlan({ id: objective.id, description: objective.description })
    plans.push(plan)

    // 持久化计划
    this.persistPlan(plan)

    this.callbacks?.onPlanGenerated?.(plan)

    // 执行计划
    const taskResults = await this.executePlan(plan)
    allTaskResults.push(...taskResults)

    // 收集讨论记录
    allDiscussions.push(...plan.discussions)

    // 标记完成
    plan.status = "completed"
    this.persistPlan(plan)

    const report = this.buildReport(objective.id, startTime, allTaskResults, allDiscussions, `目标执行完成: ${objective.description}`)
    this.persistReport(report)
    return report
  }

  // ==================== 计划执行 ====================

  private async executePlan(plan: Plan): Promise<ExecutionReport["taskResults"]> {
    const results: ExecutionReport["taskResults"] = []

    // 按策略分组任务
    const sequential = plan.tasks.filter((t) => t.strategy === "sequential")
    const parallel = plan.tasks.filter((t) => t.strategy === "parallel")
    const standalone = plan.tasks.filter((t) => t.strategy === "standalone")

    // 执行串行任务
    for (const task of sequential) {
      const result = await this.executeTask(task, plan)
      results.push(result)
    }

    // 执行并行任务
    for (const task of parallel) {
      // 检查依赖是否满足
      const depsMet = task.dependsOn.every(
        (depId) => results.some((r) => r.taskId === depId && r.success)
      )
      if (!depsMet) {
        results.push({
          taskId: task.id,
          description: task.description,
          success: false,
          output: "",
          error: `依赖未满足: ${task.dependsOn.join(", ")}`,
          durationMs: 0,
        })
        continue
      }

      // 并行执行（限制并发数）
      const result = await this.executeTask(task, plan)
      results.push(result)
    }

    // 执行独立任务
    for (const task of standalone) {
      const result = await this.executeTask(task, plan)
      results.push(result)
    }

    return results
  }

  private async executeTask(task: TaskNode, plan: Plan): Promise<ExecutionReport["taskResults"][0]> {
    const startTime = Date.now()

    this.callbacks?.onTaskStart?.(task)

    let output = ""
    let success = false
    let error: string | undefined

    // 使用 commandRunners 执行
    if (task.command) {
      try {
        const { commandRunners } = await import("../command-runners.ts")
        const runner = commandRunners.get(task.command)
        if (runner) {
          output = await runner.execute(task.args ?? [], this.config.cwd ?? process.cwd())
          success = true
        } else {
          // 降级：从 registry 查找
          const cmd = commandRegistry.get(task.command)
          if (cmd) {
            const result = await cmd.execute(task.args ?? [])
            output = result.error || result.output || "命令执行完成"
            success = true
          } else {
            output = `[Orchestrator] 工具 "${task.command}" 未找到，跳过`
            error = `Unknown command: ${task.command}`
          }
        }
      } catch (e) {
        error = (e as Error).message
        output = `执行失败: ${error}`
      }
    } else {
      // 无 command：返回任务描述作为输出
      output = `[Orchestrator] 任务: ${task.description}\n(无具体命令，需要手动处理)`
      success = true
    }

    const durationMs = Date.now() - startTime

    const taskResult: TaskNodeResult & { taskId: string; description: string } = {
      taskId: task.id,
      description: task.description,
      success,
      output: output.slice(0, 5000),
      error,
      durationMs,
      executedAt: new Date().toISOString(),
    }

    // 更新 plan 中的任务结果
    task.result = {
      success,
      output: output.slice(0, 5000),
      error,
      durationMs,
      executedAt: taskResult.executedAt,
    }

    this.persistPlan(plan)
    this.callbacks?.onTaskComplete?.(task, taskResult)

    return taskResult
  }

  // ==================== 续跑 ====================

  private tryResumePlan(objectiveId: string): Plan | null {
    try {
      // 按 uniquePath 规则查找最新版本：base.ext > base-1.ext > base-2.ext ...
      const dir = this.config.plansDir!
      const candidates = new Set<string>()
      for (const f of fs.readdirSync(dir)) {
        if (f === `${objectiveId}.plan.json` || f.startsWith(`${objectiveId}-`)) {
          candidates.add(f)
        }
      }
      if (candidates.size === 0) return null

      // 按文件名排序（数字后缀越大越新）
      const sorted = [...candidates].sort((a, b) => {
        const aNum = a === `${objectiveId}.plan.json` ? 0 : parseInt(a.slice(`${objectiveId}-`.length, -11), 10) || 0
        const bNum = b === `${objectiveId}.plan.json` ? 0 : parseInt(b.slice(`${objectiveId}-`.length, -11), 10) || 0
        return bNum - aNum
      })

      for (const f of sorted) {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"))
        if (data.status === "executing" || data.status === "draft") {
          return data as Plan
        }
      }
    } catch { /* ignore */ }
    return null
  }

  private async resumePlan(objective: Objective, plan: Plan, startTime: number): Promise<ExecutionReport> {
    const allTaskResults: ExecutionReport["taskResults"] = []
    const allDiscussions: DiscussionRound[] = [...plan.discussions]

    // 找出未完成的任务
    const completedIds = new Set(
      plan.tasks.filter((t) => t.result?.success).map((t) => t.id)
    )
    const pendingTasks = plan.tasks.filter((t) => !completedIds.has(t.id))

    console.log(`[Orchestrator] 续跑: ${pendingTasks.length} 个任务待执行`)

    // 执行剩余任务
    for (const task of pendingTasks) {
      const result = await this.executeTask(task, plan)
      allTaskResults.push(result)
    }

    // 收集已完成的任务结果
    for (const task of plan.tasks) {
      if (task.result) {
        allTaskResults.push({
          taskId: task.id,
          description: task.description,
          success: task.result.success,
          output: task.result.output,
          error: task.result.error,
          durationMs: task.result.durationMs,
        })
      }
    }

    plan.status = "completed"
    this.persistPlan(plan)

    const report = this.buildReport(objective.id, startTime, allTaskResults, allDiscussions, "续跑完成")
    this.persistReport(report)
    return report
  }

  // ==================== 报告 ====================

  private buildReport(
    objectiveId: string,
    startTime: number,
    taskResults: ExecutionReport["taskResults"],
    discussions: DiscussionRound[],
    conclusion: string,
  ): ExecutionReport {
    const successful = taskResults.filter((r) => r.success).length
    const failed = taskResults.filter((r) => !r.success).length

    return {
      planId: objectiveId,
      success: failed === 0,
      taskResults,
      totalDurationMs: Date.now() - startTime,
      discussions,
      conclusion,
      finishedAt: new Date().toISOString(),
    }
  }

  // ==================== 持久化 ====================

  /**
   * 返回不覆盖已有文件的唯一路径。
   * 规则：先试 baseName.ext，若存在则 baseName-1.ext，再存在 baseName-2.ext，依此类推。
   */
  private uniquePath(dir: string, baseName: string, ext: string): string {
    fs.mkdirSync(dir, { recursive: true })
    let candidate = path.join(dir, `${baseName}${ext}`)
    let seq = 1
    while (fs.existsSync(candidate)) {
      candidate = path.join(dir, `${baseName}-${seq}${ext}`)
      seq++
    }
    return candidate
  }

  private persistPlan(plan: Plan): void {
    try {
      const file = this.uniquePath(this.config.plansDir!, plan.objectiveId, ".plan.json")
      const tmp = file + ".tmp"
      fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), "utf-8")
      fs.renameSync(tmp, file)
    } catch { /* ignore */ }
  }

  /** 持久化执行报告 */
  persistReport(report: ExecutionReport): void {
    try {
      const file = this.uniquePath(this.config.plansDir!, report.planId, ".report.json")
      const tmp = file + ".tmp"
      fs.writeFileSync(tmp, JSON.stringify(report, null, 2), "utf-8")
      fs.renameSync(tmp, file)
    } catch { /* ignore */ }
  }
}

export default Orchestrator
