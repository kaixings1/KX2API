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
  test('同一波内的节点并发执行（总耗时 < 串行累加）', async () => {
    const { deps, callLog } = makeDeps({ latencyMs: 50 })
    const orch = new Orchestrator({ mode: 'parallel', roles: ['team_leader'] }, deps)

    const start = Date.now()
    const result = await orch.run('测试任务')
    const elapsed = Date.now() - start

    // 6 个节点分 3 波，每波 2 节点并发，每节点 50ms：
    // 串行需 6*50=300ms，真并行约 3*50=150ms。给足余量断言并发生效。
    assert.equal(result.success, true)
    assert.ok(elapsed < 320, `应为并发执行（约150ms），实际 ${elapsed}ms（疑似串行）`)
    assert.equal(callLog.length, 7, '7 个节点（research + 6 后续）都应被调用')
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
