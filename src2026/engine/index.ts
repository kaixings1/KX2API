/**
 * engine/index.ts — 核心引擎装配入口（Web 版，吸收 CLI 版增强特性）
 *
 * 聚合：状态机 + 消息循环 + 消息规范化 + 请求构建 + 响应处理 +
 * 工具调度 + Token 预算 + 自动压缩 + 错误处理/恢复 + 流式 + 子代理。
 */
import { QueryStateMachine } from "./stateMachine.ts";
import { MessageLoop, type MessageLoopDeps, type QueryResult, type AutoContinueConfig } from "./messageLoop.ts";
import { MessageNormalizer, type InternalMessage } from "./messageNormalizer.ts";
import { RequestBuilder, type ToolDefinition } from "./requestBuilder.ts";
import { ResponseHandler } from "./responseHandler.ts";
import { ToolScheduler, type PermissionManager, type ToolExecutor, type Tool } from "./toolScheduler.ts";
import { TokenBudgetManager } from "./tokenBudgetManager.ts";
import { AutoCompactor } from "./autoCompactor.ts";
import { ErrorClassifier } from "./errors/classifier.ts";
import { RetryHandler } from "./errors/retryHandler.ts";
import { ErrorRecovery } from "./errors/recovery.ts";
import { SubAgentManager } from "./subagent/subAgentManager.ts";
import { AutoFixLoop } from "./autoFixLoop.ts";
import { GitContextInjector, type GitContextConfig } from "./gitContext.ts";
import { HarnessRouter, type HarnessConfig, type HarnessAdapter } from "./harnessAdapter.ts";
import { createSandboxedExecutor, type SandboxConfig, type SandboxPolicy, getDefaultSandboxPolicy, createDefaultSandboxConfig } from "./sandbox/index.ts";
import {
  buildSystemPrompt as buildEnhancedSystemPrompt,
  normalizeMessagesForAPI,
  mergeUserMessagesAndToolResults,
  mergeAssistantMessages,
  countToolCalls,
  hasSuccessfulToolCall,
  isToolUseRequestMessage,
  isToolUseResultMessage,
  isEmptyMessageText,
  extractTextContent,
  ensureToolResultPairing,
  buildMessageLookups,
  filterOrphanedThinkingOnlyMessages,
  filterWhitespaceOnlyAssistantMessages,
  ensureNonEmptyAssistantContent,
  stripSignatureBlocks,
  hasUnresolvedHooks,
  isHookAttachmentMessage,
  handleMessageFromStream,
  createUserInterruptionMessage,
  createToolResultStopMessage,
} from "./messages.ts";

export interface Conversation {
  messages: InternalMessage[];
  addToolResults: (results: unknown[]) => void;
}

export interface EngineOptions {
  model: string;
  maxOutputTokens?: number;
  systemPrompt?: string;
  tools?: Map<string, Tool>;
  provider?: "anthropic" | "openai";
  /** Agent 事件回调，用于 UI 层订阅循环状态变化 */
  onEvent?: (event: import("./messageLoop.ts").AgentEvent) => void;
  /** 预测性 AI 助手：当前文件的静态分析建议 */
  preAnalysis?: Array<{ type: string; message: string; line?: number }>;
  /** 自动修复循环配置（吸收自 Aider）：编辑工具后自动 lint→test→fix */
  autoFixLoop?: {
    enabled?: boolean
    maxIterations?: number
  };
  /** Git 上下文感知配置（吸收自 Aider）：编辑文件时自动获取 git blame + log */
  gitContext?: GitContextConfig;
  /** Harness 模型适配配置（吸收自 open-interpreter harness）：多 provider 格式转换 */
  harness?: HarnessConfig;
  /** 沙箱执行配置（吸收自 open-interpreter sandboxing）：工具执行安全策略 */
  sandbox?: Partial<SandboxConfig>;
  /** 验收标准门控（吸收自 intent-driven-development）：进入 done 前检查 */
  acceptanceCriteria?: import("./stateMachine.ts").AcceptanceCriterion[];
  /** Hook 管理器（吸收自 ECC hooks）：注册 PreToolUse/PostToolUse 拦截器 */
  hookManager?: import("./hooks/hookManager.js").HookManager;
  /** 自动继续配置：由配置决定是否在特定场景自动注入「继续」。默认关闭 */
  autoContinue?: AutoContinueConfig;
  /** 技能分��配置（吸收自 CLI 版）：工具分类和技能列表 */
  skills?: Array<{ name: string; description: string; category?: string }>;
  /** 智能体配置（吸收自 CLI 版）：主智能体列表 */
  agents?: Array<{ name: string; description: string; model?: string }>;
  /** 子代理配置（吸收自 CLI 版）：子代理列表 */
  subagents?: Array<{ name: string; description: string }>;
}

/**
 * 引擎级权限请求信息，对齐 OpenCode (Go) 的 PermissionRequest。
 * UI 层通过 grantPermission/denyPermission 响应。
 */
export interface AgentPermissionRequest {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  description?: string;
}

export class QueryEngine {
  readonly stateMachine = new QueryStateMachine();
  readonly tokenBudget = new TokenBudgetManager();
  readonly autoCompactor = new AutoCompactor();
  readonly normalizer = new MessageNormalizer();
  readonly requestBuilder = new RequestBuilder();
  readonly responseHandler = new ResponseHandler();
  readonly retryHandler = new RetryHandler();
  readonly subAgentManager = new SubAgentManager();
  readonly recovery: ErrorRecovery;
  private _preAnalysis: Array<{ type: string; message: string; line?: number }>;
  readonly conversation: Conversation;
  private abortController: AbortController = new AbortController();

  private messageLoop: MessageLoop;
  private _toolDefinitions: ToolDefinition[] = [];
  private pendingRequests = new Map<string, { resolve: (v: boolean) => void }>();
  private _conversation: Conversation = {
    messages: [],
    addToolResults: (results) => {
      for (const r of results) {
        const resultRecord = r as Record<string, unknown>;
        const toolUseId = typeof resultRecord.toolUseId === 'string' ? resultRecord.toolUseId : null;
        const contentVal = typeof resultRecord.output === 'string' ? resultRecord.output : JSON.stringify(resultRecord.output ?? resultRecord.error ?? '');
        this._conversation.messages.push({
          role: "tool" as const,
          ...(toolUseId ? { toolUseId } : {}),
          content: contentVal,
        });
      }
    },
  };

  constructor(private opts: EngineOptions) {
    const permissionManager: PermissionManager = {
      async check() {
        return true;
      },
      async requestAuthorization() {
        return true;
      },
      async requestPermission(tool, input) {
        if (opts.onEvent) {
          const requestId = `${tool.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const request: AgentPermissionRequest = {
            id: requestId,
            toolName: tool.name,
            input,
            description: tool.description,
          };
          opts.onEvent!({
            type: 'permission_request',
            id: requestId,
            toolName: tool.name,
            input,
            description: tool.description,
          });
          return new Promise<boolean>((resolve) => {
            this.pendingRequests.set(requestId, { resolve });
          });
        }
        return false;
      },
    };

    const rawExecutor: ToolExecutor = {
      async execute(tool, input, _o) {
        const r = await tool.execute(input);
        if (typeof r.content === "string") return r.content;
        if (Array.isArray(r.content)) {
          return r.content
            .filter((p: { type: string; text?: string }) => p.type === "text" && p.text)
            .map((p: { type: string; text?: string }) => p.text!)
            .join("\n") || "";
        }
        return String(r.content ?? "");
      },
    };

    // Self-healing 执行器包装链（吸收自 Browser-Use self-healing harness）
    const selfHealingExecutor: ToolExecutor = {
      async execute(tool, input, _o) {
        const MAX_RETRIES = 2
        const RETRYABLE = /stale|concurrent|modified|changed|race|enoent/i
        let lastError = ''

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await rawExecutor.execute(tool, input, _o)
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            lastError = msg
            if (attempt < MAX_RETRIES && RETRYABLE.test(msg)) {
              const fp = (input as any)?.file_path as string
              if (fp) {
                const os = (input as any)?.old_string as string
                if (os && !verifyEditAnchor(fp, os)) {
                  throw new Error(`编辑锚点失效（文件已被外部修改）：${fp}`)
                }
              }
              continue
            }
            throw e
          }
        }
        throw new Error(`Self-healing 重试耗尽（${MAX_RETRIES} 次）：${lastError}`)
      },
    }

    // 沙箱执行器包装链
    const sandboxConfig: SandboxConfig = opts.sandbox
      ? {
          enabled: opts.sandbox.enabled ?? true,
          policy: opts.sandbox.policy ?? getDefaultSandboxPolicy(),
          onDeny: opts.sandbox.onDeny ?? 'warn',
        }
      : createDefaultSandboxConfig(false)
    const sandboxExecutor = createSandboxedExecutor(selfHealingExecutor, sandboxConfig)
    const executor: ToolExecutor = sandboxExecutor
    const registry = opts.tools ?? this.buildRegistry();

    // 创建 ErrorRecovery
    this.recovery = new ErrorRecovery(this.stateMachine, this.retryHandler, this.autoCompactor);
    const toolScheduler = new ToolScheduler(registry, permissionManager, executor, this.recovery);

    this.conversation = this._conversation;
    this._preAnalysis = opts.preAnalysis;
    const autoFixLoopConfig = opts.autoFixLoop;

    // 初始化功能管理器
    const endConvManager = getEndConversationManager();
    const subAgentMgr = getSubAgentManager();
    const autoModeMgr = getAutoModeManager();

    // 将内部工具注册表转换为请求构建器所需的 ToolDefinition 格式
    this._toolDefinitions = Array.from(registry.values()).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const acceptanceGate = opts.acceptanceCriteria
      ? new (await import("./stateMachine.ts")).AcceptanceGate()
      : null
    if (acceptanceGate && opts.acceptanceCriteria) {
      acceptanceGate.addMany(opts.acceptanceCriteria)
    }

    const deps: MessageLoopDeps = {
      stateMachine: this.stateMachine,
      tokenBudget: this.tokenBudget,
      requestBuilder: this.requestBuilder,
      responseHandler: this.responseHandler,
      toolScheduler,
      apiClient: {
        async sendMessage() {
          return [Promise.resolve({ type: "message_stop" })] as unknown as AsyncIterable<unknown>;
        },
      },
      conversation: this._conversation,
      systemPrompt: opts.systemPrompt ?? this.buildSystemPrompt(),
      model: opts.model,
      maxOutputTokens: opts.maxOutputTokens ?? 40000,
      toolDefinitions: this._toolDefinitions,
      provider: opts.provider ?? "openai",
      onEvent: opts.onEvent,
      autoCompactor: this.autoCompactor,
      preAnalysis: this._preAnalysis,
      autoFixLoop: {
        enabled: autoFixLoopConfig?.enabled ?? true,
        maxIterations: autoFixLoopConfig?.maxIterations ?? 3,
        onEvent: (event) => {
          engineLog('AUTOFIX', event.type)
        },
      },
      gitContext: opts.gitContext,
      harness: opts.harness,
      acceptanceGate,
      hookManager: opts.hookManager,
      autoContinue: opts.autoContinue,
    };
    this.messageLoop = new MessageLoop(deps);

    // 注入 API client 到 AutoCompactor
    this.autoCompactor.setApiClient({
      sendMessage: deps.apiClient.sendMessage.bind(deps.apiClient),
    });
  }

  /**
   * 构建最小化的 ToolUseContext，用于工具内部的 validateInput/call 调用。
   */
  private static buildMinimalContext() {
    const abortController = new AbortController();
    return {
      options: {
        commands: [],
        debug: false,
        mainLoopModel: '',
        tools: [] as Tools,
        verbose: false,
        thinkingConfig: { type: 'none' as const },
        mcpClients: [],
        mcpResources: {},
        isNonInteractiveSession: true,
        agentDefinitions: [],
      },
      abortController,
      getAppState: () => ({ toolPermissionContext: {} as Record<string, unknown> }),
      setAppState: () => {},
      setInProgressToolUseIDs: () => {},
      setResponseLength: () => 0,
      updateFileHistoryState: (f: any) => f,
      updateAttributionState: (f: any) => f,
      readFileState: { get: () => null, set: () => {}, has: () => false },
    };
  }

  private buildRegistry(): Map<string, Tool> {
    const map = new Map<string, Tool>();
    const baseTools = getAllBaseTools();
    const ctx = QueryEngine.buildMinimalContext();
    const canUseTool = (async (_tool: unknown, _input: unknown, _ctx: unknown, _msg: unknown, _id: unknown) => ({ behavior: 'allow', updatedInput: {} as Record<string, unknown> })) as (tool: unknown, input: unknown, ctx: unknown, msg: unknown, id: unknown) => Promise<{ behavior: string; updatedInput: Record<string, unknown> }>;
    const parentMessage = { role: 'user', content: '' } as Record<string, unknown>;

    for (const tool of baseTools) {
      if (!tool || !tool.name) continue;
      const info = tool.info();
      map.set(tool.name, {
        name: info.name,
        description: info.description,
        parameters: info.parameters,
        validate() {
          return { valid: true };
        },
        async execute(params) {
          try {
            const result = await tool.call(
              params as Record<string, unknown>,
              ctx as Record<string, unknown>,
              canUseTool,
              parentMessage,
            );
            const raw = (result as { data?: unknown } | null)?.data ?? result;
            if (typeof raw === 'string') return { content: raw };
            if (typeof raw === 'object' && raw !== null) {
              const obj = raw as Record<string, unknown>;
              const content = obj.stdout ?? obj.content ?? JSON.stringify(raw);
              return { content: String(content) };
            }
            return { content: String(raw ?? '') };
          } catch (e) {
            const message = e instanceof Error ? e.message : '未知错误';
            return { content: `错误: ${message}` };
          }
        },
      });
    }
    return map;
  }

  async query(userMessage: string): Promise<QueryResult> {
    const endConvManager = getEndConversationManager()
    const check = endConvManager.checkInput(userMessage)
    if (check.shouldEnd) {
      return {
        type: 'ended' as const,
        output: endConvManager.getEndMessage(),
        reason: check.reason,
      }
    }
    if (check.shouldWarn) {
      this._conversation.messages.push({
        role: 'assistant' as const,
        content: endConvManager.getWarningMessage(),
      })
    }
    return this.messageLoop.run(userMessage);
  }

  async sendMessage(userMessage: string): Promise<QueryResult> {
    if (this.stateMachine.isTerminal()) {
      this.stateMachine.reset();
      this._conversation.messages = [];
    }
    return this.messageLoop.run(userMessage);
  }

  async abort(): Promise<void> {
    this.abortController.abort()
    await this.stateMachine.transition("aborted_by_user");
  }

  grantPermission(requestId: string): void {
    const entry = this.pendingRequests.get(requestId);
    if (entry) {
      entry.resolve(true);
      this.pendingRequests.delete(requestId);
    }
  }

  denyPermission(requestId: string): void {
    const entry = this.pendingRequests.get(requestId);
    if (entry) {
      entry.resolve(false);
      this.pendingRequests.delete(requestId);
    }
  }

  getState(): string {
    return this.stateMachine.state;
  }

  pause(reason?: string): void {
    this.messageLoop.pause(reason)
  }

  resume(input?: string): void {
    this.messageLoop.resume(input)
  }

  isPaused(): boolean {
    return this.messageLoop.isPaused()
  }

  isCircuitOpen(toolName: string): boolean {
    return this.recovery.isCircuitOpen(toolName)
  }

  getCircuitState(toolName: string) {
    return this.recovery.getCircuitState(toolName)
  }

  resetCircuit(toolName: string): void {
    this.recovery.resetCircuit(toolName)
  }

  resetAllCircuits(): void {
    this.recovery.resetAllCircuits()
  }

  getTools(): ToolDefinition[] {
    return this._toolDefinitions;
  }

  getHistory(): Array<{ role: string; content: string }> {
    return this._conversation.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));
  }

  clearHistory(): void {
    this._conversation.messages = [];
  }

  getConfig(): Record<string, unknown> {
    return {
      model: this.opts.model,
      provider: this.opts.provider,
      maxOutputTokens: this.opts.maxOutputTokens,
      systemPrompt: this.opts.systemPrompt,
    };
  }

  updateConfig(updates: Record<string, unknown>): void {
    if ('model' in updates) { this.opts.model = updates.model as string; }
    if ('provider' in updates) { this.opts.provider = updates.provider as 'anthropic' | 'openai'; }
    if ('maxOutputTokens' in updates) { this.opts.maxOutputTokens = updates.maxOutputTokens as number; }
    if ('systemPrompt' in updates) { this.opts.systemPrompt = updates.systemPrompt as string; }
  }

  /** 构建增强版系统提示词（吸收 CLI 版完整能力） */
  buildSystemPrompt(): string {
    return buildEnhancedSystemPrompt({
      basePrompt: this.opts.systemPrompt ?? '',
      toolDefinitions: this._toolDefinitions,
      skills: this.opts.skills,
      agents: this.opts.agents,
      subagents: this.opts.subagents,
    });
  }

  setPreAnalysis(preAnalysis: Array<{ type: string; message: string; line?: number }>): void {
    this._preAnalysis = preAnalysis;
  }

  setApiClient(apiClient: { sendMessage: (request: unknown) => Promise<AsyncIterable<unknown>> }): void {
    const loop = this as unknown as { messageLoop: { deps: { apiClient: unknown } } }
    if (loop && loop.messageLoop) {
      ;(loop.messageLoop as { deps: { apiClient: { sendMessage: (request: unknown) => Promise<AsyncIterable<unknown>> } } }).deps.apiClient = apiClient
    }
  }
}

export { ErrorClassifier };
export * from "./stateMachine.ts";
export * from "./messageNormalizer.ts";
export * from "./messages.ts";
export * from "./requestBuilder.ts";
export * from "./responseHandler.ts";
export * from "./toolScheduler.ts";
export * from "./harnessAdapter.ts";
export * from "./sandbox/index.ts";
export * from "./tokenBudgetManager.ts";
export * from "./autoCompactor.ts";
export * from "./errors/index.ts";
export * from "./errors/classifier.ts";
export * from "./errors/retryHandler.ts";
export * from "./errors/recovery.ts";
export * from "./repoMap.ts";
export * from "./coders/index.ts";
