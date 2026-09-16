/**
 * engine/tokenBudgetManager.ts — Token 预算管理器（文档 02 §7.1）
 *
 * 监控 Token 使用量、触发压缩、防止超限。
 */
import type { InternalMessage } from "./messageNormalizer.ts";
import {
  estimateContentTokens,
  estimateTokensWithCjk,
  safeStringify,
} from "./token-counter/index.ts";

export type BudgetStatus = "safe" | "warning" | "danger" | "limit";

export interface BudgetConfig {
  maxContextTokens: number;
  maxOutputTokens: number;
  warningThreshold: number;
  dangerThreshold: number;
  limitThreshold: number;
  outputReservedRatio: number;
  compactTriggerRatio: number;
  costPer1MIn?: number;
  costPer1MOut?: number;
}

/**
 * Token 使用报告，包含成本估算。
 * 对齐 OpenCode (Go) 的 TokenUsage 概念。
 */
export interface TokenUsageReport {
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Estimated USD cost based on model pricing */
  estimatedCostUSD: number;
  /** Cost per 1M input tokens used for calculation */
  costPer1MIn: number;
  /** Cost per 1M output tokens used for calculation */
  costPer1MOut: number;
}

export interface BudgetCheckResult {
  status: BudgetStatus;
  usedTokens: number;
  availableTokens: number;
  percentage: number;
  shouldCompact: boolean;
  shouldReject: boolean;
  tokensToWarning: number;
  tokensToLimit: number;
}

const DEFAULT_CONFIG: BudgetConfig = {
  maxContextTokens: 128000,
  maxOutputTokens: 40000,
  warningThreshold: 0.75,
  dangerThreshold: 0.85,
  limitThreshold: 0.95,
  outputReservedRatio: 0.25,
  compactTriggerRatio: 0.8,
};

export interface ToolTokenInput {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * 消息与工具的 token 估算。
 *
 * 底层复用 engine/token-counter 的 CJK 感知估算，
 * 避免同一仓库内维护两套各说各话的计量逻辑。
 */
export class TokenCalculator {
  /**
   * 估算消息 token 数。
   * @param messages 会话消息
   * @param tools 可选：随请求一同发送的工具定义。工具 schema 同样占用上下文，
   *              官方实现会将其单独计数（并扣除约 500 token 的 API 工具前言开销）。
   */
  calculateMessages(
    messages: InternalMessage[],
    tools?: ToolTokenInput[],
  ): number {
    let total = 0;
    for (const m of messages) {
      total += estimateContentTokens(m.content as never);
    }
    if (tools && tools.length > 0) {
      total += this.calculateTools(tools);
    }
    return total;
  }

  /**
   * 估算工具定义占用的 token。
   * 每个工具包含 name + description + input_schema 三部分，
   * 另加约 8 token 的 JSON 结构开销（字段名、括号、引号）。
   */
  calculateTools(tools: ToolTokenInput[]): number {
    let total = 0;
    for (const t of tools) {
      total += estimateTokensWithCjk(t.name);
      total += estimateTokensWithCjk(t.description ?? "");
      total += estimateTokensWithCjk(safeStringify(t.input_schema ?? {}));
      total += 8;
    }
    return total;
  }
}

export class TokenBudgetManager {
  private config: BudgetConfig;
  private calculator = new TokenCalculator();
  private inputTokens = 0;
  private outputTokens = 0;
  /**
   * 最近一次 API 响应返回的真实输入 token 数。
   * 用于校准本地估算——估算器只看消息文本，无法感知服务端的实际分词结果。
   * 为 0 表示尚无真实数据可用，此时完全依赖本地估算。
   */
  private lastApiInputTokens = 0;

  constructor(config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 实际可用于容纳「消息 + 工具定义」的 token 上限。
   * 已扣除为输出预留的部分，checkBudget 与 estimateAvailableOutput 共用此基准，
   * 避免两处算出互相矛盾的结论。
   */
  private getEffectiveLimit(): number {
    const outputReserved = Math.floor(
      this.config.maxContextTokens * this.config.outputReservedRatio,
    );
    return this.config.maxContextTokens - outputReserved;
  }

  /**
   * 估算当前上下文占用量。
   * 工具定义随请求一并发送、同样占据上下文，因此必须计入。
   * 若已有 API 真实用量且高于本地估算，以真实值为准（估算偏低的兜底）。
   */
  private estimateUsed(messages: InternalMessage[]): number {
    const tools = this.toolDefinitions;
    const estimated = this.calculator.calculateMessages(messages, tools);
    return Math.max(estimated, this.lastApiInputTokens);
  }

  /** 当前随请求发送的工具定义（由外部注入，用于 token 核算） */
  private toolDefinitions: ToolTokenInput[] = [];

  /** 注入工具定义，使 token 核算覆盖工具 schema */
  setToolDefinitions(tools: ToolTokenInput[]): void {
    this.toolDefinitions = tools ?? [];
  }

  /** 估算纯消息部分的 token（不含工具），用于诊断与对比 */
  estimateMessagesOnly(messages: InternalMessage[]): number {
    return this.calculator.calculateMessages(messages);
  }

  /** 估算工具定义部分的 token */
  estimateToolsOnly(): number {
    return this.calculator.calculateTools(this.toolDefinitions);
  }

  checkBudget(messages: InternalMessage[]): BudgetCheckResult {
    const usedTokens = this.estimateUsed(messages);
    const effectiveLimit = this.getEffectiveLimit();
    const availableTokens = effectiveLimit - usedTokens;
    const percentage = effectiveLimit > 0 ? usedTokens / effectiveLimit : 1;

    let status: BudgetStatus = "safe";
    if (percentage >= this.config.limitThreshold) status = "limit";
    else if (percentage >= this.config.dangerThreshold) status = "danger";
    else if (percentage >= this.config.warningThreshold) status = "warning";

    const result: BudgetCheckResult = {
      status,
      usedTokens,
      availableTokens,
      percentage,
      shouldCompact: percentage >= this.config.compactTriggerRatio,
      shouldReject: percentage >= this.config.limitThreshold,
      tokensToWarning: Math.max(0, Math.floor(effectiveLimit * this.config.warningThreshold) - usedTokens),
      tokensToLimit: Math.max(0, Math.floor(effectiveLimit * this.config.limitThreshold) - usedTokens),
    };
    return result;
  }

  /**
   * 记录 API 响应的真实 token 使用量，用于成本追踪与估算校准。
   * 对齐 OpenCode (Go) 的 TokenUsage 概念。
   */
  recordUsage(inputTokens: number, outputTokens: number): void {
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
    if (inputTokens > 0) {
      // 真实输入量包含系统提示、工具定义与全部历史消息，是比本地估算更可靠的基准
      this.lastApiInputTokens = inputTokens;
    }
  }

  /** 重置真实用量基准，用于会话重置或 /compact 后重新起算 */
  resetApiUsageBaseline(): void {
    this.lastApiInputTokens = 0;
  }

  /**
   * 获取增强的 token 使用报告，包含成本估算。
   * 对齐 OpenCode (Go) 的 TokenUsage 结构。
   */
  getUsage(): TokenUsageReport {
    const costIn = this.inputTokens * (this.config.costPer1MIn ?? 0) / 1_000_000;
    const costOut = this.outputTokens * (this.config.costPer1MOut ?? 0) / 1_000_000;
    return {
      totalInputTokens: this.inputTokens,
      totalOutputTokens: this.outputTokens,
      estimatedCostUSD: costIn + costOut,
      costPer1MIn: this.config.costPer1MIn ?? 0,
      costPer1MOut: this.config.costPer1MOut ?? 0,
    };
  }

  /**
   * 估算本次可用的输出 token 上限。
   * 与 checkBudget 共用 effectiveLimit 基准；上下文已满时返回 0，
   * 此时调用方应优先压缩而非继续生成。
   */
  estimateAvailableOutput(messages: InternalMessage[]): number {
    const used = this.estimateUsed(messages);
    const remaining = this.getEffectiveLimit() - used;
    if (remaining <= 0) return 0;
    return Math.min(remaining, this.config.maxOutputTokens);
  }

  updateConfig(newConfig: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}