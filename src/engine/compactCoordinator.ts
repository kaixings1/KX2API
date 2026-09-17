/**
 * engine/compactCoordinator.ts — 上下文压缩的阈值决策与熔断
 *
 * 移植自 D:\src\services\compact\autoCompact.ts 的阈值模型与熔断器。
 *
 * ─────────────────────────────────────────────────────────────
 * 为什么需要熔断器（这不是防御性编程，是真实事故）
 * ─────────────────────────────────────────────────────────────
 * 上游的注释记录了一组生产数据：**1279 个会话曾连续自动压缩失败 50 次以上
 * （最高 3272 次）**，全球每天因此浪费约 25 万次 API 调用。
 *
 * 失败循环长这样：上下文已超阈值 → 触发压缩 → 压缩请求本身因上下文过长
 * 而被拒（prompt_too_long）→ 压缩失败 → 下一轮还是超阈值 → 再试……
 * 上下文不会自己变小，于是永远卡在这个循环里。
 *
 * 熔断器的作用是：连续失败 N 次后**放弃自动压缩**，让对话以"超限"状态
 * 继续下去（可能触发模型侧报错，但至少不再烧 API 调用）。
 *
 * ─────────────────────────────────────────────────────────────
 * 阈值模型（绝对值，不是比例）
 * ─────────────────────────────────────────────────────────────
 * ```
 * effectiveContextWindow = contextWindow - min(maxOutputTokens, 10_000)
 * autoCompactThreshold   = effectiveContextWindow - 8_000
 * warningThreshold       = autoCompactThreshold - 10_000
 * blockingLimit          = effectiveContextWindow - 3_000   ← 真正的硬闸
 * ```
 * 注意 `blockingLimit` **高于** `autoCompactThreshold` —— 中间留出的空间
 * 是给压缩本身用的（压缩要发一次请求，也要占 token）。若两者相等，
 * 会出现"该压缩了但已经发不出压缩请求"的死结。
 */

/** 压缩摘要的预留输出量（上游取 p99.99 的 17_387 与 10_000 的较小值） */
export const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 10_000

/** 自动压缩触发点与有效窗口之间的缓冲 */
export const AUTOCOMPACT_BUFFER_TOKENS = 8_000

/** 警告阈值与自动压缩阈值的间距 */
export const WARNING_THRESHOLD_BUFFER_TOKENS = 10_000

/** 错误阈值与自动压缩阈值的间距 */
export const ERROR_THRESHOLD_BUFFER_TOKENS = 10_000

/** 硬闸与有效窗口的间距（比自动压缩阈值更靠后，给压缩本身留空间） */
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000

/**
 * 连续压缩失败多少次后熔断。
 * 取 3 是上游的选择：既能容忍偶发抖动，又不会让失败循环持续烧调用。
 */
export const MAX_CONSECUTIVE_COMPACT_FAILURES = 3

export interface CompactThresholds {
  /** 模型上下文窗口 */
  contextWindow: number
  /** 模型最大输出 */
  maxOutputTokens: number
  /** 扣除摘要预留后的有效窗口 */
  effectiveContextWindow: number
  /** 自动压缩触发点 */
  autoCompactThreshold: number
  /** 提示警告点 */
  warningThreshold: number
  /** 提示错误点 */
  errorThreshold: number
  /** 硬闸：达到即拒绝发起请求 */
  blockingLimit: number
}

/** 上下文窗口的安全兜底（模型信息缺失时用） */
export const FALLBACK_CONTEXT_WINDOW = 128_000

/**
 * 计算各档阈值。
 *
 * @param contextWindow   模型上下文窗口；非正数时用兜底值
 * @param maxOutputTokens 模型最大输出；非正数时视为 0
 */
export function computeThresholds(
  contextWindow: number,
  maxOutputTokens: number,
): CompactThresholds {
  const cw = Number.isFinite(contextWindow) && contextWindow > 0 ? contextWindow : FALLBACK_CONTEXT_WINDOW
  const mo = Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? maxOutputTokens : 0

  const reserved = Math.min(mo, MAX_OUTPUT_TOKENS_FOR_SUMMARY)
  const effective = Math.max(1, cw - reserved)

  // 窗口很小时（例如用户手动设了很小的窗口），各档必须保持单调递减，
  // 否则会出现 warning > autoCompact 这类反直觉状态。
  const autoCompact = Math.max(1, effective - AUTOCOMPACT_BUFFER_TOKENS)
  const warning = Math.max(1, autoCompact - WARNING_THRESHOLD_BUFFER_TOKENS)
  const error = Math.max(1, autoCompact - ERROR_THRESHOLD_BUFFER_TOKENS)
  const blocking = Math.max(1, effective - MANUAL_COMPACT_BUFFER_TOKENS)

  return {
    contextWindow: cw,
    maxOutputTokens: mo,
    effectiveContextWindow: effective,
    autoCompactThreshold: autoCompact,
    warningThreshold: warning,
    errorThreshold: error,
    // 硬闸不能低于自动压缩点，否则会"该压却压不了"
    blockingLimit: Math.max(blocking, autoCompact),
  }
}

export interface TokenWarningState {
  /** 剩余百分比（相对自动压缩阈值） */
  percentLeft: number
  isAboveWarningThreshold: boolean
  isAboveErrorThreshold: boolean
  isAboveAutoCompactThreshold: boolean
  isAtBlockingLimit: boolean
}

/** 根据当前用量算出各档命中状态（供 UI 提示与自动触发共用同一口径） */
export function calculateTokenWarningState(
  usedTokens: number,
  t: CompactThresholds,
): TokenWarningState {
  const threshold = t.autoCompactThreshold
  const percentLeft = Math.max(0, Math.round(((threshold - usedTokens) / threshold) * 100))
  return {
    percentLeft,
    isAboveWarningThreshold: usedTokens >= t.warningThreshold,
    isAboveErrorThreshold: usedTokens >= t.errorThreshold,
    isAboveAutoCompactThreshold: usedTokens >= t.autoCompactThreshold,
    isAtBlockingLimit: usedTokens >= t.blockingLimit,
  }
}

/**
 * 压缩熔断器。
 *
 * 连续失败达到上限后 `isOpen` 为 true，调用方应停止尝试自动压缩。
 * 任何一次成功都会重置计数 —— 偶发失败不该累积成熔断。
 */
export class CompactCircuitBreaker {
  private failures = 0
  private opened = false

  constructor(private maxFailures: number = MAX_CONSECUTIVE_COMPACT_FAILURES) {}

  /** 是否已熔断（应停止自动压缩） */
  get isOpen(): boolean {
    return this.opened
  }

  get consecutiveFailures(): number {
    return this.failures
  }

  recordSuccess(): void {
    this.failures = 0
    this.opened = false
  }

  /** 记录一次失败；达到上限则熔断 */
  recordFailure(): void {
    this.failures++
    if (this.failures >= this.maxFailures) this.opened = true
  }

  /** 手动复位（用户手动触发压缩、或会话清空时） */
  reset(): void {
    this.failures = 0
    this.opened = false
  }
}

export interface CompactOutcome {
  /** 是否真的尝试了压缩 */
  attempted: boolean
  /** 压缩是否有效（token 确实下降） */
  succeeded: boolean
  beforeTokens: number
  afterTokens: number
  /** 未尝试或失败的原因 */
  reason?: string
}

export interface ShouldCompactResult {
  should: boolean
  reason?: string
}

/**
 * 压缩协调器：统一决策「该不该压」+ 记录成败 + 熔断。
 *
 * 把「判断」与「执行」分开，是为了让调用方（messageLoop）只需要问一次
 * `shouldCompact()`，执行后把结果交给 `recordOutcome()` —— 熔断状态因此
 * 集中在一处维护，不会散落在调用点。
 */
export class CompactCoordinator {
  private breaker: CompactCircuitBreaker
  private thresholds: CompactThresholds

  constructor(
    contextWindow: number,
    maxOutputTokens: number,
    maxFailures: number = MAX_CONSECUTIVE_COMPACT_FAILURES,
  ) {
    this.thresholds = computeThresholds(contextWindow, maxOutputTokens)
    this.breaker = new CompactCircuitBreaker(maxFailures)
  }

  getThresholds(): CompactThresholds {
    return { ...this.thresholds }
  }

  getWarningState(usedTokens: number): TokenWarningState {
    return calculateTokenWarningState(usedTokens, this.thresholds)
  }

  /** 熔断器状态（诊断用） */
  getCircuitState(): { open: boolean; consecutiveFailures: number } {
    return { open: this.breaker.isOpen, consecutiveFailures: this.breaker.consecutiveFailures }
  }

  /** 更新模型（窗口/输出上限变化时重算阈值；熔断状态保留） */
  updateModel(contextWindow: number, maxOutputTokens: number): void {
    this.thresholds = computeThresholds(contextWindow, maxOutputTokens)
  }

  shouldCompact(usedTokens: number): ShouldCompactResult {
    if (usedTokens < this.thresholds.autoCompactThreshold) {
      // 上下文已回落到阈值以下 → 之前失败的具体情境不复存在，计数清零、熔断解除。
      //
      // 这一步是必需的：本实例生命周期跨越整个会话，若不复位，
      // 用户手动清空对话后仍会带着旧的失败计数/熔断状态，
      // 永久失去（或提前耗尽）自动压缩能力。
      //
      // 注意条件是「计数 > 0」而非「已熔断」—— 未达上限的失败计数同样是
      // 陈旧状态，会与新的失败叠加导致过早熔断。
      if (this.breaker.consecutiveFailures > 0) {
        this.breaker.reset()
        console.log('[Compact] 上下文已回落至阈值以下，压缩失败计数已清零')
      }
      return { should: false, reason: '未达压缩阈值' }
    }
    if (this.breaker.isOpen) {
      return {
        should: false,
        reason: `压缩已熔断（连续失败 ${this.breaker.consecutiveFailures} 次）`,
      }
    }
    return { should: true }
  }

  /**
   * 判断是否必须拒绝继续（硬闸）。
   *
   * 注意：调用方应先尝试压缩，只有压缩失败/熔断后才该用这个结论中断。
   * 直接拿它拒绝会让"上下文刚好超一点"的对话失去自愈机会。
   */
  isAtBlockingLimit(usedTokens: number): boolean {
    return usedTokens >= this.thresholds.blockingLimit
  }

  /**
   * 包裹一次压缩执行，自动判定成效并驱动熔断器。
   *
   * **有效性判据是 token 真的下降了**，而不是"函数没抛异常"。
   * 压缩策略可能返回一个长度几乎没变的消息数组（例如可压缩的内容本就很少），
   * 那属于无效压缩 —— 若不识别出来，下一轮还会重复做同样的无用功。
   *
   * @param measureTokens 测量当前 token 用量的回调（压缩前后各调一次）
   */
  async runCompact<T>(
    fn: () => Promise<T>,
    measureTokens: () => number,
  ): Promise<{ outcome: CompactOutcome; value?: T; error?: unknown }> {
    // 只测一次并复用于判断 —— 测量本身有成本（要遍历消息算 token），
    // 且多次测量之间消息可能变化，会得到自相矛盾的 before 值。
    const before = measureTokens()
    const allowed = this.shouldCompact(before)
    if (!allowed.should) {
      return {
        outcome: {
          attempted: false,
          succeeded: false,
          beforeTokens: before,
          afterTokens: before,
          reason: allowed.reason,
        },
      }
    }

    try {
      const value = await fn()
      const after = measureTokens()
      const succeeded = after < before

      if (succeeded) {
        this.breaker.recordSuccess()
      } else {
        this.breaker.recordFailure()
      }

      return {
        outcome: {
          attempted: true,
          succeeded,
          beforeTokens: before,
          afterTokens: after,
          reason: succeeded ? undefined : '压缩后 token 未下降（无效压缩）',
        },
        value,
      }
    } catch (e) {
      this.breaker.recordFailure()
      return {
        outcome: {
          attempted: true,
          succeeded: false,
          beforeTokens: before,
          afterTokens: measureTokens(),
          reason: `压缩抛错: ${(e as Error)?.message ?? String(e)}`,
        },
        error: e,
      }
    }
  }

  /** 复位熔断（用户手动压缩、切换会话时调用） */
  resetCircuit(): void {
    this.breaker.reset()
  }
}
