/**
 * Agent Team Types
 * 多角色协作系统接口定义
 * 设计模式参考 MetaGPT，提取核心概念：
 * - Role: 角色定义（profile, name, goal, constraints）
 * - Team: 团队编排器（路由消息到不同 Role）
 * - Message: 消息传递（publish_message / put_message）
 */

export interface AgentRole {
  id: string
  name: string
  profile: string
  goal: string
  constraints?: string[]
  model?: string
  systemPrompt?: string
}

export interface TeamMessage {
  id: string
  sender: string
  recipient: string
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export type TeamMode = 'single' | 'team'

export interface TeamConfig {
  mode: TeamMode
  roles: AgentRole[]
  leadRole?: string
  maxRounds?: number
}
