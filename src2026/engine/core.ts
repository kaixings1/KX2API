/**
 * engine/core.ts — 兼容层（向后兼容，委托给完整 QueryEngine）
 *
 * 职责：
 * - 保留旧版 createEngine/getEngine API
 * - 委托给 src2026/engine/index.ts 中的完整 QueryEngine
 * - 保留 Team 模式、命令执行等快捷功能
 */

import { QueryEngine, type EngineOptions } from './index.ts'
import { commandRegistry, type CommandResult } from './commands/registry.ts'
import { toolCollection } from '../main/proxy/tools/toolCollection.ts'
import { Team } from '../main/agent/team/team.ts'

export interface EngineConfig {
  apiKey: string
  provider: 'anthropic' | 'openai' | 'custom'
  model: string
  baseUrl?: string
  maxTokens?: number
  workingDir?: string
  maxToolRounds?: number
  maxRepeat?: number
}

export interface QueryResult {
  content: string
  toolCalls: unknown[]
  toolOutput?: string
  error?: string
}

export interface ConversationHistory {
  messages: Array<{ role: string; content: string }>
}

// 单例
let engine: QueryEngine | null = null

export function createEngine(config?: Partial<EngineConfig>): QueryEngine {
  const engineConfig = config || {}
  const opts: EngineOptions = {
    model: engineConfig.model || 'gpt-4o',
    provider: (engineConfig.provider as 'anthropic' | 'openai') || 'openai',
    maxOutputTokens: engineConfig.maxTokens || 4096,
    systemPrompt: '你是 KX2Code，一个智能编程助手。你可以使用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。',
  }
  engine = new QueryEngine(opts)
  return engine
}

export function getEngine(): QueryEngine {
  if (!engine) throw new Error('Engine not initialized')
  return engine
}

// 为兼容旧版 core.ts 的 QueryEngine 类接口，提供薄封装
export class LegacyQueryEngine {
  private config: EngineConfig
  private history: unknown[] = []
  private systemPrompt = '你是 KX2Code，一个智能编程助手。你可以使�用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。'
  private engine: QueryEngine

  constructor(config: EngineConfig) {
    this.config = config
    const opts: EngineOptions = {
      model: config.model,
      provider: (config.provider as 'anthropic' | 'openai') || 'openai',
      maxOutputTokens: config.maxTokens || 4096,
      systemPrompt: this.systemPrompt,
    }
    this.engine = new QueryEngine(opts)
  }

  getConfig() {
    return { ...this.config }
  }

  getMaxToolRounds(): number {
    return this.config.maxToolRounds || 5
  }

  getHistory(): ConversationHistory {
    return {
      messages: this.history.map(m => ({
        role: (m as { role: string }).role,
        content: typeof (m as { content: unknown }).content === 'string'
          ? (m as { content: string }).content
          : JSON.stringify((m as { content: unknown }).content)
      }))
    }
  }

  clearHistory() {
    this.history = []
  }

  addMessage(msg: unknown) {
    this.history.push(msg)
  }

  async query(text: string): Promise<QueryResult> {
    const result = await this.engine.query(text)
    return {
      content: (result.messages[result.messages.length - 1]?.content as string) || '',
      toolCalls: [],
    }
  }

  async executeCommand(name: string, args: string[]): Promise<{ success: boolean; output: string; error?: string; needsAgent?: boolean; plan?: unknown }> {
    const trimmed = name.startsWith('/') ? name.slice(1) : name

    if (trimmed === 'team') {
      const result = await this.runTeamMode(args.join(' ') || '未指定任务')
      return { success: true, output: result }
    }

    const cmd = toolCollection.getTool(trimmed) || commandRegistry.get(trimmed)

    if (cmd) {
      try {
        const result = await cmd.execute(args)
        return {
          success: result.success,
          output: result.error || result.output || '命令执行完成',
          error: result.error,
          needsAgent: result.needsAgent,
        }
      } catch (e) {
        return { success: false, output: '', error: (e as Error).message }
      }
    }

    return { success: false, output: '', error: `未知命令: /${trimmed}` }
  }

  private async runTeamMode(task: string): Promise<string> {
    const team = new Team({
      mode: 'team',
      roles: [
        {
          id: 'lead',
          name: '组长',
          profile: '团队领导',
          goal: '协调团队成员并有效分配任务',
          constraints: ['始终将任务分配��合适的团队成员', '确保任务完成'],
        },
        {
          id: 'engineer',
          name: '工程师',
          profile: '软件工程师',
          goal: '基于需求实现解决方案',
          constraints: ['编写整洁、可维护的代码', '遵循最佳实践'],
        },
      ],
      leadRole: 'lead',
      maxRounds: 3,
    })
    return await team.process(task)
  }
}
