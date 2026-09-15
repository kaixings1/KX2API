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
  type: 'chunk' | 'done' | 'error'
  content?: string
  output?: string
  error?: string
}

export interface AgentExecuteResult {
  success: boolean
  output?: string
  error?: string
}
