/**
 * Agent Dispatcher - 统一处理所有 needsAgent 命令
 *
 * 执行链路升级（v2 — 任务拆解 + 结果校验）：
 *   team / llm 类型 → TaskDecomposer 拆解为子任务 → TaskExecutor 顺序执行 + 校验 → 合并结果
 *   local 类型       → 直接执行（不变）
 *
 * 新增能力：
 *   1. 复杂任务自动拆解（静态规则 + LLM 动态拆解）
 *   2. 子任务依赖管理（上一步结果传给下一步）
 *   3. 自动重试（失败 N 次自动重跑）
 *   4. 结果校验（每个子任务完成后验证输出）
 *   5. 结果合并（所有子任务输出合并为最终报告）
 *   6. 断点续跑（崩溃后从上次完成处继续）
 */

import { sendMessageStream, type ApiConfig } from '../api/client.ts'
import { commandRunners, type CommandRunner, type RunnerType } from './command-runners.ts'
import { TaskDecomposer } from './task-decomposer.ts'
import { TaskExecutor, type ExecuteResult, type ExecutorOptions } from './task-executor.ts'
import { type DecompositionPlan } from './task-decomposer.ts'
import * as path from "node:path"
import { type AgentDefinition, type SubagentContext } from './subagent/types.ts'
import { DEFAULT_BUILT_IN_AGENTS, findAgentByType } from './subagent/definitions.ts'
import { executeSubagent } from './subagent/executor.ts'
import { filterToolsForAgent } from './subagent/toolFilter.ts'

export interface AgentDispatchResult {
  success: boolean
  output: string
  error?: string
  agentUsed: string
  /** 任务拆解计划（team/llm 类型有） */
  plan?: DecompositionPlan
  /** 子任务执行结果（team/llm 类型有） */
  executeResult?: ExecuteResult
}

export class AgentDispatcher {
  private config: ApiConfig

  constructor(config: ApiConfig) {
    this.config = config
  }

  /**
   * 分发命令到对应的实现
   */
  async dispatch(commandName: string, args: string[], context?: Record<string, unknown>): Promise<AgentDispatchResult> {
    const runner = commandRunners.get(commandName)

    if (!runner) {
      return {
        success: false,
        output: '',
        error: `未知命令: /${commandName}`,
        agentUsed: 'unknown',
      }
    }

    try {
      switch (runner.type) {
        case 'team':
          return await this.dispatchWithDecomposition(runner, commandName, args, context)
        case 'llm':
          return await this.dispatchWithDecomposition(runner, commandName, args, context)
        case 'subagent':
          return await this.dispatchSubagent(runner, commandName, args, context)
        case 'local':
          return await this.dispatchLocal(runner, commandName, args, context)
        default:
          return await this.dispatchLocal(runner, commandName, args, context)
      }
    } catch (e) {
      return {
        success: false,
        output: '',
        error: `${runner.description}执行失败: ${(e as Error).message}`,
        agentUsed: runner.type,
      }
    }
  }

  // ==================== 任务拆解 + 执行链路 ====================

  /**
   * 对 team/llm 类型命令启用任务拆解：
   * 1. TaskDecomposer 拆解为子任务
   * 2. TaskExecutor 顺序执行 + 校验 + 重试
   * 3. 合并结果为最终输出
   */
  private async dispatchWithDecomposition(
    runner: CommandRunner,
    commandName: string,
    args: string[],
    context?: Record<string, unknown>
  ): Promise<AgentDispatchResult> {
    const cwd = this.getCwd(context)
    const fullRequest = args.join(' ') || runner.description

    // llm 类型无 API key 时返回待执行状态
    if (runner.type === 'llm' && !this.config.apiKey) {
      const contextOutput = await runner.execute(args, cwd, this.config)
      return {
        success: true,
        output: `[AI 待执行] 命令: /${commandName}\n参数: ${args.join(' ') || '(无)'}\n\n上下文信息:\n${contextOutput.slice(0, 2000)}\n\n提示: 配置 API key 后将自动调用 LLM 执行。`,
        agentUsed: `llm(pending)`,
      }
    }

    // 构建可用工具列表
    const availableTools = Array.from(commandRunners.entries()).map(([name, r]) => ({
      name,
      description: r.description,
    }))

    // 拆解任务
    const decomposer = new TaskDecomposer({
      mode: 'static',
      availableTools,
      stateDir: path.join(cwd, '.kx2code', 'tasks'),
      llmCall: this.config.apiKey
        ? async (systemPrompt: string, userPrompt: string): Promise<string> => {
            let output = ''
            await new Promise<void>((resolve, reject) => {
              sendMessageStream(
                {
                  provider: this.config.provider,
                  apiKey: this.config.apiKey,
                  model: this.config.model,
                  baseUrl: this.config.baseUrl,
                  maxTokens: 1024,
                },
                [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                {
                  onText: (chunk) => { output += chunk },
                  onToolUse: () => {},
                  onDone: () => { resolve() },
                  onError: (err) => { reject(new Error(err)) },
                },
              )
            })
            return output
          }
        : undefined,
    })

    const plan = await decomposer.decompose(fullRequest)

    // 单任务：直接执行 runner
    if (plan.subtasks.length === 1 && !plan.subtasks[0].toolHint) {
      const output = await runner.execute(args, cwd, this.config)
      return {
        success: true,
        output,
        agentUsed: `${runner.type === 'team' ? 'Team' : runner.type}(${commandName})`,
        plan,
      }
    }

    // 多子任务：用 TaskExecutor 执行
    const executorOpts: ExecutorOptions = {
      cwd,
      maxRetries: 2,
      stateDir: path.join(cwd, '.kx2code', 'tasks'),
      llmConfig: this.config.apiKey
        ? {
            provider: this.config.provider,
            apiKey: this.config.apiKey,
            model: this.config.model,
            baseUrl: this.config.baseUrl,
            maxTokens: 4096,
          }
        : undefined,
    }

    const executor = new TaskExecutor(executorOpts)

    const executeResult = await executor.execute(plan, {
      onProgress: (current, total, subtask) => {
        console.log(`[Dispatcher] 进度: ${current}/${total} — ${subtask.description}`)
      },
      onComplete: (result) => {
        console.log(`[Dispatcher] 执行完毕: 成功 ${result.subtaskResults.filter(r => r.success).length}/${result.subtaskResults.length}`)
      },
    })

    return {
      success: executeResult.success,
      output: executeResult.output,
      error: executeResult.failedSubtasks.length > 0 ? `${executeResult.failedSubtasks.length} 个子任务失败` : '',
      agentUsed: `${runner.type === 'team' ? 'Team' : runner.type}(${commandName})`,
      plan,
      executeResult,
    }
  }

  // ==================== 原有的执行策略 ====================

  /**
   * Team 策略：使用多角色协作处理复杂任务
   */
  private async dispatchTeam(runner: CommandRunner, commandName: string, args: string[], context?: Record<string, unknown>): Promise<AgentDispatchResult> {
    const cwd = this.getCwd(context)
    const output = await runner.execute(args, cwd, this.config)
    return {
      success: true,
      output,
      agentUsed: `Team(${commandName})`,
    }
  }

  /**
   * LLM 策略：构建专用 prompt 交给 LLM 执行
   */
  private async dispatchLLM(runner: CommandRunner, commandName: string, args: string[], context?: Record<string, unknown>): Promise<AgentDispatchResult> {
    const cwd = this.getCwd(context)

    // 先执行 runner 获取上下文
    const contextOutput = await runner.execute(args, cwd, this.config)

    if (!this.config.apiKey) {
      return {
        success: true,
        output: `[AI 待执行] 命令: /${commandName}\n参数: ${args.join(' ') || '(无)'}\n\n上下文信息:\n${contextOutput.slice(0, 2000)}\n\n提示: 配置 API key 后将自动调用 LLM 执行。`,
        agentUsed: 'llm(pending)',
      }
    }

    const systemPrompt = this.buildSystemPrompt(runner.description)
    const userPrompt = this.buildUserPrompt(commandName, args, contextOutput)

    let output = ''
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          sendMessageStream(
            { ...this.config, maxTokens: 4096 },
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            {
              onText: (chunk) => { output += chunk },
              onToolUse: () => {},
              onDone: () => { resolve() },
              onError: (err) => { reject(new Error(err)) },
            },
          )
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`${runner.description}执行超时（30s）`)), 30000)
        ),
      ])

      return {
        success: true,
        output: output || `${runner.description}完成，无输出`,
        agentUsed: `llm(${commandName})`,
      }
    } catch (e) {
      return {
        success: false,
        output: contextOutput,
        error: `${runner.description}执行失败: ${(e as Error).message}`,
        agentUsed: `llm(${commandName})`,
      }
    }
  }

  /**
   * 本地策略：直接执行本地命令
   */
  private async dispatchLocal(runner: CommandRunner, commandName: string, args: string[], context?: Record<string, unknown>): Promise<AgentDispatchResult> {
    const cwd = this.getCwd(context)
    const output = await runner.execute(args, cwd, this.config)

    return {
      success: true,
      output,
      agentUsed: `local(${commandName})`,
    }
  }

  // ==================== Prompt 构建 ====================

  private buildSystemPrompt(commandDesc: string): string {
    return `你是 KX2Code 的 AI 代理执行器。你正在执行"${commandDesc}"任务。

请遵循以下原则：
1. 分析提供的上下文信息（代码、diff、错误信息等）
2. 提供具体的、可执行的建议或代码
3. 如果发现问题，给出详细的修复方案
4. 使用中文回答，除非用户明确要求英文
5. 代码示例使用 Markdown 代码块格式`
  }

  private buildUserPrompt(commandName: string, args: string[], contextOutput: string): string {
    const lines: string[] = []
    lines.push(`执行命令: /${commandName}`)
    if (args.length > 0) {
      lines.push(`参数: ${args.join(' ')}`)
    }
    lines.push('')
    lines.push('上下文信息:')
    lines.push('```')
    lines.push(contextOutput.slice(0, 10000))
    lines.push('```')
    lines.push('')
    lines.push('请分析以上信息并提供详细结果。')
    return lines.join('\n')
  }

  // ==================== 子代理执行链路 ====================

  /**
   * 子代理策略：根据 agentType 选择代理定义，用子上下文执行
   *
   * 用法: /agent <代理类型> <任务描述>
   *        /agent general-purpose 分析登录模块的安全问题
   */
  private async dispatchSubagent(
    _runner: CommandRunner,
    _commandName: string,
    args: string[],
    context?: Record<string, unknown>,
  ): Promise<AgentDispatchResult> {
    const cwd = this.getCwd(context)

    // 解析参数：第一个参数是代理类型，其余是任务描述
    const agentType = args[0] || 'general-purpose'
    const prompt = args.slice(1).join(' ') || '请执行通用任务'

    // 查找代理定义
    const agent = findAgentByType(DEFAULT_BUILT_IN_AGENTS, agentType)
    if (!agent) {
      const available = DEFAULT_BUILT_IN_AGENTS.map((a) => a.agentType).join(', ')
      return {
        success: false,
        output: '',
        error: `未知代理类型: "${agentType}"。可用类型: ${available}`,
        agentUsed: `subagent(${agentType})`,
      }
    }

    // 构建工具列表（简化版：从 K 的 registry 获取所有命令名作为工具）
    const availableTools: { name: string; description: string }[] = []
    for (const [name, r] of commandRunners.entries()) {
      availableTools.push({ name, description: r.description })
    }

    // 过滤工具（应用代理的 disallowedTools）
    const resolved = filterToolsForAgent({
      tools: availableTools,
      isBuiltIn: agent.source === 'built-in',
      isAsync: false,
      permissionMode: agent.permissionMode,
    })

    // 构建子代理上下文
    const subagentCtx: SubagentContext = {
      config: this.config,
      cwd,
      availableTools: resolved,
      prompt,
      agentType: agent.agentType,
      isAsync: false,
    }

    // 执行子代理
    try {
      const result = await executeSubagent(agent, subagentCtx)
      return {
        success: result.success,
        output: result.output || '(子代理完成，无输出)',
        error: result.error,
        agentUsed: `subagent(${agent.agentType})`,
      }
    } catch (e) {
      return {
        success: false,
        output: '',
        error: `子代理执行失败: ${(e as Error).message}`,
        agentUsed: `subagent(${agent.agentType})`,
      }
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 获取命令的执行类型
   */
  getRunnerType(commandName: string): RunnerType | undefined {
    const runner = commandRunners.get(commandName)
    return runner?.type
  }

  /**
   * 获取所有已注册的命令名
   */
  getRegisteredCommands(): string[] {
    return Array.from(commandRunners.keys())
  }

  private getCwd(context?: Record<string, unknown>): string {
    if (context?.cwd && typeof context.cwd === 'string') {
      return context.cwd
    }
    return process.cwd()
  }
}
