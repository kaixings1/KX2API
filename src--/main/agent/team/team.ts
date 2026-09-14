/**
 * Team Coordinator
 * 多角色协作编排器
 * 参考 MetaGPT 的 Team/Role/Message 设计模式
 */

import type { AgentRole, TeamMessage, TeamConfig } from './types.ts'
import { ActionSampler } from '../action/sampler.ts'

export class Team {
  private readonly roles: Map<string, AgentRole> = new Map()
  private readonly inbox: TeamMessage[] = []
  private leadRoleId?: string
  private maxRounds: number
  private roundCount = 0
  private readonly sampler: ActionSampler

  constructor(config: TeamConfig) {
    for (const role of config.roles) {
      this.roles.set(role.id, role)
    }
    this.leadRoleId = config.leadRole
    this.maxRounds = config.maxRounds || 5
    this.sampler = new ActionSampler({ maxSteps: this.maxRounds, maxExecutionTime: 30000 })
  }

  getRole(id: string): AgentRole | undefined {
    return this.roles.get(id)
  }

  getAllRoles(): AgentRole[] {
    return Array.from(this.roles.values())
  }

  getLeadRole(): AgentRole | undefined {
    if (!this.leadRoleId) return undefined
    return this.roles.get(this.leadRoleId)
  }

  publishMessage(msg: Omit<TeamMessage, 'id' | 'timestamp'>): TeamMessage {
    const message: TeamMessage = {
      id: 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      ...msg,
    }
    this.inbox.push(message)
    return message
  }

  getInbox(recipient: string): TeamMessage[] {
    return this.inbox.filter(m => m.recipient === recipient || m.recipient === 'all')
  }

  canContinue(): boolean {
    return this.roundCount < this.maxRounds
  }

  nextRound(): void {
    this.roundCount++
  }

  getRoundCount(): number {
    return this.roundCount
  }

  /**
   * 生成角色系统 prompt
   * 格式参考 MetaGPT 的 PREFIX_TEMPLATE / CONSTRAINT_TEMPLATE
   * 全部使用中文，确保角色理解和输出一致
   */
  static buildRolePrompt(role: AgentRole, history: string[]): string {
    const lines: string[] = []
    lines.push(`你是${role.profile}，名为${role.name}。`)
    lines.push(`你的目标是：${role.goal}。`)
    if (role.constraints && role.constraints.length > 0) {
      lines.push(`约束条件：${role.constraints.join('；')}。`)
    }
    if (history.length > 0) {
      lines.push('')
      lines.push('对话历史：')
      for (const h of history) {
        lines.push(h)
      }
    }
    return lines.join('\n')
  }

  /**
   * 处理任务：Lead 角色分发子任务给各角色执行
   * 返回所有角色的执行结果汇总
   */
  async process(task: string, executeLocalTool?: (name: string, args: string[]) => Promise<{ output: string }>): Promise<string> {
    const lead = this.getLeadRole()
    if (!lead) {
      return '[团队] 错误：未配置组长角色'
    }

    const results: string[] = []
    const history: string[] = []

    for (let i = 0; i < this.maxRounds; i++) {
      if (!this.canContinue()) break

      // Lead 分配任务
      const leadPrompt = Team.buildRolePrompt(lead, history)
      const assignResult = await this.delegateTask(lead, task, leadPrompt, executeLocalTool)

      results.push(`[${lead.name}] ${assignResult}`)
      history.push(`[${lead.name}] ${assignResult}`)

      // 如果有工程师角色，执行技术任务
      // 兼容中英文关键词：实现/code、编码/implement
      const engineer = this.roles.get('engineer')
      const hasTechKeyword = /实现|编码|implement|code|开发|build/i.test(assignResult)
      if (engineer && hasTechKeyword) {
        const engineerPrompt = Team.buildRolePrompt(engineer, history)
        const engResult = await this.delegateTask(engineer, assignResult, engineerPrompt, executeLocalTool)
        results.push(`[${engineer.name}] ${engResult}`)
        history.push(`[${engineer.name}] ${engResult}`)
      }

      this.nextRound()
    }

    return results.join('\n\n')
  }

  private async delegateTask(role: AgentRole, task: string, prompt: string, executeLocalTool?: (name: string, args: string[]) => Promise<{ output: string }>): Promise<string> {
    const step = await this.sampler.executeStep({
      thought: `作为${role.name}（${role.profile}），分析任务：${task.slice(0, 200)}`,
      action: `调查:${task.slice(0, 100)}`,
      executeAction: async (_action: string) => {
        if (!executeLocalTool) {
          return `${role.name}：收到任务但无可用工具。`
        }
        try {
          const result = await executeLocalTool('pwd', [])
          return result.output
        } catch {
          return `${role.name}：收到任务但工具执行失败。`
        }
      },
    })

    const parts: string[] = [
      `[${role.name}] 思考：${step.thought}`,
      `[${role.name}] 行动：${step.action}`,
      `[${role.name}] 观察：${step.observation}`,
    ]
    return parts.join('\n')
  }
}
