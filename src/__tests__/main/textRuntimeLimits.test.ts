import { describe, it, expect, afterEach, vi } from 'vitest'
// 注意：security 已合并为 src/security/ 单一目录（原 src/main/security/ 副本已随项 3 删除）。
// 单测统一从 src/security 导入活跃实现。
import {
  DEFAULT_AUDIT_BUFFER_SIZE,
  DEFAULT_AUDIT_FLUSH_INTERVAL_MS,
} from '../../security/AuditLogger'
import { DEFAULT_MAX_CONCURRENT_AGENTS } from '../../engine/subagent/subAgentManager'
import {
  getRecentMessageWindow,
  setRecentMessageWindow,
  DEFAULT_RECENT_MESSAGE_WINDOW,
} from '../../engine/services/awaySummary'

/**
 * 审计落盘策略与子代理并发此前都是硬编码，现可运行时调整。
 */

describe('审计日志落盘策略', () => {
  it('默认值与改造前一致', () => {
    expect(DEFAULT_AUDIT_BUFFER_SIZE).toBe(100)
    expect(DEFAULT_AUDIT_FLUSH_INTERVAL_MS).toBe(10_000)
  })

  it('可通过构造参数注入', async () => {
    const { AuditLogger } = await import('../../security/AuditLogger')
    const logger = new AuditLogger('/tmp/kx2-audit-test.log', {
      maxBufferSize: 5,
      flushIntervalMs: 60000,
    })
    expect(logger.getLimits()).toEqual({ maxBufferSize: 5, flushIntervalMs: 60000 })
    logger.stop()
  })

  it('setLimits 忽略非法值', async () => {
    const { AuditLogger } = await import('../../security/AuditLogger')
    const logger = new AuditLogger('/tmp/kx2-audit-test2.log', { maxBufferSize: 7 })
    logger.setLimits({ maxBufferSize: 0, flushIntervalMs: -5 })
    const limits = logger.getLimits()
    expect(limits.maxBufferSize).toBe(7)
    expect(limits.flushIntervalMs).toBe(DEFAULT_AUDIT_FLUSH_INTERVAL_MS)
    logger.stop()
  })
})

describe('子代理并发上限', () => {
  it('默认值为 5', () => {
    expect(DEFAULT_MAX_CONCURRENT_AGENTS).toBe(5)
  })

  it('构造时可注入，且非法值回落到默认', async () => {
    const { SubAgentManager } = await import('../../engine/subagent/subAgentManager')
    expect(new SubAgentManager().getConcurrencyInfo().max).toBe(5)
    expect(new SubAgentManager(12).getConcurrencyInfo().max).toBe(12)
    expect(new SubAgentManager(0).getConcurrencyInfo().max).toBe(5)
    expect(new SubAgentManager(-1).getConcurrencyInfo().max).toBe(5)
  })

  it('运行时可更新并发上限', async () => {
    const { SubAgentManager } = await import('../../engine/subagent/subAgentManager')
    const m = new SubAgentManager()
    m.setMaxConcurrentAgents(3)
    expect(m.getConcurrencyInfo().max).toBe(3)
    // 非法值不改变既有设置
    m.setMaxConcurrentAgents(0)
    expect(m.getConcurrencyInfo().max).toBe(3)
  })
})

describe('离开摘要窗口', () => {
  afterEach(() => setRecentMessageWindow(DEFAULT_RECENT_MESSAGE_WINDOW))

  it('默认 30 条', () => {
    expect(getRecentMessageWindow()).toBe(30)
  })

  it('可调整，非法值忽略', () => {
    setRecentMessageWindow(50)
    expect(getRecentMessageWindow()).toBe(50)
    setRecentMessageWindow(0)
    expect(getRecentMessageWindow()).toBe(50)
    setRecentMessageWindow(NaN)
    expect(getRecentMessageWindow()).toBe(50)
  })
})
