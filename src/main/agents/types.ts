/**
 * Agent 领域类型定义 — 单一真源
 */

export interface AgentRecord {
  id: string
  name: string
  role: string
  systemPrompt: string
  model: string | null
  status: AgentStatus
  createdAt: number
  updatedAt: number
  lastActiveAt?: number
}

export type AgentStatus = 'idle' | 'running' | 'error'

export interface AgentExecutionEvent {
  type: 'start' | 'chunk' | 'done' | 'error'
  /** 事件所属 agent；AgentExecutor 产出时会带上，ExecutorRunner 据此路由到对应窗口 */
  agentId?: string
  /** 事件产生的时间戳（ms） */
  timestamp?: number
  content?: string
  output?: string
  error?: string
}

export interface AgentExecuteResult {
  success: boolean
  output?: string
  error?: string
  /** 本次执行耗时（ms），由调用方统计 */
  durationMs?: number
}
