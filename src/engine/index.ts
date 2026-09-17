/**
 * engine/index.ts — 核心引擎装配入口（Web 版，吸收 CLI 版增强特性）
 *
 * 聚合：状态机 + 消息循环 + 消息规范化 + 请求构建 + 响应处理 +
 * 工具调度 + Token 预算 + 自动压缩 + 错误处理/恢复 + 流式 + 子代理。
 */
import { QueryStateMachine } from "./stateMachine.ts";
import { MessageLoop, type MessageLoopDeps, type QueryResult, type AutoContinueConfig } from "./messageLoop.ts";
import { MessageNormalizer, type InternalMessage } from "./messageNormalizer.ts";
import { RequestBuilder, type ToolDefinition, type HarnessConfig, type Tools } from "./requestBuilder.ts";
import { ResponseHandler } from "./responseHandler.ts";
import { ToolScheduler, type PermissionManager, type ToolExecutor, type Tool, type ToolHooks } from "./toolScheduler.ts";
import type { PermissionRule } from "./permissions/permissionRules.ts";
import { TokenBudgetManager } from "./tokenBudgetManager.ts";
import type { AgentLoopConfig } from "./loopConfig.ts";
import type { ImageBudgetOptions } from "./imageBudget.ts";
import { AutoCompactor } from "./autoCompactor.ts";
import { ErrorClassifier } from "./errors/classifier.ts";
import { RetryHandler } from "./errors/retryHandler.ts";
import { ErrorRecovery } from "./errors/recovery.ts";
import { SubAgentManager, provideEngineConstructor } from "./subagent/subAgentManager.ts";
import { AutoFixLoop } from "./autoFixLoop.ts";
import { GitContextInjector, type GitContextConfig } from "./gitContext.ts";
import { saveSessionSnapshot, loadSessionSnapshotSync, clearSessionSnapshot, type SessionMessageSnapshot } from "./sessionRecovery.ts";
import { createSandboxedExecutor, type SandboxConfig, type SandboxPolicy, getDefaultSandboxPolicy, createDefaultSandboxConfig } from "./sandbox/index.ts";
import { createSecurityEnhancer } from "./securityEnhancer.ts";
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
import { toolPluginRegistry } from "./plugin/toolPluginRegistry.ts";
import { allLegacyToolPlugins } from "./plugin/legacyToolPlugins.ts";

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
  /** 循环控制参数（轮数上限、连续失败阈值等）；缺省用默认值 */
  agentLoop?: AgentLoopConfig;
  /** 是否记录工具调用审计（含被安全层拦截的调用） */
  enableAudit?: boolean;
  /** 审计日志目录 */
  auditDir?: string;
  /** 审计缓冲条数；缺省 100 */
  auditBufferSize?: number;
  /** 审计落盘间隔（毫秒）；缺省 10000 */
  auditFlushIntervalMs?: number;
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
  private toolSchedulerInstance?: ToolScheduler;
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
    // 安全增强层：在沙箱之上再叠加输出净化 + 命令过滤 + 路径保护 + 审计
    const securityEnhancedExecutor = createSecurityEnhancer(sandboxExecutor, {
      enableAudit: opts.enableAudit,
      auditDir: opts.auditDir,
      auditBufferSize: opts.auditBufferSize,
      auditFlushIntervalMs: opts.auditFlushIntervalMs,
    })
    const executor: ToolExecutor = securityEnhancedExecutor
    const registry = opts.tools ?? this.buildRegistry();

    // 注册旧版工具插件（同步注册定义，异步加载实现）
    toolPluginRegistry.registerAll(allLegacyToolPlugins)
    // 将插件工具定义注入到工具列表（用于构建 system prompt）
    const pluginDefs = toolPluginRegistry.getToolDefinitions()
    this._toolDefinitions.push(...pluginDefs)

    // 创建 ErrorRecovery
    this.recovery = new ErrorRecovery(this.stateMachine, this.retryHandler, this.autoCompactor);
    // 注意：ToolScheduler 只接受 (registry, permissionManager, executor) 三个参数。
    // 原代码多传了 this.recovery，构造函数并不接收 —— 多余实参在运行时被忽略，
    // 但属于类型不匹配，这里去掉以免误导（recovery 的职责在 ErrorRecovery 内部）。
    const toolScheduler = new ToolScheduler(registry, permissionManager, executor);
    this.toolSchedulerInstance = toolScheduler;

    this.conversation = this._conversation;
    this._preAnalysis = opts.preAnalysis;
    const autoFixLoopConfig = opts.autoFixLoop;

    // 将内部工具注册表转换为请求构建器所需的 ToolDefinition 格式
    this._toolDefinitions = Array.from(registry.values()).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

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
      systemPrompt: opts.systemPrompt ?? buildEnhancedSystemPrompt({
        toolDefinitions: this._toolDefinitions,
        skills: opts.skills,
        agents: opts.agents,
        subagents: opts.subagents,
      }),
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
      hookManager: opts.hookManager,
      autoContinue: opts.autoContinue,
      loopLimits: opts.agentLoop,
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
    // 工具通过 importCommands() + toolCollection.syncFromRegistry() 动态加载
    // 此处返回空 Map，由引擎外部通过 opts.tools 注入
    return new Map<string, Tool>();
  }

  /** 覆盖 messageLoop 的 onEvent，使本次查询的事件（response_chunk/done/error 等）能被上层捕获 */
  private setLoopEventHandler(handler?: (event: import("./messageLoop.ts").AgentEvent) => void): void {
    const loop = this as unknown as { messageLoop: { deps: { onEvent?: (e: import("./messageLoop.ts").AgentEvent) => void } } }
    if (loop?.messageLoop?.deps) {
      loop.messageLoop.deps.onEvent = handler || (() => {})
    }
  }

  async query(userMessage: string, handler?: (event: import("./messageLoop.ts").AgentEvent) => void): Promise<QueryResult> {
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
    if (handler) this.setLoopEventHandler(handler)
    const result = await this.messageLoop.run(userMessage);
    // 会话恢复：每轮对话结束把最新消息快照落盘，崩溃/重启后可恢复。
    void saveSessionSnapshot(this._conversation.messages as unknown as SessionMessageSnapshot[]);
    return result;
  }

  async sendMessage(userMessage: string): Promise<QueryResult> {
    if (this.stateMachine.isTerminal()) {
      this.stateMachine.reset();
      this._conversation.messages = [];
    }
    const result = await this.messageLoop.run(userMessage);
    // 会话恢复：与 query 一致，每轮对话结束把最新快照落盘。
    void saveSessionSnapshot(this._conversation.messages as unknown as SessionMessageSnapshot[]);
    return result;
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

  /**
   * 注入工具钩子（主进程启动时调用）。
   *
   * 钩子实现放在 main 层（需要 child_process 与 userData 路径），
   * engine 层不应反向依赖，因此由此处接收注入。
   */
  setToolHooks(hooks: ToolHooks): void {
    this.toolSchedulerInstance?.setHooks(hooks)
  }

  /**
   * 注入参数级权限规则（主进程启动时调用，配置热更新时重调）。
   *
   * 规则来自用户配置文件（userData/permissions.json），同样由桥接层负责读取 ——
   * engine 层不依赖 fs 路径与 Electron。
   */
  setPermissionRules(rules: PermissionRule[]): void {
    this.toolSchedulerInstance?.setPermissionRules(rules)
  }

  /** 当前生效的权限规则（供 UI 回显） */
  getPermissionRules(): PermissionRule[] {
    return this.toolSchedulerInstance?.getPermissionRules() ?? []
  }

  /** 更新引擎的工具定义列表（由 toolManager/toolRuntime 驱动，使配置切换立即生效） */
  setToolDefinitions(defs: ToolDefinition[]): void {
    this._toolDefinitions = defs
    // 同步更新 messageLoop deps，否则当前轮请求仍用旧值
    const loop = this as unknown as { messageLoop: { deps: { toolDefinitions: ToolDefinition[] } } }
    if (loop?.messageLoop?.deps) {
      loop.messageLoop.deps.toolDefinitions = defs
    }
  }

  getHistory(): Array<{ role: string; content: string }> {
    // 会话恢复：内存为空但快照存在 → 水合（崩溃/重启后入页即见旧对话）。
    if (this._conversation.messages.length === 0) {
      const snap = loadSessionSnapshotSync()
      if (snap && Array.isArray(snap.messages) && snap.messages.length > 0) {
        this._conversation.messages = snap.messages as unknown as InternalMessage[];
      }
    }
    return this._conversation.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));
  }

  clearHistory(): void {
    this._conversation.messages = [];
    // 清空历史 = 上下文归零，此前基于"上下文超限"得出的结论全部失效：
    // 压缩熔断必须复位（否则新会话带着旧的失败计数），
    // token 真实用量基准也要清掉（它对应的是已不存在的旧上下文）。
    try {
      this.messageLoop?.resetCompactCircuit?.();
    } catch {
      /* 循环尚未构造时忽略 */
    }
    try {
      this.tokenBudget?.resetApiUsageBaseline?.();
    } catch {
      /* 同上 */
    }
    // 会话快照一并删除：用户明确重新开始，不再在下次启动时恢复旧对话。
    void clearSessionSnapshot();
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
    // 上下文窗口随模型变化，预算器必须同步，否则换到小窗口模型后
    // 仍按默认 128k 判断"安全"，实际早已超出真实窗口。
    if ('contextWindowTokens' in updates) {
      const cw = Number(updates.contextWindowTokens)
      if (Number.isFinite(cw) && cw > 0) {
        this.tokenBudget.updateConfig({ maxContextTokens: cw })
      }
    }
    if ('maxOutputTokens' in updates) {
      const mo = Number(updates.maxOutputTokens)
      if (Number.isFinite(mo) && mo > 0) {
        this.tokenBudget.updateConfig({ maxOutputTokens: mo })
      }
    }
    // 循环参数热更新：改完设置立即生效，无需重启应用
    if ('agentLoop' in updates) {
      this.messageLoop.setLoopLimits(updates.agentLoop as AgentLoopConfig | void)
    }
    // 图片预算热更新：改完设置立即生效
    if ('imageBudget' in updates) {
      this.messageLoop.setImageBudget(
        updates.imageBudget as ImageBudgetOptions | void,
      )
    }
    // 工具执行超时热更新
    if ('toolTimeoutMs' in updates) {
      const t = Number(updates.toolTimeoutMs)
      if (Number.isFinite(t) && t > 0) {
        this.toolSchedulerInstance?.setDefaultToolTimeout(t)
      }
    }
  }

  /** 构建增强版系统提示词（吸收 CLI 版完整能力） */
  /** 异步初始化：加载启用的 eager 插件工具 */
  async init(): Promise<void> {
    const pluginTools = await toolPluginRegistry.loadEagerPlugins()
    for (const tool of pluginTools) {
      // 插件工具通过 toolDefinitions 注入到 tool prompt，实际执行由 engine-bridge 协调
    }
  }

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

  /**
   * 执行 / 斜杠命令（供 IPC `chat:executeCommand` 调用）。
   *
   * 查找顺序：ToolCollection（已与命令注册表同步）→ 命令注册表。
   * 注意：以前这里没有这个方法，调用方拿到 undefined 后统一报
   * “executeCommand not available”，导致 /init、/team、/help 等所有斜杠命令都不可用。
   */
  async executeCommand(
    name: string,
    args: string[] = [],
  ): Promise<{ success: boolean; output: string; error?: string; needsAgent?: boolean; plan?: unknown }> {
    const trimmed = (name || '').replace(/^\//, '').trim()
    if (!trimmed) {
      return { success: false, output: '', error: '未指定命令名' }
    }
    try {
      const [{ commandRegistry }, { toolCollection }] = await Promise.all([
        import('./commands/registry.ts'),
        import('../main/proxy/tools/toolCollection.ts'),
      ])
      const cmd = toolCollection.getTool(trimmed) || commandRegistry.get(trimmed)
      if (!cmd) {
        return { success: false, output: '', error: `未知命令: /${trimmed}（可用命令见 /help）` }
      }
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
}

export { ErrorClassifier };
export * from "./stateMachine.ts";
export * from "./messageNormalizer.ts";
export * from "./messages.ts";
export * from "./requestBuilder.ts";
export * from "./responseHandler.ts";
export * from "./toolScheduler.ts";
export * from "./sandbox/index.ts";
export { createSecurityEnhancer } from "./securityEnhancer.ts";
export * from "./tokenBudgetManager.ts";
export * from "./autoCompactor.ts";
export * from "./errors/index.ts";
export * from "./errors/classifier.ts";
export * from "./errors/retryHandler.ts";
export * from "./errors/recovery.ts";
export * from "./coders/index.ts";

// ──────────────────────────────────────────────────────────
// 空实现：底层模块尚未拆分时的占位函数（待 D:\src 或对应模块提供实现后替换）
// ──────────────────────────────────────────────────────────

/** 简单日志记录器占位实现 */
export function engineLog(tag: string, msg: string): void {
  console.debug(`[${tag}] ${msg}`)
}

/** 会话结束管理器占位实现（允许所有输入，不做拦截） */
export function getEndConversationManager() {
  return {
    checkInput: () => ({ shouldEnd: false, shouldWarn: false }),
    getEndMessage: () => '会话已结束',
    getWarningMessage: () => '',
  }
}

/** 子代理管理器占位实现（无子代理，直接透传） */
export function getSubAgentManager() {
  return {
    executeSubAgent: async () => ({ output: '' }),
  }
}

/** 自动模式管理器占位实现（无自动模式，默认返回继续） */
export function getAutoModeManager() {
  return {
    shouldAutoContinue: () => false,
  }
}

// ──────────────────────────────────────────────────────────
// 子代理引擎注入（延迟注入避免与 subAgentManager 运行时循环）
// QueryEngine 类已定义，注册默认构造器，使 SubAgentManager 缺省
// factory 能用 `new QueryEngine` 创建真正隔离的子引擎。
// ──────────────────────────────────────────────────────────
provideEngineConstructor(QueryEngine);
