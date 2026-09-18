/**
 * engine/autoCompactor.ts — 自动压缩器（文档 02 §8.1）
 *
 * 策略：summary / truncate / selective（策略模式，对应文档 01 §7.2）。
 */
import type { InternalMessage } from "./messageNormalizer.ts";
import { splitAtSafeBoundary, ensureToolResultPairing, groupMessagesByApiRound } from "./messageIntegrity.ts";
import { buildCompactPrompt, formatCompactSummary, buildSummaryMessage } from "./compactPrompt.ts";

export interface CompactOptions {
  /**
   * 保留最近多少**轮**（API 往返次数），而非消息条数。
   *
   * 语义变更说明：原实现按消息条数 `slice(-N)` 切分，切点会落在
   * `assistant(tool_use)` 与 `tool_result` 之间，导致保留段以孤立 tool_result
   * 开头 —— Anthropic / OpenAI 都会直接 400。现在改为按 API 轮次边界切分，
   * 配对完整性由 splitAtSafeBoundary 保证。
   */
  preserveRecentCount: number;
  preserveSystemMessages: boolean;
  preserveToolResults?: boolean;
  /**
   * 本会话此前的要点（由 `SessionMemory.formatForCompact()` 生成）。
   *
   * 长对话会被多次压缩，每次摘要都是对"上一次摘要"的二次加工，
   * 早期关键信息逐轮衰减。把它一并交给摘要器，让它看到的是**累加的要点列表**，
   * 而不是只能从当前消息里重新推断。
   *
   * 为空/未传时行为与改动前完全一致。
   */
  priorNotes?: string;
  /** 吸收自 Hermes Agent 程序化记忆：摘要时注入相关记忆上下文 */
  memoryContext?: string[]
}

export interface CompactStrategy {
  name: string;
  compact(messages: InternalMessage[], options: CompactOptions): Promise<InternalMessage[]>;
}

/**
 * LLM 驱动的会话摘要策略（对齐 OpenCode agent.go Summarize）。
 * 依赖外部 LLM API client 生成真实摘要，而非简单 join。
 */
export class SummaryStrategy implements CompactStrategy {
  name = "summary";

  private _llmClient?: { sendMessage: (req: unknown) => Promise<AsyncIterable<unknown>> };
  /** 附加到摘要提示词末尾的自定义指令（如"重点保留 API 设计决策"） */
  private customInstructions?: string;

  /** 设置 LLM API client（由 AutoCompactor.setApiClient 调用） */
  setLlmClient(client?: { sendMessage: (req: unknown) => Promise<AsyncIterable<unknown>> }): void {
    this._llmClient = client;
  }

  /** 设置摘要的附加指令 */
  setCustomInstructions(instructions?: string): void {
    this.customInstructions = instructions;
  }

  async compact(messages: InternalMessage[], options: CompactOptions): Promise<InternalMessage[]> {
    const system = options.preserveSystemMessages ? messages.filter((m) => m.role === "system") : [];
    const nonSys = messages.filter((m) => m.role !== "system");
    // 按 API 轮次边界切分，保证 recent 与 old 各自配对完整
    const { kept: recent, dropped: old } = splitAtSafeBoundary(nonSys, options.preserveRecentCount);
    if (old.length === 0) return ensureToolResultPairing([...system, ...recent]);

    // 有 LLM client 时生成真实摘要，否则回退到占位摘要。
    // priorNotes（本会话此前的要点）只在走 LLM 摘要时有意义 —— 占位摘要
    // 只是截断拼接，注入要点反而会让它更乱。
    // 同时注入 memoryContext（吸收自 Hermes Agent 程序化记忆）
    const memoryContext = options.memoryContext?.length
      ? `\n\n[相关记忆]\n${options.memoryContext.join('\n')}`
      : ''
    const summary = this._llmClient
      ? await this.generateSummaryWithLLM(old, options.priorNotes, memoryContext)
      : await this.generateSummaryFallback(old);

    return ensureToolResultPairing([
      ...system,
      // 用明确的「这是摘要」包装，避免模型把摘要误当成用户说的话；
      // 同时提示它不要向用户复述摘要本身。
      { role: "system", content: buildSummaryMessage(summary) },
      ...recent,
    ]);
  }

  /**
   * 通过 LLM 生成摘要（对齐 OpenCode Summarize prompt）。
   * 将旧消息 + 摘要 prompt 发给模型，提取摘要内容。
   */
  private async generateSummaryWithLLM(
    messages: InternalMessage[],
    priorNotes?: string,
    /** 相关记忆段（已含前后的换行与标题，见调用点）；空串表示无 */
    memoryContext?: string,
  ): Promise<string> {
    if (!this._llmClient) return this.generateSummaryFallback(messages);

    // 用 9 段式结构化提示词（engine/compactPrompt.ts）。
    // 原实现是一句话的英文提示（"Provide a detailed but concise summary..."），
    // 自由格式的摘要会随机漏掉「用户纠正过什么」「踩过哪些坑」这类
    // 最该保留的信息，导致压缩后模型在原地再错一次。
    const basePrompt = buildCompactPrompt(this.customInstructions);
    // 会话记忆（此前几轮压缩沉淀的要点）拼在提示词**前面**：
    // 让摘要器先看到"已确认的事实"，再读本轮消息 —— 它的任务是
    // 「在既有要点基础上补充/修正」，而不是从零推断。
    const memorySection = memoryContext && memoryContext.trim() ? memoryContext : "";
    const summarizePrompt =
      (priorNotes && priorNotes.trim()
        ? `${priorNotes.trim()}\n\n${basePrompt}`
        : basePrompt) + memorySection;

    const contextMsgs: InternalMessage[] = [
      ...messages,
      { role: "user", content: summarizePrompt },
    ];

    try {
      const stream = await this._llmClient!.sendMessage({
        messages: contextMsgs.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 4000,
        temperature: 0.3,
      });

      // 从流中聚合 text content
      const chunks: string[] = [];
      for await (const event of stream as AsyncIterable<{ type: string; text?: string }>) {
        if (event.type === "content_block_delta" && event.text) {
          chunks.push(event.text);
        }
      }
      const raw = chunks.join("").trim();
      // 剥离 <analysis> 草稿块并把 <summary> 转成可读标题。
      // 草稿只是思考过程，不该进上下文。
      const summary = formatCompactSummary(raw);
      if (summary.length > 100) return summary;
    } catch {
      // 降级到占位摘要
    }

    return this.generateSummaryFallback(messages);
  }

  /**
   * 占位摘要（无 LLM client 时使用）。
   * 统计消息轮次 + 列出涉及的工具名。
   */
  private async generateSummaryFallback(messages: InternalMessage[]): Promise<string> {
    const toolCalls: string[] = [];
    let turns = 0;

    for (const m of messages) {
      if (m.role === "assistant") turns++;
      if (m.role === "assistant" && Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block && typeof block === "object" && (block as Record<string, unknown>).type === "tool_use") {
            toolCalls.push((block as Record<string, unknown>).name as string);
          }
        }
      }
    }

    const parts = [`${turns} 轮对话`];
    if (toolCalls.length > 0) {
      parts.push(`调用工具: ${[...new Set(toolCalls)].join(", ")}`);
    }
    parts.push(`共 ${messages.length} 条消息`);

    return parts.join("；");
  }
}

export class TruncateStrategy implements CompactStrategy {
  name = "truncate";
  async compact(messages: InternalMessage[], options: CompactOptions): Promise<InternalMessage[]> {
    const system = options.preserveSystemMessages ? messages.filter((m) => m.role === "system") : [];
    const nonSys = messages.filter((m) => m.role !== "system");
    const { kept } = splitAtSafeBoundary(nonSys, options.preserveRecentCount);
    return ensureToolResultPairing([...system, ...kept]);
  }
}

export class SelectiveStrategy implements CompactStrategy {
  name = "selective";
  async compact(messages: InternalMessage[], options: CompactOptions): Promise<InternalMessage[]> {
    const system = options.preserveSystemMessages ? messages.filter((m) => m.role === "system") : [];
    const nonSys = messages.filter((m) => m.role !== "system");
    const { kept: recent, dropped: old } = splitAtSafeBoundary(nonSys, options.preserveRecentCount);
    // 只挑选「整轮」保留：若单独挑出旧消息里的 tool 结果，会立刻产生孤立 tool_result
    const importantGroups = groupMessagesByApiRound(old).filter(group =>
      group.some((msg) => {
        if (options.preserveToolResults && msg.role === "tool") return true;
        const c = typeof msg.content === "string" ? msg.content : "";
        if (c.includes("```")) return true;
        if (/重要|关键|决定|决策|结论|important|key|decision/.test(c)) return true;
        return false;
      }),
    );
    return ensureToolResultPairing([...system, ...importantGroups.flat(), ...recent]);
  }
}

export class AutoCompactor {
  private strategies = new Map<string, CompactStrategy>();
  private defaultStrategy = "summary";
  private _summaryStrategy?: SummaryStrategy;

  constructor() {
    const summaryStrat = new SummaryStrategy();
    this._summaryStrategy = summaryStrat;
    this.registerStrategy(summaryStrat);
    this.registerStrategy(new TruncateStrategy());
    this.registerStrategy(new SelectiveStrategy());
  }

  /** 注入 LLM API client，使 SummaryStrategy 能生成真实摘要 */
  setApiClient(client: { sendMessage: (req: unknown) => Promise<AsyncIterable<unknown>> }): void {
    if (this._summaryStrategy) {
      this._summaryStrategy.setLlmClient(client);
    }
  }

  registerStrategy(s: CompactStrategy): void {
    this.strategies.set(s.name, s);
  }

  setDefaultStrategy(name: string): void {
    if (!this.strategies.has(name)) throw new Error(`未找到压缩策略：${name}`);
    this.defaultStrategy = name;
  }

  async compact(
    messages: InternalMessage[],
    options: Partial<CompactOptions> = {},
  ): Promise<InternalMessage[]> {
    const strategy = this.strategies.get(this.defaultStrategy);
    if (!strategy) return messages;
    return strategy.compact(messages, {
      preserveRecentCount: options.preserveRecentCount ?? 10,
      preserveSystemMessages: options.preserveSystemMessages ?? true,
      preserveToolResults: options.preserveToolResults ?? true,
    });
  }

  /** 便捷方法：返回被压缩掉的消息数量 */
  async compactCount(messages: InternalMessage[]): Promise<number> {
    const original = messages.length;
    const result = await this.compact(messages);
    return original - result.length;
  }

  /** 供 recovery.ts 调用的轻量占位的压缩（§9.4） */
  async compactPlaceholder(): Promise<void> {
    // 由外部持有 conversation 引用时替换真实消息
  }
}