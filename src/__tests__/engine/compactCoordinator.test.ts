import { describe, it, expect, vi } from 'vitest'
import {
  computeThresholds,
  calculateTokenWarningState,
  CompactCircuitBreaker,
  CompactCoordinator,
  MAX_CONSECUTIVE_COMPACT_FAILURES,
  MAX_OUTPUT_TOKENS_FOR_SUMMARY,
  AUTOCOMPACT_BUFFER_TOKENS,
  MANUAL_COMPACT_BUFFER_TOKENS,
  FALLBACK_CONTEXT_WINDOW,
} from '../../engine/compactCoordinator'

/**
 * 熔断器守的是真实事故：上游记录过 1279 个会话连续压缩失败 50+ 次
 * （最高 3272 次），每天浪费约 25 万次 API 调用。
 * 失败循环 = 上下文超限 → 压缩 → 压缩请求本身因超长被拒 → 下一轮再试。
 */

describe('computeThresholds — 阈值模型', () => {
  it('按上游公式计算各档', () => {
    const t = computeThresholds(200_000, 40_000)
    // 预留 min(40000, 10000) = 10000
    expect(t.effectiveContextWindow).toBe(190_000)
    expect(t.autoCompactThreshold).toBe(190_000 - AUTOCOMPACT_BUFFER_TOKENS)
    expect(t.autoCompactThreshold).toBe(182_000)
  })

  it('硬闸高于自动压缩点（给压缩本身留空间）', () => {
    const t = computeThresholds(200_000, 40_000)
    expect(t.blockingLimit).toBeGreaterThan(t.autoCompactThreshold)
    expect(t.blockingLimit).toBe(190_000 - MANUAL_COMPACT_BUFFER_TOKENS)
  })

  it('各档单调递减：warning <= error <= autoCompact < blocking', () => {
    const t = computeThresholds(200_000, 40_000)
    expect(t.warningThreshold).toBeLessThanOrEqual(t.autoCompactThreshold)
    expect(t.autoCompactThreshold).toBeLessThan(t.blockingLimit)
  })

  it('输出上限低于摘要预留守额时按实际值扣', () => {
    const t = computeThresholds(200_000, 4_000)
    expect(t.effectiveContextWindow).toBe(196_000)
  })

  it('输出上限高于摘要预留守额时按 10000 扣', () => {
    const t = computeThresholds(200_000, 64_000)
    expect(t.effectiveContextWindow).toBe(200_000 - MAX_OUTPUT_TOKENS_FOR_SUMMARY)
  })

  it('窗口非法时用兜底值', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      const t = computeThresholds(bad, 4000)
      expect(t.contextWindow).toBe(FALLBACK_CONTEXT_WINDOW)
    }
  })

  it('极小窗口下各档仍为正数且不交叉', () => {
    const t = computeThresholds(5_000, 4_000)
    expect(t.autoCompactThreshold).toBeGreaterThan(0)
    expect(t.warningThreshold).toBeGreaterThan(0)
    expect(t.blockingLimit).toBeGreaterThanOrEqual(t.autoCompactThreshold)
  })

  it('输出上限为 0 或缺失时只扣摘要预留', () => {
    const t = computeThresholds(200_000, 0)
    expect(t.effectiveContextWindow).toBe(200_000)
  })
})

describe('calculateTokenWarningState', () => {
  const t = computeThresholds(200_000, 40_000)

  it('用量很低时各档都未命中', () => {
    const s = calculateTokenWarningState(10_000, t)
    expect(s.isAboveWarningThreshold).toBe(false)
    expect(s.isAboveAutoCompactThreshold).toBe(false)
    expect(s.isAtBlockingLimit).toBe(false)
    expect(s.percentLeft).toBeGreaterThan(50)
  })

  it('达到自动压缩点', () => {
    const s = calculateTokenWarningState(t.autoCompactThreshold, t)
    expect(s.isAboveAutoCompactThreshold).toBe(true)
    expect(s.isAboveWarningThreshold).toBe(true)
    expect(s.isAtBlockingLimit).toBe(false)
  })

  it('达到硬闸', () => {
    expect(calculateTokenWarningState(t.blockingLimit, t).isAtBlockingLimit).toBe(true)
  })

  it('用量超过阈值时 percentLeft 收敛为 0（不出现负数）', () => {
    expect(calculateTokenWarningState(t.blockingLimit * 2, t).percentLeft).toBe(0)
  })
})

describe('CompactCircuitBreaker', () => {
  it('默认上限为 3', () => {
    expect(MAX_CONSECUTIVE_COMPACT_FAILURES).toBe(3)
  })

  it('连续失败达上限才熔断', () => {
    const b = new CompactCircuitBreaker()
    expect(b.isOpen).toBe(false)
    b.recordFailure()
    expect(b.isOpen).toBe(false)
    b.recordFailure()
    expect(b.isOpen).toBe(false)
    b.recordFailure()
    expect(b.isOpen).toBe(true)
  })

  it('成功会重置计数（偶发失败不该累积）', () => {
    const b = new CompactCircuitBreaker()
    b.recordFailure()
    b.recordFailure()
    b.recordSuccess()
    expect(b.consecutiveFailures).toBe(0)
    expect(b.isOpen).toBe(false)
    b.recordFailure()
    b.recordFailure()
    expect(b.isOpen).toBe(false)
  })

  it('reset 可手动复位', () => {
    const b = new CompactCircuitBreaker(1)
    b.recordFailure()
    expect(b.isOpen).toBe(true)
    b.reset()
    expect(b.isOpen).toBe(false)
  })

  it('可配置上限', () => {
    const b = new CompactCircuitBreaker(1)
    b.recordFailure()
    expect(b.isOpen).toBe(true)
  })
})

describe('CompactCoordinator — 决策', () => {
  const mk = () => new CompactCoordinator(200_000, 40_000)

  it('未达阈值时不压缩', () => {
    const c = mk()
    const r = c.shouldCompact(10_000)
    expect(r.should).toBe(false)
    expect(r.reason).toContain('未达')
  })

  it('达到阈值时压缩', () => {
    const c = mk()
    expect(c.shouldCompact(c.getThresholds().autoCompactThreshold).should).toBe(true)
  })

  it('熔断后即使超阈值也不再压缩', () => {
    const c = mk()
    const t = c.getThresholds()
    c.resetCircuit()
    for (let i = 0; i < MAX_CONSECUTIVE_COMPACT_FAILURES; i++) {
      // 直接驱动熔断
      const breaker = (c as unknown as { breaker: CompactCircuitBreaker }).breaker
      breaker.recordFailure()
    }
    const r = c.shouldCompact(t.blockingLimit + 1000)
    expect(r.should).toBe(false)
    expect(r.reason).toContain('熔断')
  })

  it('isAtBlockingLimit 反映硬闸', () => {
    const c = mk()
    const t = c.getThresholds()
    expect(c.isAtBlockingLimit(t.blockingLimit - 1)).toBe(false)
    expect(c.isAtBlockingLimit(t.blockingLimit)).toBe(true)
  })

  it('updateModel 重算阈值但保留熔断状态', () => {
    const c = mk()
    const breaker = (c as unknown as { breaker: CompactCircuitBreaker }).breaker
    breaker.recordFailure()
    c.updateModel(100_000, 8_000)
    expect(c.getThresholds().contextWindow).toBe(100_000)
    expect(c.getCircuitState().consecutiveFailures).toBe(1)
  })
})

describe('CompactCoordinator.runCompact — 成效判定', () => {
  /**
   * 脚手架：token 用量是可变状态，由压缩动作本身修改。
   * 这样 measure() 是纯读取、无副作用 —— 与真实调用方的语义一致
   * （真实场景里 measure 只是走一遍消息算 token，不会自己变）。
   */
  const mk = (initial = 190_000) => {
    const c = new CompactCoordinator(200_000, 40_000)
    let tokens = initial
    return {
      c,
      measure: () => tokens,
      setTokens: (v: number) => {
        tokens = v
      },
    }
  }

  it('token 下降才算成功', async () => {
    const { c, measure, setTokens } = mk()
    const r = await c.runCompact(async () => {
      setTokens(100_000)
      return 'ok'
    }, measure)
    expect(r.outcome.attempted).toBe(true)
    expect(r.outcome.succeeded).toBe(true)
    expect(c.getCircuitState().consecutiveFailures).toBe(0)
  })

  it('token 未下降判定为无效压缩并记一次失败', async () => {
    const { c, measure } = mk()
    const r = await c.runCompact(async () => 'ok', measure)
    expect(r.outcome.attempted).toBe(true)
    expect(r.outcome.succeeded).toBe(false)
    expect(r.outcome.reason).toContain('未下降')
    expect(c.getCircuitState().consecutiveFailures).toBe(1)
  })

  it('token 反而上升也算失败', async () => {
    const { c, measure, setTokens } = mk()
    const r = await c.runCompact(async () => {
      setTokens(200_000)
      return 'ok'
    }, measure)
    expect(r.outcome.succeeded).toBe(false)
  })

  it('压缩抛错记为失败并回传错误', async () => {
    const { c, measure } = mk()
    const r = await c.runCompact(async () => {
      throw new Error('prompt_too_long')
    }, measure)
    expect(r.outcome.succeeded).toBe(false)
    expect(r.outcome.reason).toContain('prompt_too_long')
    expect(r.error).toBeInstanceOf(Error)
    expect(c.getCircuitState().consecutiveFailures).toBe(1)
  })

  it('未达阈值时不执行（fn 不被调用）', async () => {
    const { c } = mk(10_000)
    const fn = vi.fn(async () => 'ok')
    const r = await c.runCompact(fn, () => 10_000)
    expect(r.outcome.attempted).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })

  it('连续失败达上限后熔断，后续不再尝试', async () => {
    const c = new CompactCoordinator(200_000, 40_000)
    let tokens = 190_000
    const measure = () => tokens

    for (let i = 0; i < MAX_CONSECUTIVE_COMPACT_FAILURES; i++) {
      await c.runCompact(async () => {
        throw new Error('prompt_too_long')
      }, measure)
    }
    expect(c.getCircuitState().open).toBe(true)

    const fn = vi.fn(async () => 'ok')
    const r = await c.runCompact(fn, measure)
    expect(r.outcome.attempted).toBe(false)
    expect(r.outcome.reason).toContain('熔断')
    expect(fn).not.toHaveBeenCalled()
  })

  it('失败循环被熔断打断（模拟上游记录的事故场景）', async () => {
    const c = new CompactCoordinator(200_000, 40_000)
    const measure = () => 190_000 // 上下文永远超限，压缩永远失败
    let attempts = 0

    for (let round = 0; round < 100; round++) {
      const r = await c.runCompact(async () => {
        attempts++
        throw new Error('prompt_too_long')
      }, measure)
      if (!r.outcome.attempted) break
    }

    // 关键：不会跑满 100 轮，最多尝试 MAX_CONSECUTIVE 次
    expect(attempts).toBe(MAX_CONSECUTIVE_COMPACT_FAILURES)
  })

  it('成功一次后熔断计数清零', async () => {
    const c = new CompactCoordinator(200_000, 40_000)
    let tokens = 190_000
    const measure = () => tokens

    await c.runCompact(async () => { throw new Error('x') }, measure)
    expect(c.getCircuitState().consecutiveFailures).toBe(1)

    tokens = 50_000
    await c.runCompact(async () => 'ok', measure)
    expect(c.getCircuitState().consecutiveFailures).toBe(0)
  })

  it('返回结果中带上压缩前后的 token 数（便于观测）', async () => {
    const { c, measure, setTokens } = mk(190_000)
    const r = await c.runCompact(async () => {
      setTokens(120_000)
      return 'ok'
    }, measure)
    expect(r.outcome.beforeTokens).toBe(190_000)
    expect(r.outcome.afterTokens).toBe(120_000)
  })
})
