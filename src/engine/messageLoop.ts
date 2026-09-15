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
import { RequestBuilder, type HarnessConfig } from "./requestBuilder.ts";
import { ResponseHandler, type ProcessedResponse } from "./responseHandler.ts";
import { ToolScheduler } from "./toolScheduler.ts";
import { ErrorClassifier } from "./errors/classifier.ts";
import { AutoCompactor } from "./autoCompactor.ts";
import { AutoFixLoop, type AutoFixLoopConfig } from "./autoFixLoop.ts";
import { GitContextInjector, type GitContextConfig } from "./gitContext.ts";

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
  provider: string;
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
}

export class MessageLoop {
  private maxIterations = 100;
  private currentIteration = 0;
  private consecutiveToolFailures = 0;
  private consecutiveMaxTokens = 0;
  private autoFixLoop: AutoFixLoop | null = null;
  private gitContext: GitContextInjector | null = null;
  private lastToolCalls: Array<{ name: string }> = [];
  private autoContinueCount = 0;

  constructor(private deps: MessageLoopDeps) {
    if (!this.deps.onEvent) {
      this.deps.onEvent = () => {}
    }
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

  resetAutoFixLoop(): void {
    this.autoFixLoop?.reset()
  }

  resetGitContext(): void {
    this.gitContext = null
  }

  async run(userMessage: string): Promise<QueryResult> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    console.log(`[LOOP] run START requestId=${requestId} msgLen=${userMessage.length}`)
    this.deps.onEvent({ type: 'iteration_start', iteration: 0 });
    this.resetAutoFixLoop()
    this.resetGitContext()
    this.deps.tokenBudget.resetIterationSnapshots?.()
    this.lastToolCalls = []
    this.autoContinueCount = 0
    this.deps.conversation.messages.push({ role: "user", content: userMessage } as InternalMessage);
    await this.deps.stateMachine.transition("responding", { message: userMessage });
    this.consecutiveToolFailures = 0;
    this.consecutiveMaxTokens = 0;

    const start = Date.now();
    while (this.deps.stateMachine.canContinue()) {
      this.currentIteration++;
      if (this.currentIteration > this.maxIterations) {
        await this.deps.stateMachine.transition("crashed", { reason: "超过最大迭代次数" });
        break;
      }
      this.deps.onEvent({ type: 'iteration_start', iteration: this.currentIteration });
      try {
        const shouldContinue = await this.runIteration();
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        console.log(`[${ts}] [LOOP] iter=${this.currentIteration}/${this.maxIterations} shouldContinue=${shouldContinue} state=${this.deps.stateMachine.state}`)
        if (!shouldContinue) {
          if (this.deps.acceptanceGate) {
            const gateResult = await this.deps.acceptanceGate.check()
            if (!gateResult.allRequiredPass) {
              engineLog('ACCEPTANCE', 'Required acceptance criteria not met, continuing to fix')
              this.deps.onEvent({ type: 'should_continue' })
              await this.deps.stateMachine.transition("should_continue")
              continue
            }
          }
          await this.deps.stateMachine.transition("done");
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
        this.deps.onEvent({ type: 'error', error: errMsg, stack: errStack });
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
    this.deps.onEvent({ type: 'done', result });
    return result;
  }

  private async runIteration(): Promise<boolean> {
    const budget = this.deps.tokenBudget.checkBudget(this.deps.conversation.messages);
    if (budget.shouldReject) throw new Error(`Token limit exceeded: ${budget.percentage * 100}%`);
    if (budget.shouldCompact && this.deps.autoCompactor) {
      const before = this.deps.conversation.messages.length;
      this.deps.conversation.messages = await this.deps.autoCompactor.compact(this.deps.conversation.messages);
      const removed = before - this.deps.conversation.messages.length;
      if (removed > 0) {
        engineLog('COMPACT', `Compacted ${removed} messages due to budget limit`);
      }
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
    });

    engineLog('REQ', JSON.stringify(request, null, 2).slice(0, 5000));

    const stream = await this.deps.apiClient.sendMessage(request);
    // 推理旁路透传：thinking 块不进 conversation/history，仅转发事件给上层
    this.deps.responseHandler.onReasoning = (text: string) => {
      if (this.deps.onEvent) this.deps.onEvent({ type: 'reasoning', text });
    };
    // 流式正文实时透传：把增量文本作为 response_chunk 事件发给上层（前端逐字显示）
    this.deps.responseHandler.onChunk = (chunk: { type: string; text?: string }) => {
      if (chunk.type === 'text' && chunk.text && this.deps.onEvent) {
        this.deps.onEvent({ type: 'response_chunk', content: chunk.text });
      }
    };
    const processed = await this.deps.responseHandler.handle(stream as AsyncIterable<{ type: string; [k: string]: unknown }>);

    if (processed.usage) {
      this.deps.tokenBudget.recordUsage(processed.usage.inputTokens, processed.usage.outputTokens);
    }

    engineLog('RESP', JSON.stringify(processed, null, 2).slice(0, 10000));

    let shouldContinue = await this._recordAssistantResponse(processed);

    if (!shouldContinue && this.deps.acceptanceGate) {
      const gateResult = await this.deps.acceptanceGate.check()
      if (!gateResult.allRequiredPass) {
        engineLog('ACCEPTANCE', 'Required acceptance criteria not met, continuing to fix')
        this.deps.onEvent({ type: 'should_continue' })
        shouldContinue = true
      }
    }

    if (!shouldContinue) {
      return false;
    }
    this.deps.conversation.messages.push({
      role: "system",
      content: "Continuing to next iteration.",
    } as InternalMessage);

    if (processed.toolCalls.length > 0) {
      const availableTools = new Set(this.deps.toolDefinitions.map(t => t.name));
      const validCalls = processed.toolCalls.filter(tc => tc.name && availableTools.has(tc.name));
      const invalidCalls = processed.toolCalls.filter(tc => !tc.name || !availableTools.has(tc.name));

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
        if (this.consecutiveToolFailures >= 2) {
          engineLog('WARN', 'Too many consecutive invalid tool calls, stopping');
          return false;
        }
        await this.deps.stateMachine.transition("should_continue");
        return true;
      }

      engineLog('TOOL_CALLS', JSON.stringify(validCalls, null, 2).slice(0, 10000));
      this.deps.onEvent({ type: 'request_sent', model: this.deps.model });

      for (const tc of validCalls) {
        this.deps.onEvent({
          type: 'tool_call_start',
          toolUseId: tc.id,
          toolName: tc.name,
          input: tc.input as Record<string, unknown>,
        });
      }

      for (const tc of validCalls) {
        this.deps.onEvent({
          type: 'pre_tool_use',
          toolUseId: tc.id,
          toolName: tc.name,
          input: tc.input as Record<string, unknown>,
        });
      }

      const results = await this.deps.toolScheduler.execute(validCalls);

      engineLog('TOOL_RESULTS', JSON.stringify(results, null, 2).slice(0, 10000));

      for (const r of results) {
        this.deps.onEvent({
          type: 'post_tool_use',
          toolUseId: r.toolUseId,
          toolName: validCalls.find(tc => tc.id === r.toolUseId)?.name ?? '',
          success: r.success,
          output: typeof r.output === 'string' ? r.output : JSON.stringify(r.output ?? ''),
          error: r.error,
        });
      }

      const failedCount = results.filter(r => !r.success).length;
      if (failedCount > 0) {
        this.consecutiveToolFailures += failedCount;
        engineLog('WARN', `${failedCount} tool call(s) failed, consecutive failures: ${this.consecutiveToolFailures}`);
      } else if (validCalls.length > 0) {
        this.consecutiveToolFailures = 0;
      }

      if (this.consecutiveToolFailures >= 3) {
        engineLog('WARN', 'Too many consecutive tool failures, stopping tool loop');
        this.deps.conversation.messages.push({
          role: "system",
          content: "Tool calls are failing. Please answer directly without using tools.",
        } as InternalMessage);
        return false;
      }

      this.deps.conversation.addToolResults(results);

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

      this.deps.onEvent({ type: 'iteration_end', iteration: this.currentIteration, hasToolCalls: true });
      await this.deps.stateMachine.transition("should_continue");
      return true;
    }

    this.deps.onEvent({ type: 'iteration_end', iteration: this.currentIteration, hasToolCalls: false });

    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    console.log(`[${ts}] [LOOP] no-tool round: stopReason=${processed.stopReason} needsUserInput=${processed.needsUserInput} contentLen=${typeof processed.content === 'string' ? processed.content.length : JSON.stringify(processed.content).length}`)

    if (processed.needsUserInput) {
      this.deps.onEvent({ type: 'needs_user', prompt: processed.content as string });
      return true;
    }

    if (processed.stopReason === "end_turn") return false;
    if (processed.stopReason === "max_tokens") {
      this.consecutiveMaxTokens++;
      if (this.consecutiveMaxTokens >= 3) {
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
    const acLeft = ac.autoContinue?.maxCount ?? 5
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
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.deps.conversation.messages.push({
          role: 'user',
          content: '继续',
        } as InternalMessage);
        engineLog('AUTO_CONTINUE', '检测到"是否继续"关键词，3秒后自动发送"继续"');
        this.autoContinueCount++
        return true;
      }
    }

    if (processed.needsUserInput) {
      this.deps.onEvent({ type: 'needs_user', prompt: processed.content as string });
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
      this.deps.onEvent({ type: 'should_continue' });
      return true;
    }

    return false;
  }
}
