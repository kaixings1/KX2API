import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ErrorRecovery,
  DEFAULT_CIRCUIT_THRESHOLD,
  DEFAULT_CIRCUIT_COOLDOWN_MS,
} from '../../engine/errors/recovery'

/**
 * 类型错误的排查中发现两处「接口与实现脱节」的**必崩调用**：
 *
 * 1. `QueryEngine.pause()/resume()/isPaused()` 转发到 `messageLoop` 的同名方法，
 *    而 `MessageLoop` **从未实现过它们** —— 用户一按暂停就是
 *    `this.messageLoop.pause is not a function`
 * 2. `QueryEngine.isCircuitOpen/getCircuitState/resetCircuit/resetAllCircuits`
 *    转发到 `ErrorRecovery`，同样未实现
 *
 * 这两条链路都有 IPC 通道（chat:pause / chat:resume / chat:getState），
 * 前端可以触发，属真实功能缺陷。
 *
 * 本文件覆盖 ErrorRecovery 的熔断器（MessageLoop 的暂停需要构造完整 deps，
 * 逻辑更重，其行为由 messageLoop 相关测试覆盖）。
 */
describe('ErrorRecovery 熔断器', () => {
  const makeRecovery = (threshold?: number, cooldownMs?: number) =>
    new ErrorRecovery({} as never, {} as never, {} as never, threshold, cooldownMs)

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('默认阈值与冷却时长为常量值', () => {
    expect(DEFAULT_CIRCUIT_THRESHOLD).toBe(3)
    expect(DEFAULT_CIRCUIT_COOLDOWN_MS).toBe(60_000)
  })

  it('未记录过失败时熔断是关闭的', () => {
    const r = makeRecovery()
    expect(r.isCircuitOpen('Read')).toBe(false)
    expect(r.getCircuitState('Read').consecutiveFailures).toBe(0)
  })

  it('连续失败达到阈值即打开熔断', () => {
    const r = makeRecovery(3)
    r.recordFailure('Read')
    r.recordFailure('Read')
    expect(r.isCircuitOpen('Read')).toBe(false) // 还没到 3 次
    r.recordFailure('Read')
    expect(r.isCircuitOpen('Read')).toBe(true)
  })

  it('失败计数按工具名隔离', () => {
    const r = makeRecovery(2)
    r.recordFailure('Read')
    r.recordFailure('Write')
    // 各自只失败一次，都不该熔断
    expect(r.isCircuitOpen('Read')).toBe(false)
    expect(r.isCircuitOpen('Write')).toBe(false)
    r.recordFailure('Read')
    expect(r.isCircuitOpen('Read')).toBe(true)
    expect(r.isCircuitOpen('Write')).toBe(false)
  })

  it('成功后清除该工具的失败计数', () => {
    const r = makeRecovery(3)
    r.recordFailure('Read')
    r.recordFailure('Read')
    r.recordSuccess('Read')
    expect(r.getCircuitState('Read').consecutiveFailures).toBe(0)
    r.recordFailure('Read')
    r.recordFailure('Read')
    expect(r.isCircuitOpen('Read')).toBe(false)
  })

  it('resetCircuit 只复位指定工具', () => {
    const r = makeRecovery(1)
    r.recordFailure('Read')
    r.recordFailure('Write')
    expect(r.isCircuitOpen('Read')).toBe(true)
    r.resetCircuit('Read')
    expect(r.isCircuitOpen('Read')).toBe(false)
    expect(r.isCircuitOpen('Write')).toBe(true)
  })

  it('resetAllCircuits 清零全部', () => {
    const r = makeRecovery(1)
    r.recordFailure('Read')
    r.recordFailure('Write')
    r.resetAllCircuits()
    expect(r.getOpenCircuits()).toEqual([])
  })

  it('冷却期过后自动复位 —— 否则暂时性故障会让工具永久不可用', () => {
    // 冷却设为 0，下一次查询即视为已过冷却
    const r = makeRecovery(1, 0)
    r.recordFailure('Read')
    expect(r.isCircuitOpen('Read')).toBe(false) // 冷却已过 → 自动复位
  })

  it('冷却期未过时保持打开', () => {
    const r = makeRecovery(1, 60_000)
    r.recordFailure('Read')
    expect(r.isCircuitOpen('Read')).toBe(true)
  })

  it('getOpenCircuits 列出当前熔断的工具', () => {
    const r = makeRecovery(1)
    r.recordFailure('Read')
    r.recordFailure('Write')
    expect(r.getOpenCircuits().sort()).toEqual(['Read', 'Write'])
  })

  it('getCircuitState 返回未记录工具的默认关闭态', () => {
    const r = makeRecovery()
    const s = r.getCircuitState('NeverSeen')
    expect(s).toEqual({ consecutiveFailures: 0, open: false, lastFailureAt: null })
  })
})
