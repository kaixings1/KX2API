/**
 * Agent Action Types
 * Agent 动作空间与轨迹记录
 * 参考 SWE-agent 的 StepOutput / TrajectoryStep 设计
 */

export interface StepOutput {
  thought: string
  action: string
  output: string
  observation: string
  done: boolean
  executionTime: number
  toolCalls?: ToolCallRecord[]
}

export interface ToolCallRecord {
  id: string
  name: string
  arguments: Record<string, unknown>
  output: string
}

export type HistoryItemType = 'thought' | 'action' | 'observation'

export interface HistoryItem {
  type: HistoryItemType
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export type Trajectory = HistoryItem[]
