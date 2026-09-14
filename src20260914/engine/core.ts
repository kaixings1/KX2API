/**
 * engine/core.ts — 简化版 QueryEngine 核心
 *
 * 职责：
 * - 管理对话历史
 * - 调用 API 客户端
 * - 处理流式响应
 * - 执行命令
 *
 * 设计目标：轻量、无死循环、可扩展
 */

import { sendMessageStream, sendOpenAIStreamWithTools, type Message, type ApiConfig, type ContentBlock, type ToolDefinition } from './api/client.ts'
import { commandRegistry, type CommandResult } from './commands/registry.ts'
import { toolCollection } from '../main/proxy/tools/toolCollection.ts'
import { Team } from '../main/agent/team/team.ts'
import { runTools, type ToolExecuteContext } from '../main/proxy/tools/toolOrchestrator.ts'
import { executeLocalTool } from '../main/proxy/tools/streamingToolExecutor.ts'

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
  toolCalls: ContentBlock[]
  toolOutput?: string
  error?: string
}

export interface ConversationHistory {
  messages: Array<{ role: string; content: string }>
}

class QueryEngine {
  private config: EngineConfig
  private history: Message[] = []
  private systemPrompt = '你是 KX2Code，一个智能编程助手。你可以使用工具帮助用户。当用户用中文提问时，请用中文回答。当用户询问文件、代码或项目结构时，请提供有用的分析和建议。'

  constructor(config: EngineConfig) {
    this.config = config
  }

  updateConfig(config: Partial<EngineConfig>) {
    this.config = { ...this.config, ...config }
  }

  getMaxToolRounds(): number {
    return this.config.maxToolRounds || 5
  }

  getHistory(): ConversationHistory {
    return { messages: this.history.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })) }
  }

  clearHistory() {
    this.history = []
  }

  addMessage(msg: Message) {
    this.history.push(msg)
  }

  async query(text: string, _signal?: AbortSignal, onStream?: (chunk: string) => void): Promise<QueryResult> {
    const trimmed = text.trim()

    // Team 模式: /team <task>
    if (trimmed.startsWith('/team ')) {
      const result = await this.runTeamMode(trimmed.slice(6).trim())
      return { content: result, toolCalls: [] }
    }

    // 检查是否为普通命令
    if (trimmed.startsWith('/')) {
      const cmdName = trimmed.split(' ')[0].slice(1)
      const cmdArgs = trimmed.slice(cmdName.length + 1).trim().split(' ').filter(Boolean)
      const cmd = commandRegistry.get(cmdName)

      if (cmd) {
        const result: CommandResult = await cmd.execute(cmdArgs)
        const output = result.error || result.output || '命令执行完成'
        return { content: output, toolCalls: [] }
      }
    }

    const userMsg: Message = { role: 'user', content: text }
    this.addMessage(userMsg)

    const apiMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.history.slice(-50), // 最多保留最近 50 条
    ]

    let fullContent = ''
    const toolCalls: ContentBlock[] = []

    const engineStart = Date.now()
    console.log('[Engine][query] ENTRY text=', JSON.stringify(text).slice(0, 100), 'provider=', this.config.provider, 'model=', this.config.model, 'baseUrl=', this.config.baseUrl, 'historyLen=', this.history.length)

    await new Promise<void>((resolve, reject) => {
      sendMessageStream(
        {
          provider: this.config.provider,
          apiKey: this.config.apiKey,
          model: this.config.model,
          baseUrl: this.config.baseUrl,
          maxTokens: this.config.maxTokens,
          maxRepeat: this.config.maxRepeat,
        },
        apiMessages,
        {
          onText: (chunk) => {
            fullContent += chunk
            if (onStream) onStream(chunk)
          },
          onToolUse: (block) => { toolCalls.push(block) },
          onDone: () => {
            console.log('[Engine][query] onDone after', Date.now() - engineStart, 'ms, contentLen=', fullContent.length, 'toolCalls=', toolCalls.length)
            resolve()
          },
          onError: (err) => {
            console.error('[Engine][query] onError after', Date.now() - engineStart, 'ms:', err)
            reject(new Error(err))
          },
        },
        _signal,
      )
    })

    // 使用 ToolOrchestrator + StreamingToolExecutor 执行工具调用
    if (toolCalls.length > 0) {
      const toolResults = await this.executeToolCalls(toolCalls)
      // 将工具结果加入历史，触发第二轮 LLM 调用生成最终回复
      const followUp = await this.followUpWithToolResults(fullContent, toolCalls, toolResults)
      return { content: followUp, toolCalls }
    }

    const assistantMsg: Message = { role: 'assistant', content: fullContent }
    this.addMessage(assistantMsg)

    return { content: fullContent, toolCalls }
  }

  /**
   * 使用 ToolOrchestrator 编排执行工具调用
   */
  private async executeToolCalls(toolCalls: ContentBlock[]): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    const context: ToolExecuteContext = {
      toolDefinitions: [] as ToolDefinition[],
      onToolResult: (id, output, error) => {
        const result = error || output || '(无输出)'
        results.set(id, result)
      },
    }

    const executeTool = async (block: ContentBlock): Promise<{ output: string; error?: string }> => {
      const result = await executeLocalTool(block.name || '', (block.input as Record<string, unknown>)?.args as string[] || [])
      return { output: result.output, error: result.error }
    }

    for await (const update of runTools(toolCalls, context, executeTool)) {
      if (update.toolCallId && update.content) {
        results.set(update.toolCallId, update.content)
      }
    }

    return results
  }

  /**
   * 将工具结果喂回 LLM，获取最终回复
   */
  private async followUpWithToolResults(
    originalContent: string,
    toolCalls: ContentBlock[],
    toolResults: Map<string, string>,
  ): Promise<string> {
    const toolResultMessages: Message[] = []
    for (const block of toolCalls) {
      const output = toolResults.get(block.id || '') || '(无输出)'
      toolResultMessages.push({
        role: 'user',
        content: JSON.stringify({
          type: 'tool_result',
          tool_use_id: block.id,
          content: output,
        }),
      })
    }

    const followUpMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.history.slice(-50),
      { role: 'assistant', content: originalContent },
      ...toolResultMessages,
    ]

    let finalContent = ''
    await new Promise<void>((resolve, reject) => {
      sendMessageStream(
        {
          provider: this.config.provider,
          apiKey: this.config.apiKey,
          model: this.config.model,
          baseUrl: this.config.baseUrl,
          maxTokens: this.config.maxTokens,
          maxRepeat: this.config.maxRepeat,
        },
        followUpMessages,
        {
          onText: (chunk) => { finalContent += chunk },
          onToolUse: () => {},
          onDone: () => { resolve() },
          onError: (err) => { reject(new Error(err)) },
        },
      )
    })

    this.addMessage({ role: 'assistant', content: finalContent })
    return finalContent
  }

  /**
   * 执行命令（/xxx 格式）
   */
  async executeCommand(name: string, args: string[]): Promise<{ success: boolean; output: string; error?: string; needsAgent?: boolean; plan?: unknown }> {
    const trimmed = name.startsWith('/') ? name.slice(1) : name

    // Team 命令
    if (trimmed === 'team') {
      const result = await this.runTeamMode(args.join(' ') || '未指定任务')
      return { success: true, output: result }
    }

    // 普通命令：优先从 ToolCollection 查找
    const cmd = toolCollection.getTool(trimmed) || commandRegistry.get(trimmed)

    if (cmd) {
      try {
        const result = await cmd.execute(args)

        // needsAgent 命令：通过 AgentDispatcher 实际执行
        if (result.needsAgent) {
          const agentResult = await this.runAgentCommand(trimmed, args)
          return {
            success: agentResult.success,
            output: agentResult.output,
            error: agentResult.error,
            needsAgent: true,
          }
        }

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

  getConfig() {
    return { ...this.config }
  }

  /**
   * Team 多角色协作模式
   * 统一管理 Lead + Engineer 角色配置，避免重复代码
   */
  private async runTeamMode(task: string): Promise<string> {
    const team = new Team({
      mode: 'team',
      roles: [
        {
          id: 'lead',
          name: '组长',
          profile: '团队领导',
          goal: '协调团队成员并有效分配任务',
          constraints: ['始终将任务分配给合适的团队成员', '确保任务完成'],
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

  /**
   * Agent 命令执行（v2 — 任务拆解 + 结果校验 + 自动续跑）
   *
   * 执行链路：
   *   team/llm 类型 → TaskDecomposer 拆解 → TaskExecutor 执行(含校验/重试/续跑) → 合并结果
   *   local 类型     → 直接执行
   */
  private async runAgentCommand(commandName: string, args: string[]): Promise<{ success: boolean; output: string; error?: string; needsAgent?: boolean; plan?: unknown }> {
    const { AgentDispatcher } = await import('./agent/dispatcher.ts')
    const dispatcher = new AgentDispatcher({
      provider: this.config.provider,
      apiKey: this.config.apiKey,
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      maxTokens: this.config.maxTokens,
    })
    let result = await dispatcher.dispatch(commandName, args)

    // 如果 dispatcher 不认识该命令，回退到 commandRegistry 直接执行
    if (!result.success && result.error?.includes('未知命令')) {
      const cmd = commandRegistry.get(commandName)
      if (cmd) {
        try {
          const cmdResult = await cmd.execute(args)
          return {
            success: cmdResult.success,
            output: cmdResult.output || cmdResult.error || '命令执行完成',
            error: cmdResult.error,
            needsAgent: cmdResult.needsAgent,
          }
        } catch (e) {
          return { success: false, output: '', error: (e as Error).message }
        }
      }
    }

    const response: Record<string, unknown> = {
      success: result.success,
      output: result.output,
      error: result.error,
      needsAgent: true,
    }

    // 如果有拆解计划，附带计划摘要（方便前端展示进度）
    if (result.plan) {
      const plan = result.plan as { subtasks?: Array<{ description: string }>; originalRequest: string }
      response.plan = {
        originalRequest: plan.originalRequest,
        subtaskCount: plan.subtasks?.length ?? 0,
        subtasks: plan.subtasks?.map((s) => ({
          description: s.description,
          result: s.result ? { success: s.result.success, durationMs: s.result.durationMs } : null,
        })),
      }
    }

    return response
  }
}

// 单例
let engine: QueryEngine | null = null

export function createEngine(config?: Partial<EngineConfig>): QueryEngine {
  const defaultConfig: EngineConfig = {
    apiKey: '',
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4096,
  }
  engine = new QueryEngine({ ...defaultConfig, ...config })
  return engine
}

export function getEngine(): QueryEngine {
  if (!engine) throw new Error('Engine not initialized')
  return engine
}
