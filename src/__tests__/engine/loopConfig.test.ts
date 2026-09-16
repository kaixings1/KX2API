import { describe, it, expect } from 'vitest'
import {
  DEFAULT_AGENT_LOOP_CONFIG,
  resolveLoopConfig,
} from '../../engine/loopConfig'

describe('resolveLoopConfig', () => {
  it('未传配置时返回全部默认值', () => {
    expect(resolveLoopConfig()).toEqual(DEFAULT_AGENT_LOOP_CONFIG)
  })

  it('显式传入空值时返回全部默认值', () => {
    expect(resolveLoopConfig(null)).toEqual(DEFAULT_AGENT_LOOP_CONFIG)
  })

  it('部分字段覆盖，其余保持默认', () => {
    const r = resolveLoopConfig({ maxIterations: 42 })
    expect(r.maxIterations).toBe(42)
    expect(r.maxToolFailures).toBe(DEFAULT_AGENT_LOOP_CONFIG.maxToolFailures)
    expect(r.autoContinueDelayMs).toBe(
      DEFAULT_AGENT_LOOP_CONFIG.autoContinueDelayMs,
    )
  })

  it('全部字段均可覆盖', () => {
    const r = resolveLoopConfig({
      maxIterations: 10,
      maxInvalidToolCalls: 1,
      maxToolFailures: 2,
      maxConsecutiveMaxTokens: 4,
      toolLoopThreshold: 5,
      autoContinueMaxCount: 6,
      autoContinueDelayMs: 500,
    })
    expect(r).toEqual({
      maxIterations: 10,
      maxInvalidToolCalls: 1,
      maxToolFailures: 2,
      maxConsecutiveMaxTokens: 4,
      toolLoopThreshold: 5,
      autoContinueMaxCount: 6,
      autoContinueDelayMs: 500,
    })
  })

  it('非法值（0 / 负数 / NaN）回落到默认，避免循环失控', () => {
    const r = resolveLoopConfig({
      maxIterations: 0,
      maxToolFailures: -5,
      maxInvalidToolCalls: NaN,
    })
    expect(r.maxIterations).toBe(DEFAULT_AGENT_LOOP_CONFIG.maxIterations)
    expect(r.maxToolFailures).toBe(DEFAULT_AGENT_LOOP_CONFIG.maxToolFailures)
    expect(r.maxInvalidToolCalls).toBe(
      DEFAULT_AGENT_LOOP_CONFIG.maxInvalidToolCalls,
    )
  })

  it('无穷大回落到默认，避免永不终止', () => {
    const r = resolveLoopConfig({ maxIterations: Infinity })
    expect(r.maxIterations).toBe(DEFAULT_AGENT_LOOP_CONFIG.maxIterations)
  })

  it('小数被向下取整', () => {
    expect(resolveLoopConfig({ maxIterations: 12.9 }).maxIterations).toBe(12)
  })

  it('返回独立对象，修改结果不影响默认常量', () => {
    const r = resolveLoopConfig()
    r.maxIterations = 999
    expect(DEFAULT_AGENT_LOOP_CONFIG.maxIterations).not.toBe(999)
  })
})
