/**
 * StreamingToolExecutor — KX2API 适配版
 *
 * 核心能力（从 doge-desktop 移植）：
 * - 带并发控制的流式工具执行（concurrency-safe 可并行，互斥工具串行）
 * - 状态流转：queued → executing → completed → yielded
 * - 错误级联取消（sibling error abort）
 * - 用户中断 / streaming fallback 取消
 * - 进度消息即时产出
 * - Promise.race 防挂起（30s timeout）
 */

export interface ToolExecuteContext {
  name: string
  args: string[]
  onProgress?: (progress: string) => void
}

export interface ToolExecuteResult {
  tool_use_id: string
  output: string
  error?: string
}

export interface ToolExecuteFn {
  (ctx: ToolExecuteContext): Promise<ToolExecuteResult>
}

export type ToolStatus = 'queued' | 'executing' | 'completed' | 'yielded'

export interface TrackedTool {
  id: string
  name: string
  args: string[]
  status: ToolStatus
  isConcurrencySafe: boolean
  promise?: Promise<void>
  results?: ToolExecuteResult[]
  pendingProgress: string[]
  contextModifiers?: Array<(ctx: ToolExecuteContext) => ToolExecuteContext>
}

export interface MessageUpdate {
  result?: ToolExecuteResult
  progress?: string
  newContext?: ToolExecuteContext
}

/**
 * 执行单个本地工具命令（通过 commandRegistry + AgentDispatcher）
 */
export async function executeLocalTool(name: string, args: string[]): Promise<ToolExecuteResult> {
  const { commandRegistry } = await import('../../engine/commands/registry.ts')
  const cmd = commandRegistry.get(name)
  if (!cmd) {
    return { tool_use_id: '', output: `错误: 未知命令 /${name}` }
  }

  const result = await cmd.execute(args)

  if (result.needsAgent && !result.error) {
    try {
      const { AgentDispatcher } = await import('../../engine/agent/dispatcher.ts')
      const dispatcher = new AgentDispatcher({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        baseUrl: 'http://127.0.0.1:8080',
        maxTokens: 4096,
      })
      const agentResult = await dispatcher.dispatch(name, args)
      return {
        tool_use_id: '',
        output: agentResult.error || agentResult.output || '(Agent 执行完成)',
      }
    } catch (e) {
      return { tool_use_id: '', output: `Agent 执行失败: ${(e as Error).message}` }
    }
  }

  return { tool_use_id: '', output: result.error || result.output || '(无输出)' }
}

export class StreamingToolExecutor {
  private tools: TrackedTool[] = []
  private toolExecuteContext: ToolExecuteContext
  private hasErrored = false
  private erroredToolName = ''
  private siblingAbortController: AbortController
  private discarded = false
  private progressAvailableResolve?: () => void

  constructor(
    private readonly executeToolFn: ToolExecuteFn,
    toolExecuteContext: ToolExecuteContext,
  ) {
    this.toolExecuteContext = toolExecuteContext
    this.siblingAbortController = new AbortController()
  }

  /**
   * 丢弃所有待执行和正在执行的工具
   */
  discard(): void {
    this.discarded = true
  }

  /**
   * 添加工具到执行队列，条件允许时立即开始执行
   */
  addTool(id: string, name: string, args: string[], isConcurrencySafe = false): void {
    this.tools.push({
      id,
      name,
      args,
      status: 'queued',
      isConcurrencySafe,
      pendingProgress: [],
    })

    void this.processQueue()
  }

  /**
   * 检查工具是否可以执行（基��并发状态）
   */
  private canExecuteTool(isConcurrencySafe: boolean): boolean {
    const executingTools = this.tools.filter(t => t.status === 'executing')
    return (
      executingTools.length === 0 ||
      (isConcurrencySafe && executingTools.every(t => t.isConcurrencySafe))
    )
  }

  /**
   * 处理队列，在并发条件允许时启动工具
   */
  private async processQueue(): Promise<void> {
    for (const tool of this.tools) {
      if (tool.status !== 'queued') continue

      if (this.canExecuteTool(tool.isConcurrencySafe)) {
        await this.executeTool(tool)
      } else {
        // 不可执行，且为保证顺序，停止处理
        if (!tool.isConcurrencySafe) break
      }
    }
  }

  private createSyntheticErrorMessage(
    toolId: string,
    reason: 'sibling_error' | 'user_interrupted' | 'streaming_fallback',
  ): ToolExecuteResult {
    if (reason === 'user_interrupted') {
      return { tool_use_id: toolId, output: '用户取消了工具调用', error: 'user_interrupted' }
    }
    if (reason === 'streaming_fallback') {
      return { tool_use_id: toolId, output: '', error: 'streaming_fallback - 工具执行被丢弃' }
    }
    const desc = this.erroredToolName
    const msg = desc ? `Cancelled: parallel tool call ${desc} errored` : 'Cancelled: parallel tool call errored'
    return { tool_use_id: toolId, output: '', error: msg }
  }

  /**
   * 确定工具是否应该被取消
   */
  private getAbortReason(tool: TrackedTool): 'sibling_error' | 'user_interrupted' | 'streaming_fallback' | null {
    if (this.discarded) {
      return 'streaming_fallback'
    }
    if (this.hasErrored) {
      return 'sibling_error'
    }
    return null
  }

  private getToolDescription(tool: TrackedTool): string {
    const summary = tool.args.join(' ').slice(0, 40)
    return `${tool.name}(${summary})`
  }

  /**
   * 执行工具并收集结果
   */
  private async executeTool(tool: TrackedTool): Promise<void> {
    tool.status = 'executing'

    const messages: ToolExecuteResult[] = []

    const collectResults = async () => {
      const initialAbortReason = this.getAbortReason(tool)
      if (initialAbortReason) {
        messages.push(this.createSyntheticErrorMessage(tool.id, initialAbortReason))
        tool.results = messages
        tool.status = 'completed'
        return
      }

      let thisToolErrored = false

      try {
        const result = await this.executeToolFn({
          name: tool.name,
          args: tool.args,
          onProgress: (progress: string) => {
            tool.pendingProgress.push(progress)
            if (this.progressAvailableResolve) {
              this.progressAvailableResolve()
              this.progressAvailableResolve = undefined
            }
          },
        })

        if (result.error) {
          thisToolErrored = true
          // 只有 Bash 类命令的失败才取消兄弟工具
          if (tool.name === 'bash' || tool.name === 'Bash') {
            this.hasErrored = true
            this.erroredToolName = this.getToolDescription(tool)
            this.siblingAbortController.abort('sibling_error')
          }
        }

        messages.push(result)
      } catch (e) {
        thisToolErrored = true
        const errorMsg = (e as Error).message
        if (tool.name === 'bash' || tool.name === 'Bash') {
          this.hasErrored = true
          this.erroredToolName = this.getToolDescription(tool)
          this.siblingAbortController.abort('sibling_error')
        }
        messages.push({ tool_use_id: tool.id, output: '', error: errorMsg })
      }

      tool.results = messages
      tool.status = 'completed'
    }

    const promise = collectResults()
    tool.promise = promise

    void promise.finally(() => {
      void this.processQueue()
    })
  }

  /**
   * 获取已完成的未产出结果（非阻塞）
   * 同时产出所有待处理的进度消息
   */
  *getCompletedResults(): Generator<MessageUpdate, void> {
    if (this.discarded) {
      return
    }

    for (const tool of this.tools) {
      while (tool.pendingProgress.length > 0) {
        const progressMessage = tool.pendingProgress.shift()!
        yield { progress: progressMessage }
      }

      if (tool.status === 'yielded') {
        continue
      }

      if (tool.status === 'completed' && tool.results) {
        tool.status = 'yielded'
        for (const message of tool.results) {
          yield { result: message }
        }
      } else if (tool.status === 'executing' && !tool.isConcurrencySafe) {
        break
      }
    }
  }

  /**
   * 检查是否有待处理的进度消息
   */
  private hasPendingProgress(): boolean {
    return this.tools.some(t => t.pendingProgress.length > 0)
  }

  /**
   * 等待剩余工具并产出结果
   * 同时产出进度消息
   */
  async *getRemainingResults(): AsyncGenerator<MessageUpdate, void> {
    if (this.discarded) {
      return
    }

    while (this.hasUnfinishedTools()) {
      await this.processQueue()

      for (const result of this.getCompletedResults()) {
        yield result
      }

      if (
        this.hasExecutingTools() &&
        !this.hasCompletedResults() &&
        !this.hasPendingProgress()
      ) {
        const executingPromises = this.tools
          .filter(t => t.status === 'executing' && t.promise)
          .map(t => t.promise!)

        const progressPromise = new Promise<void>(resolve => {
          this.progressAvailableResolve = resolve
        })

        if (executingPromises.length > 0) {
          const raceTimeout = new Promise<void>((resolve) => {
            setTimeout(() => {
              this.progressAvailableResolve = undefined
              resolve()
            }, 30000)
          })
          await Promise.race([
            ...executingPromises,
            progressPromise,
            raceTimeout,
          ])
        }
      }
    }

    for (const result of this.getCompletedResults()) {
      yield result
    }
  }

  private hasCompletedResults(): boolean {
    return this.tools.some(t => t.status === 'completed')
  }

  private hasExecutingTools(): boolean {
    return this.tools.some(t => t.status === 'executing')
  }

  private hasUnfinishedTools(): boolean {
    return this.tools.some(t => t.status !== 'yielded')
  }

  getUpdatedContext(): ToolExecuteContext {
    return this.toolExecuteContext
  }
}
