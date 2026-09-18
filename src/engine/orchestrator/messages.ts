/**
 * engine/orchestrator/messages.ts — 编排器内部消息协议
 *
 * 吸收自 MetaGPT Message + CrewAI Task context
 */

// ---------------------------------------------------------------------------
// Agent 角色标识
// ---------------------------------------------------------------------------

export type AgentRole =
  | 'team_leader'
  | 'pm'
  | 'architect'
  | 'engineer'
  | 'qa'
  | 'researcher'
  | 'supervisor'

// ---------------------------------------------------------------------------
// AgentMessage — 角色间通信的消息格式
// ---------------------------------------------------------------------------

export interface AgentMessage {
  /** 消息唯一 ID */
  id: string
  /** 发送者角色 */
  from: AgentRole
  /** 接收者角色（undefined = 广播） */
  to?: AgentRole
  /** 消息内容 */
  content: string
  /** 触发此消息的阶段/动作类型 */
  causeBy: WorkflowStage
  /** 关联的任务 ID */
  taskId?: string
  /** 时间戳 */
  timestamp: string
  /** 元数据（附件、引用等） */
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// 工作流阶段
// ---------------------------------------------------------------------------

export type WorkflowStage =
  | 'research'
  | 'analyze'
  | 'design'
  | 'plan'
  | 'implement'
  | 'verify'
  | 'review'
  /** 多角色讨论（对应 OrchestratorConfig.mode === 'discuss'） */
  | 'discuss'
  | 'done'
  | 'failed'

// ---------------------------------------------------------------------------
// StepResult — 编排器每步执行结果
// ---------------------------------------------------------------------------

export interface StepResult {
  signal: 'continue' | 'complete' | 'failed' | 'paused'
  action: string
  result: string
  filesModified?: string[]
}

// ---------------------------------------------------------------------------
// RoleExecutionResult — 单角色执行结果
// ---------------------------------------------------------------------------

export interface RoleExecutionResult {
  role: AgentRole
  stage: WorkflowStage
  success: boolean
  output: string
  iterations: number
  duration: number
  error?: string
  artifacts?: string[]
}

// ---------------------------------------------------------------------------
// OrchestrationResult — 完整编排结果
// ---------------------------------------------------------------------------

export interface OrchestrationResult {
  success: boolean
  finalStage: WorkflowStage
  roleResults: RoleExecutionResult[]
  mergedOutput: string
  qualityScore: number
  totalDuration: number
  totalIterations: number
  summary: string
  artifacts: string[]
  taskId?: string
}

// ---------------------------------------------------------------------------
// OrchestratorConfig — 编排器配置
// ---------------------------------------------------------------------------

export interface OrchestratorConfig {
  mode: 'pipeline' | 'parallel' | 'discuss'
  maxIterations: number
  parallelResearch: boolean
  mergeStrategy: 'consensus' | 'merge' | 'best'
  roles: AgentRole[]
  autoFix: boolean
  qualityGate: boolean
  verbose: boolean
  maxDiscussionRounds: number   // discuss 模式最大讨论轮数
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  mode: 'pipeline',
  maxIterations: 10,
  parallelResearch: true,
  mergeStrategy: 'merge',
  roles: ['team_leader', 'pm', 'architect', 'engineer', 'qa', 'researcher'],
  autoFix: true,
  qualityGate: true,
  verbose: false,
  maxDiscussionRounds: 5,
}

// ---------------------------------------------------------------------------
// AgentDefinition — 角色定义
// ---------------------------------------------------------------------------

export interface AgentDefinition {
  role: AgentRole
  name: string
  goal: string
  backstory: string
  systemPrompt: string
  allowedTools: string[]
  maxTurns: number
  retryPolicy: 'none' | 'once' | 'twice'
  outputFormat: 'text' | 'structured' | 'json'
}

// ---------------------------------------------------------------------------
// StageContext — 阶段执行上下文
// ---------------------------------------------------------------------------

export interface StageContext {
  stage: WorkflowStage
  task: string
  previousOutput?: string
  roleOutputs: Map<WorkflowStage, string>
  config: OrchestratorConfig
  messages: AgentMessage[]
}
