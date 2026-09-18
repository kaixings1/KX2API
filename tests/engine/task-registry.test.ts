/**
 * engine/tasks 任务注册表测试
 *
 * 覆盖 register/updateStatus/reportProgress/cancel/cleanupTerminal 等。
 * 含真实缺陷回归：
 *   1. cancel 后仍可被 updateStatus 改回 running（终态无保护，任务会"复活"）
 *   2. getState 返回内部状态引用（外部可篡改），与 getAllTasks 的副本策略不一致
 *   3. 终态判断硬编码数组，未复用 types.isTerminalTaskStatus
 *
 * 运行：node --import tsx --test tests/engine/task-registry.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { taskRegistry, getAllTasks, getTaskByType } from '../../src/engine/tasks/taskRegistry.ts'
import { isTerminalTaskStatus, createTaskStateBase } from '../../src/engine/tasks/types.ts'

describe('types — 终态判定', () => {
  test('completed/failed/cancelled 是终态', () => {
    assert.equal(isTerminalTaskStatus('completed'), true)
    assert.equal(isTerminalTaskStatus('failed'), true)
    assert.equal(isTerminalTaskStatus('cancelled'), true)
  })

  test('pending/running/blocked 非终态', () => {
    assert.equal(isTerminalTaskStatus('pending'), false)
    assert.equal(isTerminalTaskStatus('running'), false)
    assert.equal(isTerminalTaskStatus('blocked'), false)
  })

  test('createTaskStateBase 初始为 pending 且带元数据', () => {
    const s = createTaskStateBase('shell', { cmd: 'ls' })
    assert.equal(s.status, 'pending')
    assert.equal(s.type, 'shell')
    assert.deepEqual(s.metadata, { cmd: 'ls' })
    assert.ok(s.createdAt > 0 && s.id.startsWith('shell_'))
  })
})

describe('taskRegistry — 生命周期', () => {
  test('register 生成唯一 id 与 pending 状态', () => {
    const h1 = taskRegistry.register('agent')
    const h2 = taskRegistry.register('agent')
    assert.notEqual(h1.id, h2.id)
    assert.equal(taskRegistry.getState(h1.id)!.status, 'pending')
  })

  test('updateStatus 对不存在的任务返回 false', () => {
    assert.equal(taskRegistry.updateStatus('不存在', 'running'), false)
  })

  test('updateStatus 正常流转并刷新 updatedAt', async () => {
    const h = taskRegistry.register('shell')
    const t0 = taskRegistry.getState(h.id)!.updatedAt
    await new Promise((r) => setTimeout(r, 2))
    assert.equal(taskRegistry.updateStatus(h.id, 'running'), true)
    assert.equal(taskRegistry.getState(h.id)!.status, 'running')
    assert.ok(taskRegistry.getState(h.id)!.updatedAt >= t0)
  })

  test('cancel 置为 cancelled 并调用注册的取消函数', () => {
    const h = taskRegistry.register('shell')
    let called = false
    taskRegistry.setCancelFn(h.id, () => { called = true })
    h.cancel()
    assert.equal(taskRegistry.getState(h.id)!.status, 'cancelled')
    assert.equal(called, true, 'cancel 应触发 cancelFn')
  })

  test('cancel 后不得被 updateStatus 改回 running（回归：终态保护）', () => {
    const h = taskRegistry.register('shell')
    taskRegistry.updateStatus(h.id, 'running')
    h.cancel()
    assert.equal(taskRegistry.getState(h.id)!.status, 'cancelled')
    const ok = taskRegistry.updateStatus(h.id, 'running')
    assert.equal(ok, false, '终态任务不应接受状态变更')
    assert.equal(taskRegistry.getState(h.id)!.status, 'cancelled', '取消后不应复活')
  })

  test('completed 后同样不得被改回（回归：终态保护）', () => {
    const h = taskRegistry.register('agent')
    taskRegistry.updateStatus(h.id, 'completed')
    assert.equal(taskRegistry.updateStatus(h.id, 'running'), false)
    assert.equal(taskRegistry.getState(h.id)!.status, 'completed')
  })

  test('setCancelFn 对不存在的任务返回 false', () => {
    assert.equal(taskRegistry.setCancelFn('无此任务', () => {}), false)
  })
})

describe('taskRegistry — 查询与清理', () => {
  test('getAllTasks 返回副本，外部修改不影响内部', () => {
    const h = taskRegistry.register('plan', { k: 1 })
    const all = taskRegistry.getAllTasks()
    const mine = all.find((t) => t.id === h.id)!
    mine.status = 'failed'
    assert.equal(taskRegistry.getState(h.id)!.status, 'pending', 'getAllTasks 应返回副本')
  })

  test('getState 返回副本，外部篡改不影响内部（回归）', () => {
    const h = taskRegistry.register('plan', { k: 1 })
    const s = taskRegistry.getState(h.id)!
    s.status = 'failed'
    s.metadata.hacked = true
    assert.equal(taskRegistry.getState(h.id)!.status, 'pending', 'getState 不应暴露内部引用')
    assert.equal(taskRegistry.getState(h.id)!.metadata.hacked, undefined)
  })

  test('getTasksByType 只返回该类型', () => {
    taskRegistry.register('workflow', { marker: 'wf-1' })
    const list = taskRegistry.getTasksByType('workflow')
    assert.ok(list.length >= 1)
    assert.ok(list.every((t) => t.type === 'workflow'))
  })

  test('便捷导出 getAllTasks / getTaskByType 可用', () => {
    taskRegistry.register('human')
    assert.ok(getAllTasks().length > 0)
    assert.ok(getTaskByType('human').every((t) => t.type === 'human'))
  })

  test('getTerminalTasks 只含终态', () => {
    const h = taskRegistry.register('agent')
    taskRegistry.updateStatus(h.id, 'failed')
    const term = taskRegistry.getTerminalTasks()
    assert.ok(term.some((t) => t.id === h.id))
    assert.ok(term.every((t) => isTerminalTaskStatus(t.status)))
  })

  test('cleanupTerminal(0) 清掉全部终态任务', () => {
    const h = taskRegistry.register('agent')
    taskRegistry.updateStatus(h.id, 'completed')
    const cleaned = taskRegistry.cleanupTerminal(0)
    assert.ok(cleaned.some((t) => t.id === h.id))
    assert.equal(taskRegistry.getState(h.id), undefined)
  })

  test('cleanupTerminal 不动非终态任务', () => {
    const h = taskRegistry.register('agent')
    taskRegistry.cleanupTerminal(0)
    assert.ok(taskRegistry.getState(h.id), 'running/pending 任务不应被清理')
  })

  test('cleanupTerminal(大值) 保留较新的终态任务', () => {
    const h = taskRegistry.register('agent')
    taskRegistry.updateStatus(h.id, 'completed')
    const cleaned = taskRegistry.cleanupTerminal(60_000)
    assert.equal(cleaned.length, 0, '未超过保留窗口不应清理')
    assert.ok(taskRegistry.getState(h.id))
  })
})

describe('taskRegistry — 进度上报', () => {
  test('reportProgress 通知订阅者', () => {
    const h = taskRegistry.register('shell')
    const got: number[] = []
    const off = h.onProgress((p) => got.push(p.percent))
    taskRegistry.reportProgress(h.id, { percent: 50 })
    taskRegistry.reportProgress(h.id, { percent: 100 })
    assert.deepEqual(got, [50, 100])
    off()
    taskRegistry.reportProgress(h.id, { percent: 100 })
    assert.deepEqual(got, [50, 100], '取消订阅后不应再收到')
  })

  test('单个监听器抛错不影响其它监听器', () => {
    const h = taskRegistry.register('shell')
    const got: number[] = []
    h.onProgress(() => { throw new Error('boom') })
    h.onProgress((p) => got.push(p.percent))
    assert.equal(taskRegistry.reportProgress(h.id, { percent: 42 }), true)
    assert.deepEqual(got, [42], '前一个监听器抛错不应阻断后续监听器')
  })

  test('reportProgress 对不存在的任务返回 false', () => {
    assert.equal(taskRegistry.reportProgress('无此任务', { percent: 1 }), false)
  })
})
