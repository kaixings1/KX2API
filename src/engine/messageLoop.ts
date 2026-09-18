/**
 * engine/messageLoop.ts — 消息循环（升级版，吸收 CLI 版增强特性）
 *
 * 驱动：预算检查 → 构建请求 → 发送 API → 处理响应 → 执行工具 → 决定继续。
 */
function engineLog(prefix: string, ...args: unknown[]): void {
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  console.log(`[${t}] [ENGINE:${prefix}]`, ...args)
}
import { QueryStateMachine } from "./stateMachine.ts";
import { TokenBudgetManager } from "./tokenBudgetManager.ts";
import { MessageNormalizer, type InternalMessage } from "./messageNormalizer.ts";
import { RequestBuilder } from "./requestBuilder.ts";
import type { HarnessConfig } from "./harnessAdapter.ts";
import { ResponseHandler, type ProcessedResponse } from "./responseHandler.ts";
import { ToolScheduler } from "./toolScheduler.ts";
import { ErrorClassifier } from "./errors/classifier.ts";
import { AutoCompactor } from "./autoCompactor.ts";
import { AutoFixLoop, type AutoFixLoopConfig } from "./autoFixLoop.ts";
import { GitContextInjector, type GitContextConfig } from "./gitContext.ts";
import { resolveToolName, TOOL_ALIASES } from "./toolNameResolver";
import { resolveLoopConfig, type AgentLoopConfig } from "./loopConfig.ts";
import { CompactCoordinator } from "./compactCoordinator.ts";
import { writeSessionTranscriptSegment } from "./transcript.ts";
import { SessionMemory, extractKeyPoints } from "./memory/sessionMemory.ts";
import type { ImageBudgetOptions } from "./imageBudget.ts";

export interface QueryResult {
  state: string;
  messages: InternalMessage[];
  iterations: number;
  tokenUsage: unknown;
  duration: number;
  sessionId?: string;
  snapshotAt?: number;
  costSummary?: {
    totalCostUSD: number
    inputTokens: number
    outputTokens: number
    iterations: number
  }
}

export type AgentEvent =
  | { type: 'iteration_start'; iteration: number }
  | { type: 'request_sent'; model: string }
  | { type: 'response_chunk'; content: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call_start'; toolUseId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'post_tool_use'; toolUseId: string; toolName: string; success: boolean; output?: string; error?: string }
  | { type: 'tool_result'; toolUseId: string; content: string; isError: boolean }
  | { type: 'iteration_end'; iteration: number; hasToolCalls: boolean }
  | { type: 'done'; result: QueryResult }
  | { type: 'error'; error: string; stack?: string }
  | { type: 'aborted' }
  | { type: 'needs_user'; prompt?: string }
  | { type: 'should_continue' }
  | { type: 'pre_tool_use'; toolUseId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'paused'; reason?: string }
  | { type: 'resumed' }
  | { type: 'permission_request'; id: string; toolName: string; input: Record<string, unknown>; description?: string }

export interface AutoContinueConfig {
  enabled?: boolean;
  maxCount?: number;
  readSearch?: boolean;
  continueKeyword?: boolean;
  endTurn?: boolean;
}

export interface MessageLoopDeps {
  stateMachine: QueryStateMachine;
  tokenBudget: TokenBudgetManager;
  requestBuilder: RequestBuilder;
  responseHandler: ResponseHandler;
  toolScheduler: ToolScheduler;
  apiClient: { sendMessage: (req: unknown) => Promise<AsyncIterable<unknown>> };
  conversation: { messages: InternalMessage[]; addToolResults: (r: unknown[]) => void };
  systemPrompt: string;
  model: string;
  maxOutputTokens: number;
  toolDefinitions: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  /**
   * 供应商标识。用 RequestParams 的联合类型而非宽泛的 string ——
   * 后者传给 requestBuilder 时会报 TS2322（string 不可赋给联合类型），
   * 而且放宽类型也失去了"写错 provider 名"的保护。
   */
  provider: import('./requestBuilder.ts').RequestParams['provider'];
  onEvent?: (event: AgentEvent) => void;
  autoCompactor?: AutoCompactor;
  preAnalysis?: Array<{ type: string; message: string; line?: number }>;
  autoFixLoop?: AutoFixLoopConfig;
  gitContext?: GitContextConfig;
  imageBudget?: Partial<{
    historyBase64TokenThreshold: number
    maxImageTokensPerMessage: number
  }>;
  harness?: HarnessConfig;
  acceptanceGate?: { check: () => Promise<{ allRequiredPass: boolean }> };
  /** 循环控制参数（轮数上限、连续失败阈值等），缺省用默认值 */
  loopLimits?: AgentLoopConfig;
  /** 会话标识：压缩前转录落盘的会话名；缺省用 'default' */
  sessionId?: string;
  /**
   * 自动继续配置：检测到「是否继续」类结尾关键词时自动追加"继续"，
   * 由配置决定场景。引擎内部经 MessageLoopDeps 注入（见第 734 行按需读取）。
   */
  autoContinue?: AutoContinueConfig;
}

export class MessageLoop {
  private currentIteration = 0;
  private consecutiveToolFailures = 0;
  private consecutiveMaxTokens = 0;
  private autoFixLoop: AutoFixLoop | null = null;
  private gitContext: GitContextInjector | null = null;
  private lastToolCalls: Array<{ name: string }> = [];
  private autoContinueCount = 0;
  /** 近期各轮的「有效工具签名集合」（名称:参数JSON，排序后）。用于检测模型是否陷入重复工具循环。 */
  private toolSignatureHistory: string[] = [];
  /** 循环控制参数 —— 由 deps.loopLimits 注入，缺省回落到默认值 */
  private limits: Required<AgentLoopConfig>;
  /**
   * 事件发射器（保证非空）。
   *
   * deps.onEvent 声明为可选（调用方可以不订阅），但本类到处直接调用它。
   * 原实现在构造函数里做兜底赋值，然而 TS 不认"构造期赋值" ——
   * 19 处调用全部报 TS2722（Cannot invoke an object which is possibly 'undefined'）。
   * 改为存一份非空引用：可选性只体现在 deps 入参上，内部一律用本字段。
   *
   * ⚠️ 不能在构造期把引用快照下来：QueryEngine.setLoopEventHandler() 会在每次
   * query() 前**事后替换** deps.onEvent，快照会让新 handler 永远收不到事件
   * （表现为界面不显示内容、也不停止）。故用 getter 每次动态取。
   */
  private get emit(): (event: AgentEvent) => void {
    return this.deps.onEvent ?? (() => {})
  }
  /**
   * 会话级滚动记忆（单次对话内、只喂给压缩）。
   *
   * 与磁盘上的项目记忆不同层次：它随会话创建、随会话丢弃，不落盘。
   * 作用是让多次压缩之间保持信息连续性 —— 见 sessionMemory.ts 的说明。
   */
  private sessionMemory = new SessionMemory();
  /** 已执行的压缩轮次，用于标记要点来源 */
  private compactRound = 0;
  /** 压缩阈值与熔断状态；惰性创建（需要先拿到预算器的窗口配置） */
  private compactCoordinatorInstance: CompactCoordinator | null = null;
  /**
   * 本次 query 是否已触发过死循环熔断。
   *
   * LOOP_GUARD 直接 done 会让会话最后一条消息变成给模型的内部提示，
   * 用户看不到任何答复（界面「一直不显示」）。因此第一次触发时只切断工具执行、
   * 再给模型一轮机会基于已有工具结果作答；若它仍然重复，才真正终止。
   */
  private loopGuardTripped = false;

  constructor(private deps: MessageLoopDeps) {
    this.limits = resolveLoopConfig(this.deps.loopLimits)
    if (this.deps.autoFixLoop?.enabled) {
      this.autoFixLoop = new AutoFixLoop({
        ...this.deps.autoFixLoop,
        onEvent: (event) => {
          engineLog('AUTOFIX', event.type)
          this.deps.autoFixLoop?.onEvent?.(event)
        },
      })
    }
    if (this.deps.gitContext?.enabled) {
      this.gitContext = new GitContextInjector(this.deps.gitContext)
    }
  }

  /**
   * 更新循环控制参数（设置界面改完即可生效，无需重启）。
   * 传入空值时回落到默认值。
   */
  setLoopLimits(limits?: AgentLoopConfig | null): void {
    this.limits = resolveLoopConfig(limits)
  }

  /** 当前生效的循环控制参数（供 UI 回显与诊断） */
  getLoopLimits(): Required<AgentLoopConfig> {
    return { ...this.limits }
  }

  /** 当前会话记忆的要点数（诊断用） */
  getSessionMemorySize(): number {
    return this.sessionMemory.size
  }

  // ─────────────────── 暂停 / 恢复 ───────────────────
  //
  // `QueryEngine.pause()` / `resume()` / `isPaused()` 以及 IPC 的
  // `chat:pause` / `chat:resume` / `chat:getState` 一直在调用这些方法，
  // 但 MessageLoop **从未实现过它们** —— 一旦触发就是
  // `this.messageLoop.pause is not a function`。
  //
  // 语义：暂停发生在**轮次边界**，不打断正在进行的 API 请求。
  // 中断一个已经发出的请求会浪费 token 且可能留下不完整的 tool_use
  // （破坏配对不变量），得不偿失。

  /** 是否处于暂停状态 */
  private paused = false
  /** 暂停原因（供 UI 展示） */
  private pauseReason: string | null = null
  /** 暂停期间等待恢复的通知器 */
  private resumeWaiters: Array<() => void> = []

  /** 暂停循环（在下一个轮次边界生效） */
  pause(reason?: string): void {
    if (this.paused) return
    this.paused = true
    this.pauseReason = reason ?? null
    engineLog('PAUSE', reason ? `已暂停：${reason}` : '已暂停')
    this.emit({ type: 'paused', reason })
  }

  /**
   * 恢复循环。
   *
   * @param input 可选：恢复时追加的一条用户消息（用于"暂停后补充指示再继续"）
   */
  resume(input?: string): void {
    if (!this.paused) return
    this.paused = false
    this.pauseReason = null
    if (input && input.trim()) {
      this.deps.conversation.messages.push({
        role: 'user',
        content: input,
      } as InternalMessage)
    }
    // 唤醒所有等待者，让主循环继续推进
    const waiters = this.resumeWaiters
    this.resumeWaiters = []
    for (const w of waiters) w()
    engineLog('PAUSE', input ? `已恢复并追加指令` : '已恢复')
    this.emit({ type: 'resumed' })
  }

  isPaused(): boolean {
    return this.paused
  }

  /** 暂停原因（未暂停时返回 null） */
  getPauseReason(): string | null {
    return this.pauseReason
  }

  /**
   * 在轮次边界等待恢复。
   *
   * 只在 paused 为真时挂起；不设超时 —— 暂停是用户的明确意图，
   * 超时自动恢复会让"暂停"变得不可预期。
   */
  private async waitIfPaused(): Promise<void> {
    while (this.paused) {
      await new Promise<void>(resolve => this.resumeWaiters.push(resolve))
    }
  }

  /** 更新图片预算（设置界面改完即时生效）；传空值表示不启用裁剪 */
  setImageBudget(budget?: ImageBudgetOptions | null): void {
    this.deps.imageBudget = budget ?? void 0
  }

  /** 清空会话记忆（会话重置 / 用户清空上下文时调用） */
  resetSessionMemory(): void {
    this.sessionMemory.clear()
    this.compactRound = 0
  }

  /**
   * 从压缩产物中吸收要点进会话记忆。
   *
   * 压缩后的消息里第一条 system 通常是摘要（由 `buildSummaryMessage` 包装）。
   * 从中抽取「约束/决策/错误」类段落累加 —— 下一步、当前工作那类段落
   * 下一轮就过时了，存进去只会挤占额度。
   */
  private absorbCompactSummary(
    before: InternalMessage[],
    after: InternalMessage[],
  ): void {
    try {
      // 没变小说明压缩未生效，不产生新要点
      if (after.length >= before.length) return

      // 找压缩产出的摘要：压缩后新增/替换的 system 消息，且长度显著
      const summaryMsg = after.find(
        m => m.role === 'system' && typeof m.content === 'string' && m.content.length > 200,
      )
      if (!summaryMsg || typeof summaryMsg.content !== 'string') return

      this.compactRound++
      const points = extractKeyPoints(summaryMsg.content)
      if (points.length > 0) {
        this.sessionMemory.addAll(points, this.compactRound)
        engineLog(
          'SESSION_MEMORY',
          `第 ${this.compactRound} 轮压缩沉淀 ${points.length} 条要点（累计 ${this.sessionMemory.size} 条）`,
        )
      }
    } catch (e) {
      // 会话记忆是增强项：失败绝不影响压缩结果
      console.warn('[MessageLoop] absorbCompactSummary failed:', (e as Error).message)
    }
  }

  /**
   * 惰性创建压缩协调器。
   *
   * 阈值必须基于**绝对 token 数**（有效窗口 − 缓冲），与预算器的比例判定
   * 是两套口径 —— 比例无法表达"必须给压缩本身留出发请求的空间"这件事。
   */
  private getCompactCoordinator(): CompactCoordinator {
    if (!this.compactCoordinatorInstance) {
      const cfg = this.deps.tokenBudget.getBudgetConfig()
      this.compactCoordinatorInstance = new CompactCoordinator(
        cfg.maxContextTokens,
        cfg.maxOutputTokens,
      )
    }
    return this.compactCoordinatorInstance
  }

  /**
   * 复位压缩熔断。
   *
   * 会话清空、用户手动触发压缩、切换模型后都应调用 ——
   * 否则旧的失败计数会被带进新情境，导致过早熔断。
   */
  resetCompactCircuit(): void {
    this.compactCoordinatorInstance?.resetCircuit()
  }

  /** 压缩与阈值状态（供 UI 展示剩余额度与熔断状态） */
  getCompactStatus(usedTokens: number): {
    circuit: { open: boolean; consecutiveFailures: number }
    warning: ReturnType<CompactCoordinator['getWarningState']>
    thresholds: ReturnType<CompactCoordinator['getThresholds']>
  } {
    const c = this.getCompactCoordinator()
    return {
      circuit: c.getCircuitState(),
      warning: c.getWarningState(usedTokens),
      thresholds: c.getThresholds(),
    }
  }

  resetAutoFixLoop(): void {
    this.autoFixLoop?.reset()
  }

  resetGitContext(): void {
    this.gitContext = null
  }

  async run(userMessage: string): Promise<QueryResult> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    console.log(`[LOOP] run START requestId=${requestId} msgLen=${userMessage.length}`)
    this.emit({ type: 'iteration_start', iteration: 0 });
    this.resetAutoFixLoop()
    this.resetGitContext()
    this.resetSessionMemory()
    this.lastToolCalls = []
    this.autoContinueCount = 0
    this.toolSignatureHistory = []
    this.loopGuardTripped = false
    this.deps.conversation.messages.push({ role: "user", content: userMessage } as InternalMessage);
    await this.deps.stateMachine.transition("responding", { message: userMessage });
    this.consecutiveToolFailures = 0;
    this.consecutiveMaxTokens = 0;

    const start = Date.now();
    while (this.deps.stateMachine.canContinue()) {
      // 暂停检查点：在**轮次边界**等待，不打断已发出的请求
      // （中断请求会浪费 token，且可能留下不完整的 tool_use 破坏配对）。
      await this.waitIfPaused();

      this.currentIteration++;
      if (this.currentIteration > this.limits.maxIterations) {
        await this.deps.stateMachine.transition("crashed", { reason: "超过最大迭代次数" });
        break;
      }
      this.emit({ type: 'iteration_start', iteration: this.currentIteration });
      try {
        const shouldContinue = await this.runIteration();
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        console.log(`[${ts}] [LOOP] iter=${this.currentIteration}/${this.limits.maxIterations} shouldContinue=${shouldContinue} state=${this.deps.stateMachine.state}`)
        if (!shouldContinue) {
          if (this.deps.acceptanceGate) {
            const gateResult = await this.deps.acceptanceGate.check()
            if (!gateResult.allRequiredPass) {
              engineLog('ACCEPTANCE', '验收标准未全部通过，继续修复')
              this.emit({ type: 'should_continue' })
              await this.deps.stateMachine.transition("should_continue")
              continue
            }
          }
          if (!this.deps.stateMachine.isTerminal()) {
            await this.deps.stateMachine.transition("done");
          }
          break;
        }
        if (this.deps.stateMachine.state === "should_continue") {
          await this.deps.stateMachine.transition("responding");
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack : '';
        const ts2 = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        console.error(`[${ts2}] [ENGINE] runIteration error: ${errMsg}`);
        console.error(`[${ts2}] [ENGINE] stack: ${errStack}`);
        this.emit({ type: 'error', error: errMsg, stack: errStack });
        if (this.deps.stateMachine.isTerminal()) break;
        await this.deps.stateMachine.transition("crashed", { error: ErrorClassifier.classify(error) });
        break;
      }
    }

    const result = {
      state: this.deps.stateMachine.state,
      messages: this.deps.conversation.messages,
      iterations: this.currentIteration,
      tokenUsage: this.deps.tokenBudget.getUsage(),
      duration: Date.now() - start,
    };
    this.emit({ type: 'done', result });
    return result;
  }

  private async runIteration(): Promise<boolean> {
    // 工具定义由上层按请求注入（engine-bridge 会随工具组切换而变更），
    // 必须在预算检查前同步，否则计量的是上一轮的工具集。
    this.deps.tokenBudget.setToolDefinitions(this.deps.toolDefinitions);
    let budget = this.deps.tokenBudget.checkBudget(this.deps.conversation.messages);

    // 顺序很关键：**先压缩、后拒绝**。
    //
    // 原实现是先 `shouldReject` 抛错、再尝试压缩 —— 由于 shouldReject 的阈值
    // 高于压缩触发阈值，代码永远走不到压缩分支，等于"上下文一满就直接中断"。
    // 现在改成先给压缩一次自愈机会，压不动才拒绝。
    if (this.deps.autoCompactor && budget.shouldCompact) {
      const coordinator = this.getCompactCoordinator();
      const result = await coordinator.runCompact(
        async () => {
          // 压缩前把原文落盘转录，供压缩后/崩溃后追溯。
          // fire-and-forget：transcript 内部已吞错，不影响压缩本身。
          writeSessionTranscriptSegment(this.deps.conversation.messages, {
            sessionId: this.deps.sessionId,
          });
          // 压缩前把本会话此前的要点交给摘要器：长对话会被多次压缩，
          // 每次摘要都是对「上一次摘要」的二次加工，早期关键信息逐轮衰减。
          const beforeCompact = this.deps.conversation.messages;
          this.deps.conversation.messages = await this.deps.autoCompactor!.compact(
            this.deps.conversation.messages,
            { priorNotes: this.sessionMemory.formatForCompact() },
          );
          // 压缩后从新摘要里抽取要点，累加进会话记忆（供下一轮压缩用）。
          // 放在这里而非压缩器内部：会话状态属于 messageLoop，压缩器不该持有它。
          this.absorbCompactSummary(beforeCompact, this.deps.conversation.messages);
        },
        // 用预算器的真实计量（含 API 校准值），而非简单的消息条数
        () => this.deps.tokenBudget.checkBudget(this.deps.conversation.messages).usedTokens,
      );
      const o = result.outcome;
      if (o.attempted) {
        engineLog(
          'COMPACT',
          `压缩${o.succeeded ? '成功' : '未生效'}：${o.beforeTokens} → ${o.afterTokens} tokens` +
            (o.reason ? `（${o.reason}）` : ''),
        );
      } else if (o.reason) {
        engineLog('COMPACT', `跳过压缩：${o.reason}`);
      }
      // 压缩后必须重新评估：结果可能已不再超限，也可能仍超限
      budget = this.deps.tokenBudget.checkBudget(this.deps.conversation.messages);
    }

    if (budget.shouldReject) {
      throw new Error(`Token limit exceeded: ${budget.percentage * 100}%`);
    }

    const request = await this.deps.requestBuilder.build({
      messages: this.deps.conversation.messages,
      system: this.deps.systemPrompt,
      tools: this.deps.toolDefinitions,
      model: this.deps.model,
      maxTokens: this.deps.maxOutputTokens,
      provider: this.deps.provider,
      preAnalysis: this.deps.preAnalysis,
      harness: this.deps.harness,
      // 图片预算此前只在 deps 里声明、从未向下传递 —— 图片占用因此完全不受控。
      imageBudget: this.deps.imageBudget,
    });

    engineLog('REQ', JSON.stringify(request, null, 2).slice(0, 5000));

    const stream = await this.deps.apiClient.sendMessage(request);
    // 把本轮生效的工具名交给响应处理器：纯文本工具调用修复必须以真实工具集为准，
    // 否则接口文档/示例代码里的 <name>xxx</name> 会被当成工具调用、把正文整块剥离。
    // 白名单除注册命令名外，并拢 TOOL_ALIASES 里的全部自造别名键（list_dir 等），
    // 让模型常见的按其记忆输出变体名（list_directory / read_file / current_directory）
    // 也能在入口直接命中，不依赖后续别名的「事后归一化」，双保险。
    this.deps.responseHandler.allowedToolNames = new Set([
      ...this.deps.toolDefinitions.map(t => t.name),
      ...Object.keys(TOOL_ALIASES),
    ]);
    // 推理旁路透传：thinking 块不进 conversation/history，仅转发事件给上层
    this.deps.responseHandler.onReasoning = (text: string) => {
      if (this.deps.onEvent) this.emit({ type: 'reasoning', text });
    };
    // 流式正文实时透传：把增量文本作为 response_chunk 事件发给上层（前端逐字显示）
    this.deps.responseHandler.onChunk = (chunk: { type: string; text?: string }) => {
      if (chunk.type === 'text' && chunk.text && this.deps.onEvent) {
        this.emit({ type: 'response_chunk', content: chunk.text });
      }
    };
    const processed = await this.deps.responseHandler.handle(stream as AsyncIterable<{ type: string; [k: string]: unknown }>);

    if (processed.usage) {
      this.deps.tokenBudget.recordUsage(processed.usage.inputTokens, processed.usage.outputTokens);
    }

    engineLog('RESP', JSON.stringify(processed, null, 2).slice(0, 10000));

    let shouldContinue = await this._recordAssistantResponse(processed);

    // 引擎在等待用户输入属于「终止性状态」：必须结束本轮循环，把控制权交回用户。
    // 原实现让 _recordAssistantResponse 返回 true 继续下一轮，而中文正文里
    // 「是否/继续/确认」这类词命中率极高，会导致空转直到 maxIterations(100) 才停。
    // 同时事件只在此处发一次（此前本函数与 _recordAssistantResponse 各发一次，重复推送）。
    //
    // 仅当本轮没有工具调用时才按 needs_user 收尾：模型可能在同一轮里既发起工具调用、
    // 正文又以问句结尾，此时必须先去执行工具，不能被判定提前截断。
    if (processed.needsUserInput && processed.toolCalls.length === 0) {
      this.emit({ type: 'needs_user', prompt: processed.content as string });
      this.emit({
        type: 'iteration_end',
        iteration: this.currentIteration,
        hasToolCalls: processed.toolCalls.length > 0,
      });
      return false;
    }

    if (!shouldContinue && this.deps.acceptanceGate) {
      const gateResult = await this.deps.acceptanceGate.check()
      if (!gateResult.allRequiredPass) {
        engineLog('ACCEPTANCE', '验收标准未全部通过，继续修复')
        this.emit({ type: 'should_continue' })
        shouldContinue = true
      }
    }

    if (!shouldContinue) {
      return false;
    }
    // 仅在「本轮没有工具调用」时插入续跑提示。
    //
    // 有工具调用时，assistant(含 tool_use) 必须与其 tool 结果**紧邻**，
    // 中间插入任何消息都会被上游判为
    //   400: tool calls and tool results do not match
    // （该提示对模型也无价值：下一轮随即带回工具结果）。
    if (processed.toolCalls.length === 0) {
      this.deps.conversation.messages.push({
        role: "system",
        content: "Continuing to next iteration.",
      } as InternalMessage);
    }

    if (processed.toolCalls.length > 0) {
      // 模型常发出 MCP/OpenAI 风格工具名（filesystem.list_directory、local_dir_list_2026 等），
      // 而引擎注册的是 ls/dir/pwd 这类真实命令。这里用 resolveToolName 做软匹配：
      // 能归一化到注册命令 → 视为有效（并把 name 换成注册命令名供调度执行）；
      // 不能解析 → 判为无效，避免「工具真能跑却被判 invalid 导致整轮中止」。
      //
      // 注意：client 模块会被多个 chunk 引用，rollup 可能把 resolveToolName 重命名为
      // resolveToolName2（正是上一版运行时 `resolveToolName2 is not a function` 的根因）。
      // 因此改用命名空间访问 + 兜底键名，保证取到正确函数。
      const availableTools = new Set(this.deps.toolDefinitions.map(t => t.name));
      const nameResolved = new Map<string, string | null>();
      for (const tc of processed.toolCalls) {
        if (!tc.name) { nameResolved.set(tc.name, null); continue }
        if (availableTools.has(tc.name)) { nameResolved.set(tc.name, tc.name); continue }
        let resolved: string | null = null
        try {
          resolved = await resolveToolName(tc.name)
        } catch { resolved = null }
        nameResolved.set(tc.name, resolved && availableTools.has(resolved) ? resolved : null);
      }
      const validCalls = processed.toolCalls
        .filter(tc => nameResolved.get(tc.name) != null)
        .map(tc => ({ ...tc, name: nameResolved.get(tc.name) as string }));
      const invalidCalls = processed.toolCalls.filter(tc => nameResolved.get(tc.name) == null);

      if (invalidCalls.length > 0) {
        this.consecutiveToolFailures += invalidCalls.length;
        const ts2 = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        engineLog('WARN', `${invalidCalls.length} invalid tool call(s) skipped. Valid: ${validCalls.length}, consecutive failures: ${this.consecutiveToolFailures}`);
      }

      if (validCalls.length === 0) {
        this.deps.conversation.messages.push({
          role: "system",
          content: "Previous tool calls were invalid. Please answer directly without using tools.",
        } as InternalMessage);
        // 同时清理刚写入的 assistant 消息里的无效 tool_use block，
        // 避免下一轮请求带着"孤儿 tool_use"发回上游，触发 400 配对错误。
        const lastMsg = this.deps.conversation.messages[this.deps.conversation.messages.length - 2]
        if (lastMsg && lastMsg.role === 'assistant' && Array.isArray(lastMsg.content)) {
          const hasToolUse = (lastMsg.content as Array<Record<string, unknown>>).some(b => b.type === 'tool_use')
          if (hasToolUse) {
            this.deps.conversation.messages[this.deps.conversation.messages.length - 2] = {
              role: 'assistant',
              content: typeof processed.content === 'string' ? processed.content : '',
            } as InternalMessage
          }
        }
        if (this.consecutiveToolFailures >= this.limits.maxInvalidToolCalls) {
          engineLog('WARN', '连续无效工具调用过多，停止');
          return false;
        }
        await this.deps.stateMachine.transition("should_continue");
        return true;
      }

      const sigNow = validCalls
        .map(tc => `${tc.name}:${JSON.stringify(tc.input ?? {})}`)
        .sort()
        .join('|')
      const prevSig = this.toolSignatureHistory[this.toolSignatureHistory.length - 1] ?? ''
      this.toolSignatureHistory.push(sigNow)
      if (this.toolSignatureHistory.length > 50) this.toolSignatureHistory.shift()
      // 跨轮死循环检测：模型反复发出与上一轮完全相同的工具签名（且上轮已喂回过工具结果），
      // 说明模型无视结果陷入重复请求。此时不再执行/回喂，把循环信息作为系统消息反馈并终止本轮，
      // 避免无限重复同一工具调用（用户观察到的「死循环」）。
      if (prevSig && prevSig === sigNow && this.toolSignatureHistory.length >= this.limits.toolLoopThreshold) {
        // 首次触发：只切断工具执行，再给模型一轮机会基于已有工具结果答复用户。
        // 直接 done 会让最后一条消息变成下面这条内部提示，用户看到的是空回复。
        const shouldStopNow = this.loopGuardTripped
        this.loopGuardTripped = true
        engineLog('LOOP_GUARD', `模型重复请求完全相同工具调用（${sigNow}），${shouldStopNow ? '终止循环' : '切断工具执行并转为直接作答'}`);
        this.deps.conversation.messages.push({
          role: "system",
          content: "你已在前一轮请求过完全相同的工具调用且结果已返回，请直接基于已有工具结果回答用户，不要再重复发起相同的工具调用。",
        } as InternalMessage);
        if (shouldStopNow) {
          await this.deps.stateMachine.transition("done");
          this.emit({ type: 'iteration_end', iteration: this.currentIteration, hasToolCalls: true });
          return false;
        }
        // 清掉签名历史，避免下一轮的「不再重复」指示被自己的历史再次触发熔断
        this.toolSignatureHistory = []
        await this.deps.stateMachine.transition("should_continue");
        return true;
      }

      engineLog('TOOL_CALLS', JSON.stringify(validCalls, null, 2).slice(0, 10000));
      this.emit({ type: 'request_sent', model: this.deps.model });

      for (const tc of validCalls) {
        this.emit({
          type: 'tool_call_start',
          toolUseId: tc.id,
          toolName: tc.name,
          input: tc.input as Record<string, unknown>,
        });
      }

      for (const tc of validCalls) {
        this.emit({
          type: 'pre_tool_use',
          toolUseId: tc.id,
          toolName: tc.name,
          input: tc.input as Record<string, unknown>,
        });
      }

      const results = await this.deps.toolScheduler.execute(validCalls);

      engineLog('TOOL_RESULTS', JSON.stringify(results, null, 2).slice(0, 10000));

      for (const r of results) {
        // toolUseId 在 ToolResult 上是可选的（工具自身实现不知道调用 ID，
        // 由调度器补上）。事件契约要求它是 string —— 缺失说明这条结果无法
        // 归因到某次调用，发出去只会让前端按空值建出无主条目，故跳过。
        if (typeof r.toolUseId !== 'string') continue
        this.emit({
          type: 'post_tool_use',
          toolUseId: r.toolUseId,
          toolName: validCalls.find(tc => tc.id === r.toolUseId)?.name ?? '',
          success: r.success,
          output: typeof r.output === 'string' ? r.output : JSON.stringify(r.output ?? ''),
          error: r.error,
        } as Parameters<MessageLoop['emit']>[0]);
      }

      const failedCount = results.filter(r => !r.success).length;
      if (failedCount > 0) {
        this.consecutiveToolFailures += failedCount;
        engineLog('WARN', `${failedCount} tool call(s) failed, consecutive failures: ${this.consecutiveToolFailures}`);
      } else if (validCalls.length > 0) {
        this.consecutiveToolFailures = 0;
      }

      if (this.consecutiveToolFailures >= this.limits.maxToolFailures) {
        engineLog('WARN', '连续工具失败过多，停止工具循环');
        this.deps.conversation.messages.push({
          role: "system",
          content: "Tool calls are failing. Please answer directly without using tools.",
        } as InternalMessage);
        return false;
      }

      this.deps.conversation.addToolResults(results);

      // 记录本轮实际执行的工具名，供 autoContinue.readSearch 跨轮检测
      // 「模型 read/search 后提前终止」并自动续写。此前 lastToolCalls 从未被填充，
      // 导致该分支恒不触发（死功能）；现在填实后，read/search 之后的静默终止
      // 才会被正确识别并续写。
      this.lastToolCalls = validCalls.map((tc) => ({ name: tc.name }));

      if (this.gitContext) {
        const editedFiles = this.gitContext.extractFiles(
          results.map(r => ({ toolUseId: r.toolUseId, success: r.success, output: r.output })),
        )
        if (editedFiles.length > 0) {
          const gitMessages = await this.gitContext.injectForFiles(editedFiles, '')
          for (const msg of gitMessages) {
            this.deps.conversation.messages.push(msg as InternalMessage)
          }
        }
      }

      if (this.autoFixLoop) {
        const fixMessages = await this.autoFixLoop.maybeRun(results)
        for (const msg of fixMessages) {
          this.deps.conversation.messages.push(msg as InternalMessage)
        }
      }

      this.emit({ type: 'iteration_end', iteration: this.currentIteration, hasToolCalls: true });
      await this.deps.stateMachine.transition("should_continue");
      return true;
    }

    this.emit({ type: 'iteration_end', iteration: this.currentIteration, hasToolCalls: false });

    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    console.log(`[${ts}] [LOOP] no-tool round: stopReason=${processed.stopReason} needsUserInput=${processed.needsUserInput} contentLen=${typeof processed.content === 'string' ? processed.content.length : JSON.stringify(processed.content).length}`)

    if (processed.needsUserInput) {
      this.emit({ type: 'needs_user', prompt: processed.content as string });
      return true;
    }

    if (processed.stopReason === "end_turn") return false;
    if (processed.stopReason === "max_tokens") {
      this.consecutiveMaxTokens++;
      if (this.consecutiveMaxTokens >= this.limits.maxConsecutiveMaxTokens) {
        const ts2 = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        console.log(`[${ts2}] [LOOP] consecutive max_tokens reached ${this.consecutiveMaxTokens}, stopping loop`)
        this.consecutiveMaxTokens = 0
        return false;
      }
      await this.deps.stateMachine.transition("should_continue");
      return true;
    }
    return false;
  }

  /** 将助手回复写入 conversation，并决定是否继续 */
  private async _recordAssistantResponse(processed: ProcessedResponse): Promise<boolean> {
    const hadReadOrSearch = this.lastToolCalls.some(tc => tc.name === 'read' || tc.name === 'search' || tc.name === 'glob' || tc.name === 'grep')

    if (processed.content && processed.toolCalls.length === 0) {
      this.deps.conversation.messages.push({
        role: 'assistant',
        content: processed.content,
      } as InternalMessage);
    } else if (processed.toolCalls.length > 0) {
      const blocks: Array<Record<string, unknown>> = [];
      if (typeof processed.content === 'string' && processed.content) {
        blocks.push({ type: "text", text: processed.content });
      }
      for (const tc of processed.toolCalls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      this.deps.conversation.messages.push({
        role: 'assistant',
        content: blocks,
      } as InternalMessage);
      return true;
    }

    const ac = this.deps as MessageLoopDeps & { autoContinue?: AutoContinueConfig }
    const acEnabled = ac.autoContinue?.enabled ?? false
    // 优先用显式配置的 maxCount，未配置时回落到 loopLimits
    const acLeft = ac.autoContinue?.maxCount ?? this.limits.autoContinueMaxCount
    if (acEnabled && this.autoContinueCount < acLeft) {
      const acReadSearch = ac.autoContinue?.readSearch ?? true
      if (acReadSearch && hadReadOrSearch && processed.toolCalls.length === 0) {
        engineLog('AUTO_CONTINUE', '检测到 read/search 后提前终止，自动继续');
        this.lastToolCalls = [];
        this.autoContinueCount++
        return true;
      }
      const acKeyword = ac.autoContinue?.continueKeyword ?? false
      const content = typeof processed.content === 'string' ? processed.content : '';
      if (acKeyword && content && /是否继续|是否需要|是否同意|需要我|继续吗|确认一下/.test(content)) {
        await new Promise(resolve => setTimeout(resolve, this.limits.autoContinueDelayMs));
        this.deps.conversation.messages.push({
          role: 'user',
          content: '继续',
        } as InternalMessage);
        engineLog('AUTO_CONTINUE', `检测到"是否继续"关键词，${this.limits.autoContinueDelayMs}ms 后自动发送"继续"`);
        this.autoContinueCount++
        return true;
      }
    }

    // 这里只做「是否要继续」的决策，不在此发事件 ——
    // needs_user 事件统一由 runIteration 发一次，否则同一轮会推送两次。
    if (processed.needsUserInput) {
      return true;
    }

    if (processed.stopReason === 'end_turn') {
      if (typeof processed.content === 'string' && processed.content.trim()) {
        const acEndTurn = (ac.autoContinue?.endTurn ?? false) && acEnabled && this.autoContinueCount < acLeft
        if (acEndTurn) {
          engineLog('AUTO_CONTINUE', `end_turn 收到回复，按配置自动继续`);
          this.deps.conversation.messages.push({
            role: 'user',
            content: '继续',
          } as InternalMessage);
          this.autoContinueCount++
        }
        return acEndTurn
      }
      return false;
    }
    if (processed.stopReason === 'max_tokens') {
      this.emit({ type: 'should_continue' });
      return true;
    }

    return false;
  }
}
