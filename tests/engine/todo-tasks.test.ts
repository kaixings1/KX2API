/**
 * engine/utils/tasks（TodoV2 文件级任务系统）测试
 *
 * 使用临时目录隔离（绝不写用户的真实任务目录）。
 *
 * 含真实缺陷回归：
 *   notifyTasksUpdated 用 try 包住整个循环 —— 第一个监听器抛错会中断
 *   后续所有监听器（应逐个隔离）。
 *
 * 运行：node --import tsx --test tests/engine/todo-tasks.test.ts
 */
import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  getTaskListId,
  getTask,
  listTasks,
  updateTask,
  createTask,
  claimTask,
  onTasksUpdated,
  notifyTasksUpdated,
  type Task,
} from '../../src/engine/utils/tasks.ts'

let tmpDir: string
const LIST = 'test-list'

function newTaskData(subject: string, extra: Partial<Omit<Task, 'id'>> = {}): Omit<Task, 'id'> {
  return {
    subject,
    description: `${subject} 的描述`,
    status: 'pending',
    blocks: [],
    blockedBy: [],
    ...extra,
  }
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'kx2-tasks-'))
  process.env.KX2_TASKS_DIR = tmpDir
  process.env.KX2_TASK_LIST_ID = LIST
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.KX2_TASKS_DIR
  delete process.env.KX2_TASK_LIST_ID
})

describe('任务列表解析', () => {
  test('getTaskListId 使用环境变量', () => {
    assert.equal(getTaskListId(), LIST)
  })

  test('getTaskListId 缺省为 default', () => {
    delete process.env.KX2_TASK_LIST_ID
    assert.equal(getTaskListId(), 'default')
  })
})

describe('任务 CRUD', () => {
  test('createTask 返回递增 id 且可读回', async () => {
    const id1 = await createTask(LIST, newTaskData('第一个'))
    const id2 = await createTask(LIST, newTaskData('第二个'))
    assert.equal(id1, '1')
    assert.equal(id2, '2')

    const t = await getTask(LIST, id1)
    assert.ok(t)
    assert.equal(t.subject, '第一个')
    assert.equal(t.status, 'pending')
  })

  test('getTask 对不存在的任务返回 null', async () => {
    assert.equal(await getTask(LIST, '999'), null)
  })

  test('listTasks 返回全部任务', async () => {
    await createTask(LIST, newTaskData('a'))
    await createTask(LIST, newTaskData('b'))
    const all = await listTasks(LIST)
    assert.equal(all.length, 2)
    assert.deepEqual(all.map((t) => t.subject).sort(), ['a', 'b'])
  })

  test('listTasks 对不存在的列表返回空数组', async () => {
    assert.deepEqual(await listTasks('从未创建过'), [])
  })

  test('updateTask 合并字段并保留 id', async () => {
    const id = await createTask(LIST, newTaskData('原始'))
    const updated = await updateTask(LIST, id, { subject: '改过', status: 'in_progress' })
    assert.equal(updated!.id, id)
    assert.equal(updated!.subject, '改过')
    assert.equal(updated!.status, 'in_progress')

    const reread = await getTask(LIST, id)
    assert.equal(reread!.subject, '改过', '应已落盘')
  })

  test('updateTask 对不存在的任务返回 null', async () => {
    assert.equal(await updateTask(LIST, '404', { subject: 'x' }), null)
  })

  test('updateTask 不允许篡改 id', async () => {
    const id = await createTask(LIST, newTaskData('x'))
    // 即使传入 id 也会被强制覆盖回原 id
    const updated = await updateTask(LIST, id, { id: 'hacked' } as never)
    assert.equal(updated!.id, id, 'id 不可被 updates 覆盖')
  })

  test('任务数据以 JSON 文件落盘', async () => {
    const id = await createTask(LIST, newTaskData('落盘检查'))
    const raw = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(tmpDir, LIST, `${id}.json`), 'utf-8'),
    )
    const parsed = JSON.parse(raw)
    assert.equal(parsed.subject, '落盘检查')
    assert.equal(parsed.id, id)
  })
})

describe('claimTask — 认领语义', () => {
  test('认领成功并写入 owner', async () => {
    const id = await createTask(LIST, newTaskData('待认领'))
    const r = await claimTask(LIST, id, 'agent-1')
    assert.equal(r.success, true)
    assert.equal(r.task!.owner, 'agent-1')
  })

  test('不存在的任务', async () => {
    const r = await claimTask(LIST, '404', 'agent-1')
    assert.equal(r.success, false)
    assert.equal(r.reason, 'task_not_found')
  })

  test('已被他人认领时报 already_claimed', async () => {
    const id = await createTask(LIST, newTaskData('x'))
    await claimTask(LIST, id, 'agent-1')
    const r = await claimTask(LIST, id, 'agent-2')
    assert.equal(r.success, false)
    assert.equal(r.reason, 'already_claimed')
  })

  test('已完成任务不可认领', async () => {
    const id = await createTask(LIST, newTaskData('x'))
    await updateTask(LIST, id, { status: 'completed' })
    const r = await claimTask(LIST, id, 'agent-1')
    assert.equal(r.success, false)
    assert.equal(r.reason, 'already_resolved')
  })

  test('被未完成的前置任务阻塞时不可认领', async () => {
    const depId = await createTask(LIST, newTaskData('前置'))
    const id = await createTask(LIST, newTaskData('后继', { blockedBy: [depId] }))
    const r = await claimTask(LIST, id, 'agent-1')
    assert.equal(r.success, false)
    assert.equal(r.reason, 'blocked')
    assert.deepEqual(r.blockedByTasks, [depId])
  })

  test('前置任务完成后即可认领', async () => {
    const depId = await createTask(LIST, newTaskData('前置'))
    const id = await createTask(LIST, newTaskData('后继', { blockedBy: [depId] }))
    await updateTask(LIST, depId, { status: 'completed' })
    const r = await claimTask(LIST, id, 'agent-1')
    assert.equal(r.success, true)
  })

  test('同一 agent 重复认领自己已认领的任务应成功（幂等）', async () => {
    const id = await createTask(LIST, newTaskData('x'))
    await claimTask(LIST, id, 'agent-1')
    const r = await claimTask(LIST, id, 'agent-1')
    assert.equal(r.success, true)
    assert.equal(r.task!.owner, 'agent-1')
  })
})

describe('事件通知', () => {
  test('变更时触发监听器', async () => {
    let n = 0
    const off = onTasksUpdated(() => { n++ })
    await createTask(LIST, newTaskData('x'))
    assert.equal(n, 1, 'createTask 应触发通知')
    const id = await createTask(LIST, newTaskData('y'))
    await updateTask(LIST, id, { status: 'completed' })
    assert.equal(n, 3)
    off()
  })

  test('取消订阅后不再触发', async () => {
    let n = 0
    const off = onTasksUpdated(() => { n++ })
    off()
    await createTask(LIST, newTaskData('x'))
    assert.equal(n, 0)
  })

  test('单个监听器抛错不应中断后续监听器（回归）', async () => {
    const order: string[] = []
    const off1 = onTasksUpdated(() => { order.push('first'); throw new Error('boom') })
    const off2 = onTasksUpdated(() => { order.push('second') })
    const off3 = onTasksUpdated(() => { order.push('third') })

    assert.doesNotThrow(() => notifyTasksUpdated())
    assert.deepEqual(order, ['first', 'second', 'third'], '一个监听器抛错不应阻断其它监听器')

    off1(); off2(); off3()
  })
})
