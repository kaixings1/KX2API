/**
 * engine/errors/recovery.ts — 错误恢复器（文档 02 §9.4）
 *
 * 依据错误类型尝试恢复引擎状态：重试/压缩/回滚/需要用户干预/崩溃。
 */
import { ErrorClassifier } from "./classifier.ts";
import { ErrorType, RateLimitError } from "./index.ts";
import { RetryHandler } from "./retryHandler.ts";
import type { AutoCompactor } from "../autoCompactor.ts";
import type { QueryStateMachine } from "../stateMachine.ts";

export interface RecoveryResult {
  success: boolean;
  action: "retry" | "continue" | "crash" | "needs_user" | "restart";
  message: string;
  requiresUserAction?: { type: string; prompt: string };
}

/**
 * 单个工具的熔断状态。
 *
 * 用途：某个工具连续失败到阈值后**短路**，不再反复重试 ——
 * 反复重试同一个必然失败的工具调用既浪费轮次也浪费额度，
 * 而且会掩盖真正的问题（模型看到"又失败了"会继续换参数重试）。
 */
export interface CircuitState {
  /** 连续失败次数 */
  consecutiveFailures: number
  /** 熔断是否打开（打开 = 该工具被短路） */
  open: boolean
  /** 最后一次失败时间 */
  lastFailureAt: number | null
}

/** 连续失败达到该次数即熔断 */
export const DEFAULT_CIRCUIT_THRESHOLD = 3
/** 熔断后冷却时长（毫秒），到期自动半开 */
export const DEFAULT_CIRCUIT_COOLDOWN_MS = 60_000

export class ErrorRecovery {
  /** toolName → 熔断状态 */
  private circuits = new Map<string, CircuitState>()

  constructor(
    private stateMachine: QueryStateMachine,
    private retryHandler: RetryHandler,
    private autoCompactor: AutoCompactor,
    private circuitThreshold: number = DEFAULT_CIRCUIT_THRESHOLD,
    private circuitCooldownMs: number = DEFAULT_CIRCUIT_COOLDOWN_MS,
  ) {}

  /**
   * 该工具的熔断是否已打开。
   *
   * 冷却期过后自动复位为半开（清除计数）—— 否则一个暂时性故障
   * 会让该工具在本会话内**永久不可用**。
   */
  isCircuitOpen(toolName: string): boolean {
    const c = this.circuits.get(toolName)
    if (!c) return false
    if (!c.open) return false

    // 冷却到期 → 自动复位
    if (c.lastFailureAt !== null && Date.now() - c.lastFailureAt >= this.circuitCooldownMs) {
      this.circuits.delete(toolName)
      return false
    }
    return true
  }

  /** 读取某个工具的熔断状态（未记录过时返回关闭态） */
  getCircuitState(toolName: string): CircuitState {
    return (
      this.circuits.get(toolName) ?? {
        consecutiveFailures: 0,
        open: false,
        lastFailureAt: null,
      }
    )
  }

  /**
   * 记录一次工具失败。
   *
   * 达到阈值即打开熔断。调用方（ToolScheduler）在工具失败后调用。
   */
  recordFailure(toolName: string): CircuitState {
    const prev = this.getCircuitState(toolName)
    const next: CircuitState = {
      consecutiveFailures: prev.consecutiveFailures + 1,
      open: prev.consecutiveFailures + 1 >= this.circuitThreshold,
      lastFailureAt: Date.now(),
    }
    this.circuits.set(toolName, next)
    if (next.open) {
      console.warn(
        `[ErrorRecovery] 工具 ${toolName} 连续失败 ${next.consecutiveFailures} 次，已熔断 ` +
          `（${Math.round(this.circuitCooldownMs / 1000)}s 后自动复位）`,
      )
    }
    return next
  }

  /** 记录一次工具成功：清除该工具的熔断计数 */
  recordSuccess(toolName: string): void {
    if (this.circuits.has(toolName)) this.circuits.delete(toolName)
  }

  /** 手动复位某个工具的熔断 */
  resetCircuit(toolName: string): void {
    this.circuits.delete(toolName)
  }

  /** 复位全部熔断 */
  resetAllCircuits(): void {
    this.circuits.clear()
  }

  /** 当前处于熔断状态的工具名（诊断用） */
  getOpenCircuits(): string[] {
    const out: string[] = []
    for (const name of this.circuits.keys()) {
      if (this.isCircuitOpen(name)) out.push(name)
    }
    return out
  }

  async recover(error: Error): Promise<RecoveryResult> {
    const type = ErrorClassifier.classify(error);
    switch (type) {
      case ErrorType.RATE_LIMIT:
        return this.fromRateLimit(error);
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT:
        return this.fromNetwork(error);
      case ErrorType.PROMPT_TOO_LONG:
        await this.autoCompactor.compactPlaceholder();
        return { success: true, action: "retry", message: "Compacted, retrying" };
      case ErrorType.AUTH_ERROR:
        return {
          success: false,
          action: "needs_user",
          message: "Authentication failed. Please run /login.",
          requiresUserAction: {
            type: "auth",
            prompt: "Your API key is invalid. Please run `/login` to authenticate.",
          },
        };
      case ErrorType.TOKEN_LIMIT_EXCEEDED:
        await this.autoCompactor.compactPlaceholder();
        return { success: true, action: "retry", message: "Compacted tokens, retrying" };
      case ErrorType.TOOL_EXECUTION_ERROR:
        return { success: true, action: "continue", message: "Tool failed, continuing" };
      case ErrorType.STATE_ERROR:
        this.stateMachine.reset();
        return { success: true, action: "restart", message: "状态机已重置" };
      default:
        return { success: false, action: "crash", message: `不可恢复的错误：${type}` };
    }
  }

  private async fromRateLimit(error: Error): Promise<RecoveryResult> {
    const wait = (error as RateLimitError).retryAfter ?? 60;
    console.warn(`Rate limited. Waiting ${wait}s...`);
    await new Promise((res) => setTimeout(res, wait * 1000));
    return { success: true, action: "retry", message: `Retrying after ${wait}s` };
  }

  private async fromNetwork(error: Error): Promise<RecoveryResult> {
    try {
      await this.retryHandler.retryWithBackoff(async () => true, error, 3);
      return { success: true, action: "retry", message: "Network recovered" };
    } catch {
      return { success: false, action: "crash", message: "Network unrecoverable" };
    }
  }
}