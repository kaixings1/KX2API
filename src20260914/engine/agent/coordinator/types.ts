/**
 * Coordinator 模块 — 多目标、多子代理协同的类型定义
 *
 * 核心概念：
 *   Objective  — 一个高层目标（如"重构登录模块"），可包含多个并行/串行任务
 *   Plan       — 由多角色讨论生成的执行规划文件（JSON）
 *   AgentRole  — 角色定义（Planner / Discussant / Executor / Reviewer）
 *   Discussion — 多角色之间的讨论回合
 *   TaskNode   — 规划中的任务节点（可依赖其他节点）
 */

// ==================== 角色系统 ====================

export type RoleId = string

export interface AgentRole {
  id: RoleId
  name: string
  systemPrompt: string
  /** 该角色的输出格式约束 */
  outputFormat?: string
}

// ==================== 目标 ====================

export interface Objective {
  id: string
  description: string
  priority: number          // 1=最高, 数字越大越优先（或反过来，看设计）
  /** 子目标（并行执行） */
  subObjectives?: Objective[]
  /** 约束条件 */
  constraints?: string[]
  /** 成功判据 */
  successCriteria?: string[]
  /** 元数据 */
  metadata?: Record<string, unknown>
}

// ==================== 规划 ====================

export interface Plan {
  /** 规划 ID */
  id: string
  /** 来源目标 */
  objectiveId: string
  /** 规划标题 */
  title: string
  /** 详细描述 */
  description: string
  /** 任务节点 */
  tasks: TaskNode[]
  /** 讨论记录 */
  discussions: DiscussionRound[]
  /** 创建时间 */
  createdAt: string
  /** 状态 */
  status: "draft" | "approved" | "executing" | "completed" | "failed"
  /** 版本 */
  version: number
}

export interface TaskNode {
  id: string
  description: string
  /** 对应命令 */
  command?: string
  /** 参数 */
  args?: string[]
  /** 依赖的节点 ID */
  dependsOn: string[]
  /** 执行策略: sequential | parallel | standalone */
  strategy: "sequential" | "parallel" | "standalone"
  /** 优先级 */
  priority: number
  /** 验证条件 */
  validate?: string
  /** 执行结果（执行后填充） */
  result?: TaskNodeResult
}

export interface TaskNodeResult {
  success: boolean
  output: string
  error?: string
  durationMs: number
  executedAt: string
}

// ==================== 讨论 ====================

export interface DiscussionRound {
  id: string
  /** 发言角色 */
  roleId: RoleId
  /** 发言内容 */
  content: string
  /** 发言时间 */
  timestamp: string
  /** 讨论阶段: brainstorm | debate | consensus | finalize */
  phase: DiscussionPhase
}

export type DiscussionPhase = "brainstorm" | "debate" | "consensus" | "finalize"

// ==================== 执行结果 ====================

export interface ExecutionReport {
  planId: string
  success: boolean
  /** 每个任务的执行摘要 */
  taskResults: Array<{
    taskId: string
    description: string
    success: boolean
    output: string
    error?: string
    durationMs: number
  }>
  /** 总耗时 */
  totalDurationMs: number
  /** 讨论记录 */
  discussions: DiscussionRound[]
  /** 最终结论 */
  conclusion: string
  finishedAt: string
}

// ==================== 协调器配置 ====================

export interface CoordinatorConfig {
  /** LLM 配置 */
  llm: {
    provider: string
    apiKey: string
    model: string
    baseUrl?: string
    maxTokens?: number
  }
  /** 工作目录 */
  cwd?: string
  /** 最大讨论轮数 */
  maxDiscussionRounds?: number
  /** 最大并行任务数 */
  maxParallelTasks?: number
  /** 每个子任务的最大重试次数 */
  maxRetries?: number
  /** 规划文件输出目录 */
  plansDir?: string
}

// ==================== 回调 ====================

export interface CoordinatorCallbacks {
  onPhaseChange?: (phase: string, detail: string) => void
  onDiscussionRound?: (round: DiscussionRound) => void
  onTaskStart?: (task: TaskNode) => void
  onTaskComplete?: (task: TaskNode, result: TaskNodeResult) => void
  onPlanGenerated?: (plan: Plan) => void
  onComplete?: (report: ExecutionReport) => void
}
