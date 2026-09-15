/**
 * 账号请求趋势单测
 *
 * 回归背景：账号详情页的「7 天请求趋势」以前只读 app 日志，而成功请求的 app 日志
 * 是 debug 级别、默认 logLevel=info 会被丢掉 —— 于是「42 个请求、100% 成功率」
 * 的账号，图表永远空白。现在改为优先使用请求日志（带 accountId、不受日志级别影响）。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { RequestLogManager } from '../manager'
import type { RequestLogEntry } from '../../store/types'

let dir: string
let manager: RequestLogManager

function entry(over: Partial<RequestLogEntry>): Omit<RequestLogEntry, 'id'> {
  return {
    timestamp: Date.now(),
    status: 'success',
    statusCode: 200,
    method: 'POST',
    url: '/v1/chat/completions',
    model: 'step-3.7-flash',
    providerId: 'stepfun',
    providerName: 'StepFun',
    accountId: 'acc-1',
    accountName: 'StepFun',
    requestBody: '{}',
    responseStatus: 200,
    responseBody: '{}',
    latency: 146,
    isStream: true,
    ...over,
  } as Omit<RequestLogEntry, 'id'>
}

beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'kx2-reqtrend-'))
  manager = new RequestLogManager({ storageDir: dir, config: { enabled: true, maxEntries: 1000 } })
  await manager.initialize()
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('RequestLogManager.getAccountTrend', () => {
  it('全部成功的账号也能出趋势（回归：以前是空的）', () => {
    for (let i = 0; i < 42; i++) {
      manager.addRequestLog(entry({ accountId: 'acc-1', status: 'success', latency: 146 }))
    }
    const trend = manager.getAccountTrend('acc-1', 7)
    expect(trend).toHaveLength(7)
    expect(trend[6].total).toBe(42)   // 今天的 42 条
    expect(trend[6].info).toBe(42)    // 成功 → info
    expect(trend[6].error).toBe(0)
    expect(trend[6].warn).toBe(0)
    expect(trend.reduce((n, p) => n + p.total, 0)).toBe(42)
  })

  it('只统计该账号的请求', () => {
    manager.addRequestLog(entry({ accountId: 'acc-1' }))
    manager.addRequestLog(entry({ accountId: 'acc-1' }))
    manager.addRequestLog(entry({ accountId: 'acc-2' }))
    const t1 = manager.getAccountTrend('acc-1', 7)
    const t2 = manager.getAccountTrend('acc-2', 7)
    expect(t1[6].total).toBe(2)
    expect(t2[6].total).toBe(1)
    expect(manager.getAccountTrend('nobody', 7).reduce((n, p) => n + p.total, 0)).toBe(0)
  })

  it('失败请求计到 error', () => {
    manager.addRequestLog(entry({ accountId: 'acc-1', status: 'success' }))
    manager.addRequestLog(entry({ accountId: 'acc-1', status: 'error', statusCode: 500 }))
    const trend = manager.getAccountTrend('acc-1', 7)
    expect(trend[6].total).toBe(2)
    expect(trend[6].info).toBe(1)
    expect(trend[6].error).toBe(1)
  })

  it('按天分桶（昨天的请求不进今天的柱子）', () => {
    const dayMs = 24 * 60 * 60 * 1000
    manager.addRequestLog(entry({ accountId: 'acc-1', timestamp: Date.now() }))
    manager.addRequestLog(entry({ accountId: 'acc-1', timestamp: Date.now() - dayMs }))
    const trend = manager.getAccountTrend('acc-1', 7)
    expect(trend[6].total).toBe(1)  // 今天
    expect(trend[5].total).toBe(1)  // 昨天
    expect(trend[0].total).toBe(0)
  })

  it('超出天数范围的旧请求不计入', () => {
    const dayMs = 24 * 60 * 60 * 1000
    manager.addRequestLog(entry({ accountId: 'acc-1', timestamp: Date.now() - 30 * dayMs }))
    expect(manager.getAccountTrend('acc-1', 7).reduce((n, p) => n + p.total, 0)).toBe(0)
  })

  it('请求日志关闭时 getAccountTrend 返回空（由 store 层回退到 app 日志）', async () => {
    const dir2 = await fs.mkdtemp(join(tmpdir(), 'kx2-reqtrend-off-'))
    const off = new RequestLogManager({ storageDir: dir2, config: { enabled: false } })
    await off.initialize()
    off.addRequestLog(entry({ accountId: 'acc-1' }))
    expect(off.getAccountTrend('acc-1', 7).reduce((n, p) => n + p.total, 0)).toBe(0)
    await fs.rm(dir2, { recursive: true, force: true })
  })
})
