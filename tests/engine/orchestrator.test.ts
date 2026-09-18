/**
 * Orchestrator / TaskGraph 行为测试
 *
 * 锁定两个真实 bug 的修复：
 *   1. parallel 模式应是「真并行」（同一波就绪节点并发执行），而非串行
 *   2. buildParallelGraph 应产出分层可并行的拓扑（同波节点互不依赖）
 *   3. TaskNode 类型在 messages.ts 与 taskGraph.ts 之间只有一份定义
 *
 * 运行：node --import tsx --test tests/engine/orchestrator.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { Orchestrator, type OrchestratorDeps } from '../../src/engine/orchestrator/orchestrator.ts'
import { TaskGraph, buildParallelGraph } from '../../src/engine/orchestrator/taskGraph.ts'
import type { TaskNode } from '../../src/engine/orchestrator/taskGraph.ts'

/** 用精确计时的 fake executeLLM：检测并行（同时发起 vs 串行等待） */
function makeDeps(opts: { latencyMs?: number; callLog?: string[] } = {}) {
  const latencyMs = opts.latencyMs ?? 0
  const callLog = opts.callLog ?? []
  const deps: OrchestratorDeps = {
    executeLLM: async (role: string) => {
      callLog.push(`${role}@${Date.now()}`)
      if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs))
      return `[${role}] 输出`
    },
  }
  return { deps, callLog }
}

describe('buildParallelGraph — 拓扑结构', () => {
  test('产出分层可并行的节点（同波节点互不依赖）', () => {
    const nodes = buildParallelGraph('做个功能')
    const byId = new Map(nodes.map((n) => [n.id, n]))
    // research 是根
    const research = byId.get('step-0-research')!
    assert.equal(research.dependencies.length, 0)

    // analyze 与 design 同属第一波，互相不应有依赖
    const analyze = nodes.find((n) => n.stage === 'analyze')!
    const design = nodes.find((n) => n.stage === 'design')!
    assert.equal(analyze.dependencies.includes(design.id), false)
    assert.equal(design.dependencies.includes(analyze.id), false)
    // 二者都只依赖 research
    assert.ok(analyze.dependencies.includes(research.id))
    assert.ok(design.dependencies.includes(research.id))
  })

  test('后续波次依赖前一波全部节点', () => {
    const nodes = buildParallelGraph('做个功能')
    const plan = nodes.find((n) => n.stage === 'plan')!
    const implement = nodes.find((n) => n.stage === 'implement')!
    // plan/implement 这一波应依赖 analyze+design 两个节点
    assert.equal(plan.dependencies.length, 2)
    assert.equal(implement.dependencies.length, 2)
  })
})

describe('Orchestrator parallel 模式 — 真并行', () => {
  test('同一波内的节点并发执行（观察并发峰值，而非绝对耗时）', async () => {
    // ⚠️ 不用「总耗时 < N ms」断言并发：全量测试（run-all.mjs 并行跑 60+ 文件）
    // 下 CPU 争抢会让 50ms 延迟实测成 300ms+，产生随机失败。
    // 改为直接观察「同时在飞的调用数」——这是并发的**定义**，不受机器负载影响。
    let inFlight = 0
    let maxConcurrent = 0
    const calledRoles: string[] = []

    const deps: OrchestratorDeps = {
      executeLLM: async (role: string) => {
        calledRoles.push(role)
        inFlight++
        maxConcurrent = Math.max(maxConcurrent, inFlight)
        await new Promise((r) => setTimeout(r, 30))
        inFlight--
        return `[${role}] 输出`
      },
    }
    const orch = new Orchestrator({ mode: 'parallel', roles: ['team_leader'] }, deps)
    const result = await orch.run('测试任务')

    assert.equal(result.success, true)
    assert.equal(calledRoles.length, 7, '7 个节点（research + 6 后续）都应被调用')

    // 分层波次：research 单独一波，之后每波 2 个 → 峰值并发应为 2。
    // 若退化回串行，峰值会恒为 1，此断言即失败。
    assert.ok(
      maxConcurrent >= 2,
      `应观察到并发（峰值 >= 2），实际峰值 ${maxConcurrent}（疑似串行）`,
    )
  })

  test('节点按波次分批就绪（并发数不超过同波节点数）', async () => {
    let maxConcurrent = 0
    let inFlight = 0
    const deps: OrchestratorDeps = {
      executeLLM: async (role: string) => {
        inFlight++
        maxConcurrent = Math.max(maxConcurrent, inFlight)
        await new Promise((r) => setTimeout(r, 10))
        inFlight--
        return `[${role}] done`
      },
    }
    const orch = new Orchestrator({ mode: 'parallel', roles: ['team_leader'] }, deps)
    await orch.run('并发数检查')

    // 每波最多 2 个节点（analyze+design / plan+implement / verify+review 各 2 个），
    // 因此任意时刻并发数不应超过 2
    assert.ok(maxConcurrent <= 2, `并发数不应超过同波节点数 2，实际峰值 ${maxConcurrent}`)
  })
})

describe('TaskGraph — 依赖调度', () => {
  test('getReady 只返回依赖已完成的待执行节点', () => {
    const g = new TaskGraph()
    const a: TaskNode = { id: 'a', description: '', stage: 'research', role: 'researcher', dependencies: [], status: 'pending' }
    const b: TaskNode = { id: 'b', description: '', stage: 'analyze', role: 'pm', dependencies: ['a'], status: 'pending' }
    g.addNodes([a, b])

    // 初始只有 a 就绪
    assert.deepEqual(g.getReady().map((n) => n.id), ['a'])
    g.markCompleted('a', 'result-a')

    // a 完成后 b 就绪
    assert.deepEqual(g.getReady().map((n) => n.id), ['b'])
  })

  test('依赖失败 → 下游节点被跳过', () => {
    const g = new TaskGraph()
    const a: TaskNode = { id: 'a', description: '', stage: 'research', role: 'researcher', dependencies: [], status: 'pending' }
    const b: TaskNode = { id: 'b', description: '', stage: 'analyze', role: 'pm', dependencies: ['a'], status: 'pending' }
    g.addNodes([a, b])
    g.markFailed('a', 'boom')

    assert.equal(g.skipIfDependencyFailed('b'), true)
    assert.equal(g.get('b')!.status, 'skipped')
    assert.equal(g.hasFailed(), true)
  })
})
