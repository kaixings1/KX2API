import { describe, it, expect } from 'vitest'
import {
  LoadBalancer,
  DEFAULT_FAIL_THRESHOLD,
  DEFAULT_RECOVERY_TIME_MS,
} from '../../main/proxy/loadbalancer'

/**
 * 熔断参数此前硬编码为类常量，现支持构造注入与运行时更新。
 * 这些用例锁定「默认值不变 + 非法值回落 + 热更新生效」三项契约。
 */
describe('LoadBalancer 熔断参数', () => {
  const accountId = 'acc-1'

  /** 连续标记失败 n 次 */
  const failTimes = (lb: LoadBalancer, n: number) => {
    for (let i = 0; i < n; i++) lb.markAccountFailed(accountId)
  }

  /** 绕过 private 读取熔断判定结果 */
  const isInFailure = (lb: LoadBalancer) =>
    (lb as unknown as { isAccountInFailure: (id: string) => boolean })
      .isAccountInFailure(accountId)

  it('未传参数时使用默认阈值', () => {
    const lb = new LoadBalancer()
    failTimes(lb, DEFAULT_FAIL_THRESHOLD - 1)
    expect(isInFailure(lb)).toBe(false)
    failTimes(lb, 1)
    expect(isInFailure(lb)).toBe(true)
  })

  it('自定义阈值立即生效', () => {
    const lb = new LoadBalancer({ failThreshold: 1 })
    expect(isInFailure(lb)).toBe(false)
    failTimes(lb, 1)
    expect(isInFailure(lb)).toBe(true)
  })

  it('阈值调大后需要更多失败次数才摘除', () => {
    const lb = new LoadBalancer({ failThreshold: 5 })
    failTimes(lb, 4)
    expect(isInFailure(lb)).toBe(false)
    failTimes(lb, 1)
    expect(isInFailure(lb)).toBe(true)
  })

  it('非法阈值回落到默认', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      const lb = new LoadBalancer({ failThreshold: bad })
      failTimes(lb, DEFAULT_FAIL_THRESHOLD - 1)
      expect(isInFailure(lb)).toBe(false)
    }
  })

  it('恢复时间未到时保持摘除状态', () => {
    const lb = new LoadBalancer({ failThreshold: 1, recoveryTimeMs: 60_000 })
    failTimes(lb, 1)
    expect(isInFailure(lb)).toBe(true)
  })

  it('恢复时间过后自动重新可用', () => {
    // 恢复时间设为最小值 1ms，等待后应自动清除失败状态
    const lb = new LoadBalancer({ failThreshold: 1, recoveryTimeMs: 1 })
    failTimes(lb, 1)
    const start = Date.now()
    while (Date.now() - start < 5) {
      /* 等待超过恢复时间 */
    }
    expect(isInFailure(lb)).toBe(false)
  })

  it('updateOptions 可运行时修改阈值', () => {
    const lb = new LoadBalancer({ failThreshold: 10 })
    failTimes(lb, 3)
    expect(isInFailure(lb)).toBe(false)
    lb.updateOptions({ failThreshold: 2 })
    expect(isInFailure(lb)).toBe(true)
  })

  it('updateOptions 忽略非法值，保留原设置', () => {
    const lb = new LoadBalancer({ failThreshold: 2 })
    lb.updateOptions({ failThreshold: 0 })
    failTimes(lb, 2)
    expect(isInFailure(lb)).toBe(true)
  })

  it('clearAccountFailure 立即清除失败计数', () => {
    const lb = new LoadBalancer({ failThreshold: 1 })
    failTimes(lb, 1)
    expect(isInFailure(lb)).toBe(true)
    lb.clearAccountFailure(accountId)
    expect(isInFailure(lb)).toBe(false)
  })

  it('默认值与改造前保持一致', () => {
    expect(DEFAULT_FAIL_THRESHOLD).toBe(3)
    expect(DEFAULT_RECOVERY_TIME_MS).toBe(60_000)
  })
})
