/**
 * 单消息聚合预算（enforceToolResultBudget）测试
 *
 * 守的是两件事：
 *   1. N 个并行工具各自未超单结果阈值、但总和挤爆上下文
 *   2. 替换决策的**冻结语义** —— 一旦决策就不再改变，否则 prompt cache 全废
 */
import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  enforceToolResultBudget,
  createContentReplacementState,
  setToolResultsBaseDir,
  getToolResultsDir,
  DEFAULT_MAX_RESULTS_PER_MESSAGE_CHARS,
  PERSISTED_OUTPUT_TAG,
} from '../../src/engine/toolResultStore.ts'
import type { InternalMessage } from '../../src/engine/messageNormalizer.ts'

let tmpDir: string

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-budget-'))
})

after(async () => {
  setToolResultsBaseDir(null)
  await fs.rm(tmpDir, { recursive: true, force: true })
})

beforeEach(async () => {
  setToolResultsBaseDir(tmpDir)
  await fs.rm(getToolResultsDir(), { recursive: true, force: true })
})

function toolResult(id: string, size: number, char = 'x'): InternalMessage {
  return { role: 'tool', toolUseId: id, content: char.repeat(size) }
}

function assistant(id: string): InternalMessage {
  return {
    role: 'assistant',
    content: [{ type: 'tool_use', id, name: 't', input: {} }],
  }
}

function sizeOf(m: InternalMessage): number {
  return typeof m.content === 'string' ? m.content.length : 0
}

describe('未超预算时', () => {
  test('原样返回，不做任何替换', async () => {
    const state = createContentReplacementState()
    const msgs = [assistant('a'), toolResult('a', 1000)]
    const out = await enforceToolResultBudget(msgs, state, 10_000)
    assert.equal(sizeOf(out[1]), 1000)
    assert.ok(!String(out[1].content).includes(PERSISTED_OUTPUT_TAG))
  })

  test('把结果冻结为「永不替换」', async () => {
    const state = createContentReplacementState()
    await enforceToolResultBudget([assistant('a'), toolResult('a', 1000)], state, 10_000)
    assert.ok(state.decisions.has('a'), '应记录决策')
    assert.equal(state.decisions.get('a'), null, '决策应为「不替换」')
  })

  test('无 tool 消息的轮次不做处理', async () => {
    const state = createContentReplacementState()
    const msgs: InternalMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]
    const out = await enforceToolResultBudget(msgs, state, 10)
    assert.equal(out.length, 2)
    assert.equal(state.decisions.size, 0)
  })
})

describe('超预算时', () => {
  test('N 个并行工具结果被大幅压缩', async () => {
    const state = createContentReplacementState()
    const budget = 10_000
    // 5 个各 4000 字符 = 20000 > 10000
    const msgs: InternalMessage[] = [
      assistant('a'),
      toolResult('a', 4000, 'a'),
      toolResult('b', 4000, 'b'),
      toolResult('c', 4000, 'c'),
      toolResult('d', 4000, 'd'),
      toolResult('e', 4000, 'e'),
    ]
    const out = await enforceToolResultBudget(msgs, state, budget)
    const tools = out.filter(m => m.role === 'tool')
    const total = tools.reduce((n, m) => n + sizeOf(m), 0)

    // 注意：这里是「尽量压缩」而非「保证收敛」。
    // 每条替换结果自身还需要 ~2KB 预览（路径 + 头部 + 预览正文），
    // 当「全部替换后的预览总量」仍超过预算时，只能接受超支 ——
    // 上游 Claude Code 同样是这个口径（超支交给上层 microcompact 处理）。
    assert.ok(total < 20_000, `应显著小于原始 20000，实际 ${total}`)
    assert.ok(total <= 13_000, `应接近预算量级，实际 ${total}`)
    assert.ok(tools.every(m => String(m.content).includes(PERSISTED_OUTPUT_TAG)))
  })

  test('单个大结果能严格收敛到预算内', async () => {
    const state = createContentReplacementState()
    const out = await enforceToolResultBudget(
      [assistant('a'), toolResult('a', 200_000)],
      state,
      10_000,
    )
    const total = out.filter(m => m.role === 'tool').reduce((n, m) => n + sizeOf(m), 0)
    assert.ok(total <= 10_000, `单个结果应能收敛，实际 ${total}`)
  })

  test('净减少保护：预览比原文还长时不替换', async () => {
    const state = createContentReplacementState()
    // 500 字符的结果 + 极小预算：预览头部（路径+提示）本身就超过 500 字符，
    // 替换只会让内容变长，应当放弃替换。
    const out = await enforceToolResultBudget(
      [assistant('a'), toolResult('a', 500)],
      state,
      100,
    )
    assert.equal(sizeOf(out[1]), 500, '预览更长时不应替换')
    assert.equal(state.decisions.get('a'), null)
  })

  test('优先替换最大的结果（用最少次数压到预算内）', async () => {
    const state = createContentReplacementState()
    const msgs: InternalMessage[] = [
      assistant('small'),
      toolResult('small', 100, 's'),
      toolResult('big', 50_000, 'b'),
      toolResult('mid', 5_000, 'm'),
    ]
    const out = await enforceToolResultBudget(msgs, state, 10_000)
    const byId = new Map(out.filter(m => m.role === 'tool').map(m => [m.toolUseId!, String(m.content)]))
    assert.ok(byId.get('big')!.includes(PERSISTED_OUTPUT_TAG), '最大的应被替换')
    assert.ok(!byId.get('small')!.includes(PERSISTED_OUTPUT_TAG), '最小的应保留')
  })

  test('被替换的结果带 <persisted-output> 标记与文件路径', async () => {
    const state = createContentReplacementState()
    const out = await enforceToolResultBudget(
      [assistant('a'), toolResult('a', 50_000)],
      state,
      1000,
    )
    const text = String(out[1].content)
    assert.ok(text.includes(PERSISTED_OUTPUT_TAG))
    assert.ok(text.includes(getToolResultsDir()), '应给出可取回的路径')
  })
})

describe('决策冻结（prompt cache 稳定性）', () => {
  test('已决策「不替换」的结果，后续即使超预算也不替换', async () => {
    const state = createContentReplacementState()
    const msgs = [assistant('a'), toolResult('a', 1000)]

    // 第一次：未超预算 → 冻结为「不替换」
    await enforceToolResultBudget(msgs, state, 10_000)

    // 第二次：预算收紧到极小，但 a 已冻结为不替换，必须原样保留
    const out = await enforceToolResultBudget(msgs, state, 10)
    assert.equal(sizeOf(out[1]), 1000, '已冻结的结果不应被替换')
    assert.ok(!String(out[1].content).includes(PERSISTED_OUTPUT_TAG))
  })

  test('已决策「替换」的结果，后续重放同一字符串（字节一致）', async () => {
    const state = createContentReplacementState()
    const msgs = [assistant('a'), toolResult('a', 50_000)]

    const first = await enforceToolResultBudget(msgs, state, 1000)
    const firstText = String(first[1].content)

    // 第二次传入的已是替换后的内容，重放必须一致
    const second = await enforceToolResultBudget(first, state, 1000)
    assert.equal(String(second[1].content), firstText, '重放必须字节一致')
  })

  test('决策在多次调用间保持稳定（不反复横跳）', async () => {
    const state = createContentReplacementState()
    const msgs: InternalMessage[] = [
      assistant('a'),
      toolResult('a', 30_000, 'a'),
      toolResult('b', 30_000, 'b'),
    ]
    const budget = 40_000

    const r1 = await enforceToolResultBudget(msgs, state, budget)
    const snapshot1 = r1.filter(m => m.role === 'tool').map(m => [m.toolUseId, String(m.content).length])

    const r2 = await enforceToolResultBudget(msgs, state, budget)
    const snapshot2 = r2.filter(m => m.role === 'tool').map(m => [m.toolUseId, String(m.content).length])

    assert.deepEqual(snapshot2, snapshot1, '相同输入应产出相同决策')
  })

  test('resetReplacementState 语义：新状态允许重新决策', async () => {
    const s1 = createContentReplacementState()
    await enforceToolResultBudget([assistant('a'), toolResult('a', 1000)], s1, 10_000)
    assert.equal(s1.decisions.get('a'), null)

    const s2 = createContentReplacementState()
    assert.equal(s2.decisions.size, 0, '新状态应为空')
  })
})

describe('健壮性', () => {
  test('空消息安全', async () => {
    const state = createContentReplacementState()
    assert.deepEqual(await enforceToolResultBudget([], state, 1000), [])
  })

  test('无 toolUseId 的 tool 消息被跳过（不崩）', async () => {
    const state = createContentReplacementState()
    const msgs: InternalMessage[] = [
      assistant('a'),
      { role: 'tool', content: 'x'.repeat(50_000) } as InternalMessage,
    ]
    const out = await enforceToolResultBudget(msgs, state, 100)
    assert.equal(out.length, 2)
  })

  test('落盘失败时冻结为不替换，绝不丢内容', async () => {
    const state = createContentReplacementState()
    setToolResultsBaseDir('\u0000invalid\u0000')
    const original = 'y'.repeat(50_000)
    const out = await enforceToolResultBudget(
      [assistant('a'), toolResult('a', 50_000, 'y')],
      state,
      100,
    )
    assert.equal(String(out[1].content), original, '落盘失败必须原样保留')
    assert.equal(state.decisions.get('a'), null)
    setToolResultsBaseDir(tmpDir)
  })

  test('多轮次分别独立计算预算', async () => {
    const state = createContentReplacementState()
    const msgs: InternalMessage[] = [
      assistant('a'), toolResult('a', 30_000, 'a'),
      assistant('b'), toolResult('b', 30_000, 'b'),
    ]
    // 每轮各 30000，预算 20000 → 两轮各自独立超限、各自替换
    const out = await enforceToolResultBudget(msgs, state, 20_000)
    const tools = out.filter(m => m.role === 'tool')
    assert.equal(tools.length, 2, '结构不应改变')
    assert.ok(tools.every(m => String(m.content).includes(PERSISTED_OUTPUT_TAG)))
  })

  test('默认预算常量为 200K', () => {
    assert.equal(DEFAULT_MAX_RESULTS_PER_MESSAGE_CHARS, 200_000)
  })
})
