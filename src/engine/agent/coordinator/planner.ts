/**
 * Planner — 多角色规划器
 *
 * 职责：组织多个角色（Planner、Discussant、Reviewer）进行讨论，
 * 最终生成一份可执行的 Plan JSON 文件。
 *
 * 讨论流程：
 *   1. brainstorm  — 每个角色提出自己的想法
 *   2. debate      — 角色之间质疑、补充、修正
 *   3. consensus   — 投票/协商达成共识
 *   4. finalize    — Planner 汇总为最终 Plan
 *
 * 输出：Plan 对象（包含 tasks、discussions），同时写入 .plan.json 文件
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { sendMessageStream, type ApiConfig } from "../../api/client.ts"
import type {
  AgentRole,
  CoordinatorConfig,
  CoordinatorCallbacks,
  DiscussionRound,
  DiscussionPhase,
  Plan,
  TaskNode,
} from "./types.ts"

// ==================== 内置角色 ====================

export const BUILTIN_ROLES: AgentRole[] = [
  {
    id: "planner",
    name: "规划师",
    systemPrompt: `你是 KX2Code 的规划师。你的职责是：
1. 分析用户需求，将其分解为可执行的任务
2. 定义每个任务的目标、输入、输出、验证条件
3. 确定任务之间的依赖关系和执行顺序
4. 最终汇总所有讨论结果，生成可执行的 Plan JSON

输出要求：
- 任务描述具体、可执行
- 依赖关系清晰
- 每个任务有明确的验证条件`,
  },
  {
    id: "discussant",
    name: "讨论者",
    systemPrompt: `你是 KX2Code 的讨论者。你的职责是：
1. 认真听取其他角色的意见
2. 提出建设性的补充、质疑或修正
3. 指出计划中的遗漏或潜在风险
4. 提出替代方案

讨论原则：
- 对事不对人
- 每个观点要有具体理由
- 如果同意前一个观点，简要说明同意理由`,
  },
  {
    id: "reviewer",
    name: "审查员",
    systemPrompt: `你是 KX2Code 的审查员。你的职责是：
1. 从执行可行性角度审查计划
2. 检查是否有遗漏的步骤
3. 检查依赖关系是否合理
4. 提出改进建议

审查重点：
- 计划是否可执行
- 是否有死锁或循环依赖
- 验证条件是否可判断
- 是否有过度复杂化的步骤`,
  },
  {
    id: "critic",
    name: "批评家",
    systemPrompt: `你是 KX2Code 的批评家。你的职责是：
1. 找出计划中最坏的情况
2. 指出可能的失败点
3. 提出风险缓解方案
4. 挑战不合理的假设

批评原则：
- 假设每一步都可能失败
- 关注边界条件和异常情况
- 提出具体的风险缓解措施`,
  },
]

// ==================== Planner ====================

export interface PlannerOptions {
  config: CoordinatorConfig
  roles?: AgentRole[]
  callbacks?: CoordinatorCallbacks
}

export class Planner {
  private config: CoordinatorConfig
  private roles: AgentRole[]
  private callbacks?: CoordinatorCallbacks

  constructor(opts: PlannerOptions) {
    this.config = opts.config
    this.roles = opts.roles ?? BUILTIN_ROLES
    this.callbacks = opts.callbacks
  }

  /**
   * 生成执行计划
   *
   * 流程：
   *   1. brainstorm — 每个角色提出想法
   *   2. debate     — 多轮讨论（最多 maxDiscussionRounds 轮）
   *   3. consensus  — Planner 汇总为 Plan JSON
   *   4. finalize   — 审查和修正
   */
  async generatePlan(objective: { id: string; description: string }): Promise<Plan> {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const discussions: DiscussionRound[] = []

    // 阶段 1： brainstorm
    this.callbacks?.onPhaseChange?.("brainstorm", "各角色提出初步想法")
    const brainstormResults = await this.brainstorm(objective.description)
    for (const r of brainstormResults) {
      discussions.push(r)
      this.callbacks?.onDiscussionRound?.(r)
    }

    // 阶段 2：debate（多轮）
    this.callbacks?.onPhaseChange?.("debate", "角色讨论和修正")
    const debateRounds = await this.debate(objective.description, discussions)
    discussions.push(...debateRounds)
    for (const r of debateRounds) {
      this.callbacks?.onDiscussionRound?.(r)
    }

    // 阶段 3：consensus — Planner 汇总
    this.callbacks?.onPhaseChange?.("consensus", "汇总为执行计划")
    const plan = await this.consolidate(objective, discussions)

    // 阶段 4：finalize — 审查
    this.callbacks?.onPhaseChange?.("finalize", "审查和修正计划")
    const finalized = await this.finalize(plan, discussions)

    this.callbacks?.onPlanGenerated?.(finalized)
    return finalized
  }

  // ==================== 讨论阶段 ====================

  private async brainstorm(objective: string): Promise<DiscussionRound[]> {
    const rounds: DiscussionRound[] = []
    // 只用 planner + discussant 做 brainstorm，避免太多角色导致 prompt 过长
    const activeRoles = this.roles.filter((r) => r.id === "planner" || r.id === "discussant")

    for (const role of activeRoles) {
      const content = await this.callLLM(role, `用户目标: ${objective}\n\n请提出你的初步想法和方案。`)
      rounds.push({
        id: `round-${rounds.length + 1}`,
        roleId: role.id,
        content,
        timestamp: new Date().toISOString(),
        phase: "brainstorm",
      })
    }

    return rounds
  }

  private async debate(objective: string, previousRounds: DiscussionRound[]): Promise<DiscussionRound[]> {
    const rounds: DiscussionRound[] = []
    const maxRounds = this.config.maxDiscussionRounds ?? 3

    // 构建上下文
    const context = previousRounds.map((r) => {
      const role = this.roles.find((rl) => rl.id === r.roleId)
      return `[${role?.name ?? r.roleId}]: ${r.content.slice(0, 500)}`
    }).join("\n\n")

    for (let i = 0; i < maxRounds; i++) {
      // 每轮选 2 个角色发言（交替）
      const rolesThisRound = i % 2 === 0
        ? this.roles.filter((r) => r.id === "discussant" || r.id === "critic")
        : this.roles.filter((r) => r.id === "reviewer" || r.id === "planner")

      for (const role of rolesThisRound) {
        const prompt = `目标: ${objective}\n\n之前的讨论:\n${context}\n\n${rounds.length > 0 ? "本轮讨论:\n" + rounds.map(r => `[${this.roles.find(rl => rl.id === r.roleId)?.name ?? r.roleId}]: ${r.content.slice(0, 300)}`).join("\n\n") : ""}\n\n请针对上述讨论发表你的看法：可以补充、质疑、修正或提出新的方案。`
        const content = await this.callLLM(role, prompt)
        rounds.push({
          id: `round-${previousRounds.length + rounds.length + 1}`,
          roleId: role.id,
          content,
          timestamp: new Date().toISOString(),
          phase: "debate",
        })
      }
    }

    return rounds
  }

  private async consolidate(objective: { id: string; description: string }, discussions: DiscussionRound[]): Promise<Plan> {
    const plannerRole = this.roles.find((r) => r.id === "planner") ?? this.roles[0]

    const context = discussions.map((r) => {
      const role = this.roles.find((rl) => rl.id === r.roleId)
      return `[${role?.name ?? r.roleId}]: ${r.content.slice(0, 500)}`
    }).join("\n\n")

    const prompt = `目标: ${objective.description}\n\n讨论记录:\n${context}\n\n请将以上讨论汇总为一份可执行的 Plan。输出纯 JSON 格式：

{
  "title": "计划标题",
  "description": "计划描述",
  "tasks": [
    {
      "id": "task-1",
      "description": "具体可执行的步骤",
      "command": "建议使用的命令名（如 analyze、refactor、test）",
      "args": ["命令参数"],
      "dependsOn": ["依赖的任务ID"],
      "strategy": "sequential",
      "priority": 1,
      "validate": "如何验证该步骤完成"
    }
  ]
}

规则：
1. tasks 数组最多 6 个任务
2. dependsOn 必须引用同数组中其他任务的 id
3. strategy: sequential（顺序）、parallel（并行）、standalone（独立）
4. priority: 数字越小越优先
5. validate: 简短描述如何验证该步骤成功完成`

    const content = await this.callLLM(plannerRole, prompt)

    // 解析 Plan JSON
    const tasks = this.parseTasks(content) ?? this.fallbackTasks(objective.description)

    return {
      id: `plan-${Date.now()}`,
      objectiveId: objective.id,
      title: objective.description.slice(0, 50),
      description: objective.description,
      tasks,
      discussions,
      createdAt: new Date().toISOString(),
      status: "draft",
      version: 1,
    }
  }

  private async finalize(plan: Plan, discussions: DiscussionRound[]): Promise<Plan> {
    const reviewerRole = this.roles.find((r) => r.id === "reviewer") ?? this.roles[0]

    const prompt = `请审查以下计划，检查是否有问题：

标题: ${plan.title}
描述: ${plan.description}

任务列表:
${plan.tasks.map((t) => `  [${t.id}] ${t.description} (${t.strategy}, dependsOn: [${t.dependsOn.join(",")}])`).join("\n")}

如果有问题，输出修正后的 Plan JSON。如果没有问题，输出 APPROVED。`

    const content = await this.callLLM(reviewerRole, prompt)

    if (content.includes("APPROVED")) {
      plan.status = "approved"
      return plan
    }

    // 尝试解析修正后的 Plan
    const correctedTasks = this.parseTasks(content)
    if (correctedTasks && correctedTasks.length > 0) {
      plan.tasks = correctedTasks
      plan.version++
    }
    plan.status = "approved"
    return plan
  }

  // ==================== LLM 调用 ====================

  /** 可被测试 override 的 LLM 调用方法 */
  protected async callLLM(role: AgentRole, userPrompt: string): Promise<string> {
    const { execSync } = await import("node:child_process")

    const body = JSON.stringify({
      model: this.config.llm.model,
      messages: [
        { role: "system", content: role.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: this.config.llm.maxTokens ?? 2048,
      temperature: 0.4,
    })

    const baseUrl = this.config.llm.baseUrl || "https://api.openai.com"
    const hasEndpoint = baseUrl.includes('/chat/completions')
    const url = hasEndpoint ? baseUrl : `${baseUrl}/v1/chat/completions`

    try {
      const result = execSync(
        `curl -s -X POST "${url}" -H "Content-Type: application/json" -H "Authorization: Bearer ${this.config.llm.apiKey}" -d ${JSON.stringify(body)}`,
        { encoding: "utf-8", timeout: 60_000 }
      )
      const parsed = JSON.parse(result)
      const msg = parsed.choices?.[0]?.message ?? {}
      return msg.content || msg.reasoning || ``
    } catch {
      return `[${role.name}] 无法调用 LLM`
    }
  }

  // ==================== JSON 解析 ====================

  private parseTasks(raw: string): TaskNode[] | null {
    try {
      const match = raw.match(/\{[\s\S]*"tasks"[\s\S]*\}/)
      if (!match) return null
      const parsed = JSON.parse(match[0])
      if (!Array.isArray(parsed.tasks)) return null

      return parsed.tasks.map((t: Record<string, unknown>) => ({
        id: (t.id as string) ?? `task-${Math.random().toString(36).slice(2, 6)}`,
        description: (t.description as string) ?? "",
        command: t.command as string | undefined,
        args: (t.args as string[] | undefined) ?? [],
        dependsOn: (t.dependsOn as string[] | undefined) ?? [],
        strategy: (t.strategy as TaskNode["strategy"]) ?? "sequential",
        priority: (t.priority as number) ?? 1,
        validate: t.validate as string | undefined,
      }))
    } catch {
      return null
    }
  }

  private fallbackTasks(objective: string): TaskNode[] {
    return [
      {
        id: "task-1",
        description: `分析: ${objective}`,
        strategy: "sequential",
        priority: 1,
        dependsOn: [],
        validate: "输出分析结果",
      },
      {
        id: "task-2",
        description: `执行: ${objective}`,
        strategy: "sequential",
        priority: 2,
        dependsOn: ["task-1"],
        validate: "输出执行结果",
      },
    ]
  }
}

export default Planner
