/**
 * TaskDecomposer — 复杂任务自动拆解器
 *
 * 职责：把用户的复杂请求拆成有序的子任务列表，每个子任务可独立执行、
 * 追踪进度、验证结果，最终合并为完整输出。
 *
 * 拆解策略：
 *   - llm 模式：调用 LLM 生成子任务分解（基于用户请求 + 可用工具列表）
 *   - static 模式：基于命令注册表静态分析（fallback，无需 LLM）
 *   - single 模式：单任务，不拆解
 *
 * 用法：
 *   const decomposer = new TaskDecomposer({ mode: 'llm', config: llmConfig })
 *   const plan = await decomposer.decompose("重构登录模块并写测试")
 *   // plan.subtasks = [
 *   //   { id: 1, desc: "分析登录模块现有代码", tool: "analyze" },
 *   //   { id: 2, desc: "重构 auth.ts 中的验证逻辑", tool: "refactor" },
 *   //   { id: 3, desc: "为重构后的代码生成单元测试", tool: "generate-test" },
 *   //   { id: 4, desc: "运行测试验证结果", tool: "test" },
 *   // ]
 *   // plan.mergeStrategy = "sequential"  // 顺序执行，上一步结果传给下一步
 */

import * as fs from "node:fs"
import * as path from "node:path"

// ==================== 类型定义 ====================

export interface Subtask {
  id: number
  description: string
  /** 建议使用的命令/工具名 */
  toolHint?: string
  /** 子任务参数 */
  args?: string[]
  /** 依赖的上游子任务 ID */
  dependsOn?: number[]
  /** 执行结果（执行后填充） */
  result?: SubTaskResult
}

export interface SubTaskResult {
  success: boolean
  output: string
  error?: string
  durationMs: number
  /** 传递给下游的数据 */
  artifact?: unknown
}

export interface DecompositionPlan {
  /** 原始请求 */
  originalRequest: string
  /** 子任务列表 */
  subtasks: Subtask[]
  /** 合并策略 */
  mergeStrategy: "sequential" | "parallel" | "merge"
  /** 创建时间 */
  createdAt: string
  /** 会话 ID（用于续跑） */
  sessionId: string
}

export interface DecomposerConfig {
  /** 拆解模式 */
  mode: "llm" | "static" | "single"
  /** 可用工具列表（用于 prompt） */
  availableTools?: Array<{ name: string; description: string }>
  /** 持久化目录（用于断点续跑） */
  stateDir?: string
  /** LLM 调用回调（llm 模式需要）。传入 systemPrompt + userPrompt，返回 LLM 文本输出 */
  llmCall?: (system: string, user: string) => Promise<string>
}

// ==================== 拆解器 ====================

export class TaskDecomposer {
  private config: DecomposerConfig
  private static counter = 0

  constructor(config: DecomposerConfig) {
    this.config = {
      availableTools: config.availableTools ?? [],
      stateDir: config.stateDir ?? "./.kx2code/tasks",
      ...config,
    }
  }

  /**
   * 将复杂请求拆解为子任务
   */
  async decompose(request: string): Promise<DecompositionPlan> {
    const sessionId = this.getOrCreateSessionId()
    const plan: DecompositionPlan = {
      originalRequest: request,
      subtasks: [],
      mergeStrategy: "sequential",
      createdAt: new Date().toISOString(),
      sessionId,
    }

    switch (this.config.mode) {
      case "llm":
        plan.subtasks = await this.decomposeWithLLM(request)
        break
      case "static":
      case "single":
      default:
        plan.subtasks = this.decomposeStatic(request)
        if (plan.subtasks.length === 1) plan.mergeStrategy = "merge"
        break
    }

    // 检查是否需要恢复已有计划
    const saved = this.tryResumePlan(sessionId)
    if (saved && saved.subtasks.length > 0) {
      // 恢复已有计划的执行结果
      const completedIds = new Set(
        saved.subtasks.filter((s) => s.result?.success).map((s) => s.id)
      )
      if (completedIds.size > 0 && completedIds.size < saved.subtasks.length) {
        // 部分完成：合并已完成的 + 未完成的
        plan.subtasks = saved.subtasks
        plan.mergeStrategy = saved.mergeStrategy
        plan.createdAt = saved.createdAt
      }
    } else {
      this.persistPlan(plan)
    }

    return plan
  }

  // ==================== LLM 拆解 ====================

  private async decomposeWithLLM(request: string): Promise<Subtask[]> {
    if (!this.config.llmCall) {
      console.log("[Decomposer] 无 llmCall 回调，降级为 static 模式")
      return this.decomposeStatic(request)
    }

    const toolsList = (this.config.availableTools ?? [])
      .map((t) => `  /${t.name} — ${t.description}`)
      .join("\n")

    const systemPrompt = `你是 KX2Code 的任务规划器。将用户的请求拆解为有序的子任务列表。

规则：
1. 每个子任务必须使用可用的工具完成
2. 子任务之间有序依赖关系（上游结果传给下游）
3. 每个子任务只做一件事，小而具体
4. 最多拆 6 个子任务
5. 输出纯 JSON 格式

可用工具:
${toolsList}

输出格式:
[
  {"id": 1, "description": "子任务描述", "tool": "工具名", "args": ["参数"], "dependsOn": []},
  {"id": 2, "description": "子任务描述", "tool": "工具名", "args": ["参数"], "dependsOn": [1]}
]`

    const userPrompt = `请拆解以下请求为子任务列表:\n${request}`

    const raw = await this.config.llmCall(systemPrompt, userPrompt)
    return this.parseLLMResult(raw, request)
  }

  private parseLLMResult(raw: string, fallbackRequest: string): Subtask[] {
    try {
      // 提取 JSON 数组
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error("no JSON found")
      const parsed = JSON.parse(match[0])
      if (!Array.isArray(parsed)) throw new Error("not an array")
      return parsed.map((item: Record<string, unknown>, i: number) => ({
        id: (item.id as number) ?? i + 1,
        description: (item.description as string) ?? fallbackRequest,
        toolHint: item.tool as string | undefined,
        args: (item.args as string[] | undefined) ?? [],
        dependsOn: (item.dependsOn as number[] | undefined) ?? [],
      }))
    } catch {
      // 降级：单任务
      return [{ id: 1, description: fallbackRequest }]
    }
  }

  // ==================== 静态拆解 ====================

  private decomposeStatic(request: string): Subtask[] {
    const lower = request.toLowerCase()
    const tasks: Subtask[] = []
    let id = 0

    // 重构类任务
    if (lower.includes("重构") || lower.includes("refactor")) {
      const target = this.extractTarget(lower)
      tasks.push({ id: ++id, description: `分析 ${target || "目标代码"} 的当前结构和依赖`, toolHint: "analyze" })
      tasks.push({ id: ++id, description: `重构 ${target || "代码"}`, toolHint: "refactor", dependsOn: [id - 1] })
      if (lower.includes("测试") || lower.includes("test")) {
        tasks.push({ id: ++id, description: "生成单元测试", toolHint: "generate-test", dependsOn: [id - 1] })
      }
      tasks.push({ id: ++id, description: "运行测试验证", toolHint: "test", dependsOn: [id - 1] })
      return tasks
    }

    // 修复 bug
    if (lower.includes("修复") || lower.includes("fix") || lower.includes("bug")) {
      tasks.push({ id: ++id, description: "检查 lint 错误", toolHint: "lint" })
      tasks.push({ id: ++id, description: "运行测试找出失败项", toolHint: "test" })
      tasks.push({ id: ++id, description: "分析并修复问题", toolHint: "fix", dependsOn: [id - 2, id - 1] })
      tasks.push({ id: ++id, description: "验证修复结果", toolHint: "test", dependsOn: [id - 1] })
      return tasks
    }

    // 代码审查
    if (lower.includes("审查") || lower.includes("review")) {
      tasks.push({ id: ++id, description: "获取最近代码变更", toolHint: "git-diff" })
      tasks.push({ id: ++id, description: "执行代码审查", toolHint: "review", dependsOn: [id - 1] })
      return tasks
    }

    // 生成文档
    if (lower.includes("文档") || lower.includes("docs") || lower.includes("document")) {
      tasks.push({ id: ++id, description: "分析项目结构", toolHint: "tree" })
      tasks.push({ id: ++id, description: "生成文档", toolHint: "generate-docs", dependsOn: [id - 1] })
      return tasks
    }

    // 默认：单任务
    return [{ id: 1, description: request }]
  }

  private extractTarget(text: string): string {
    const patterns = [
      /重构\s*(\S+?)(?:模块|文件|代码|的|并)/,
      /refactor\s+(\S+)/,
      /(\w+\.(ts|tsx|js|jsx|py|rs|go))/,
    ]
    for (const p of patterns) {
      const m = text.match(p)
      if (m) return m[1]
    }
    return ""
  }

  // ==================== 持久化（用于续跑） ====================

  private getOrCreateSessionId(): string {
    if (this.config.stateDir) {
      fs.mkdirSync(this.config.stateDir, { recursive: true })
      const idFile = path.join(this.config.stateDir, "current-session.id")
      if (fs.existsSync(idFile)) {
        return fs.readFileSync(idFile, "utf-8").trim()
      }
      const newId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      fs.writeFileSync(idFile, newId, "utf-8")
      return newId
    }
    return `task-${Date.now()}`
  }

  private persistPlan(plan: DecompositionPlan): void {
    if (!this.config.stateDir) return
    try {
      const file = path.join(this.config.stateDir, `${plan.sessionId}.plan.json`)
      const tmp = file + ".tmp"
      fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), "utf-8")
      fs.renameSync(tmp, file)
    } catch { /* ignore */ }
  }

  private tryResumePlan(sessionId: string): DecompositionPlan | null {
    if (!this.config.stateDir) return null
    try {
      const file = path.join(this.config.stateDir, `${sessionId}.plan.json`)
      if (!fs.existsSync(file)) return null
      const data = JSON.parse(fs.readFileSync(file, "utf-8"))
      if (data.subtasks?.some((s: Subtask) => s.result?.success)) {
        return data as DecompositionPlan
      }
    } catch { /* ignore */ }
    return null
  }

  /** 更新某个子任务的结果（供 executor 调用） */
  updateSubTaskResult(plan: DecompositionPlan, subtaskId: number, result: SubTaskResult): void {
    const task = plan.subtasks.find((s) => s.id === subtaskId)
    if (task) {
      task.result = result
      this.persistPlan(plan)
    }
  }

  /** 获取已完成的子任务数 */
  getCompletedCount(plan: DecompositionPlan): number {
    return plan.subtasks.filter((s) => s.result?.success).length
  }
}

export default TaskDecomposer
