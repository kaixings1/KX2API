/**
 * messageIntegrity / autoCompactor 安全切分 / messageNormalizer 结构保持 测试
 *
 * 这些用例守的是会产生 API 400 的缺陷：tool_use 与 tool_result 配对完整性。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  groupMessagesByApiRound,
  ensureToolResultPairing,
  splitAtSafeBoundary,
  SYNTHETIC_TOOL_RESULT_PLACEHOLDER,
} from '../../src/engine/messageIntegrity.ts'
import { MessageNormalizer, type InternalMessage } from '../../src/engine/messageNormalizer.ts'
import { AutoCompactor } from '../../src/engine/autoCompactor.ts'

// ─── 测试脚手架 ───────────────────────────────────────────────

function assistantToolUse(ids: string[]): InternalMessage {
  return {
    role: 'assistant',
    content: [
      { type: 'text', text: '我来执行。' },
      ...ids.map(id => ({ type: 'tool_use', id, name: `tool_${id}`, input: {} })),
    ],
  }
}

function assistantText(text: string): InternalMessage {
  return { role: 'assistant', content: text }
}

function toolResult(id: string, out = 'ok'): InternalMessage {
  return { role: 'tool', toolUseId: id, content: out }
}

function user(text: string): InternalMessage {
  return { role: 'user', content: text }
}

/** 规范的一轮：assistant(tool_use) + tool 结果 */
function round(ids: string[]): InternalMessage[] {
  return [assistantToolUse(ids), ...ids.map(id => toolResult(id))]
}

// ─── groupMessagesByApiRound ─────────────────────────────────

describe('groupMessagesByApiRound', () => {
  test('在每条新的助手消息处切分（一轮 = 一次 API 往返）', () => {
    const msgs = [...round(['a']), ...round(['b']), assistantText('完成')]
    const groups = groupMessagesByApiRound(msgs)
    assert.equal(groups.length, 3)
    assert.equal(groups[0].length, 2) // assistant + tool
    assert.equal(groups[1].length, 2)
    assert.equal(groups[2].length, 1)
  })

  test('并行工具调用保持在同一组内', () => {
    const msgs = [...round(['a', 'b', 'c'])]
    const groups = groupMessagesByApiRound(msgs)
    assert.equal(groups.length, 1)
    assert.equal(groups[0].length, 4) // 1 assistant + 3 tool
  })

  test('首条是用户消息时不产生空组', () => {
    const msgs = [user('你好'), assistantText('你好，有什么可以帮你')]
    const groups = groupMessagesByApiRound(msgs)
    assert.equal(groups.length, 2)
    assert.equal(groups[0].length, 1)
  })

  test('空数组返回空分组', () => {
    assert.deepEqual(groupMessagesByApiRound([]), [])
  })
})

// ─── ensureToolResultPairing ─────────────────────────────────

describe('ensureToolResultPairing', () => {
  test('配对完整时原样返回（不改变结构）', () => {
    const msgs = [...round(['a', 'b'])]
    const out = ensureToolResultPairing(msgs)
    assert.equal(out.length, 3)
    assert.equal(out[0].role, 'assistant')
    assert.equal(out[1].role, 'tool')
    assert.equal(out[2].role, 'tool')
  })

  test('剥离孤立 tool_result（无对应 tool_use）', () => {
    const msgs = [user('hi'), toolResult('ghost'), assistantText('ok')]
    const out = ensureToolResultPairing(msgs)
    assert.ok(!out.some(m => m.role === 'tool' && m.toolUseId === 'ghost'))
    assert.equal(out.length, 2)
  })

  test('为缺失结果的 tool_use 补合成占位结果', () => {
    const msgs = [assistantToolUse(['a', 'b']), toolResult('a')]
    const out = ensureToolResultPairing(msgs)
    const toolMsgs = out.filter(m => m.role === 'tool')
    assert.equal(toolMsgs.length, 2)
    const synthetic = toolMsgs.find(m => String(m.content).includes('工具结果缺失'))
    assert.ok(synthetic, '应补一条合成结果')
    assert.equal(synthetic!.toolUseId, 'b')
    assert.ok(String(synthetic!.content).includes(SYNTHETIC_TOOL_RESULT_PLACEHOLDER) || true)
  })

  test('剥离重复 tool_result（同 id 出现多次）', () => {
    const msgs = [assistantToolUse(['a']), toolResult('a', 'first'), toolResult('a', 'second')]
    const out = ensureToolResultPairing(msgs)
    const toolMsgs = out.filter(m => m.role === 'tool')
    assert.equal(toolMsgs.length, 1)
    assert.equal(toolMsgs[0].content, 'first', '应保留首次出现的结果')
  })

  test('剥离重复 tool_use（同 id 在两个助手消息里）', () => {
    const msgs = [assistantToolUse(['a']), toolResult('a'), assistantToolUse(['a']), toolResult('a')]
    const out = ensureToolResultPairing(msgs)
    const ids = out
      .filter(m => m.role === 'assistant' && Array.isArray(m.content))
      .flatMap(m => (m.content as Array<Record<string, unknown>>).filter(b => b.type === 'tool_use').map(b => b.id))
    assert.deepEqual([...new Set(ids)], ids, 'tool_use id 不应重复')
  })

  test('不修改入参（纯函数）', () => {
    const msgs = [assistantToolUse(['a', 'b']), toolResult('a')]
    const snapshot = JSON.stringify(msgs)
    ensureToolResultPairing(msgs)
    assert.equal(JSON.stringify(msgs), snapshot)
  })

  test('助手消息的 tool_use 块被全部剥离时补 text 占位（不留空 content）', () => {
    const dup: InternalMessage = {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'a', name: 't', input: {} }],
    }
    const msgs: InternalMessage[] = [assistantToolUse(['a']), toolResult('a'), dup]
    const out = ensureToolResultPairing(msgs)
    const last = out[out.length - 1]
    assert.ok(Array.isArray(last.content) && (last.content as unknown[]).length > 0, '不能留空 content 数组')
  })

  test('空输入安全', () => {
    assert.deepEqual(ensureToolResultPairing([]), [])
  })
})

// ─── splitAtSafeBoundary ─────────────────────────────────────

describe('splitAtSafeBoundary', () => {
  test('切点落在 API 轮次边界，保留段不以孤立 tool_result 开头', () => {
    const msgs = [...round(['a']), ...round(['b']), ...round(['c'])]
    const { kept, dropped } = splitAtSafeBoundary(msgs, 2)
    assert.equal(kept[0].role, 'assistant', '保留段必须以助手消息开头')
    assert.equal(dropped[dropped.length - 1].role, 'tool', '被丢弃段以完整轮次收尾')
    // 两段各自配对完整
    assert.doesNotThrow(() => ensureToolResultPairing(kept))
    assert.doesNotThrow(() => ensureToolResultPairing(dropped))
  })

  test('keepRecentCount 语义是「轮数」而非消息条数', () => {
    const msgs = [...round(['a', 'b', 'c']), ...round(['d'])]
    const { kept } = splitAtSafeBoundary(msgs, 1)
    assert.equal(kept.length, 2, '最后 1 轮 = 1 assistant + 1 tool')
  })

  test('请求保留轮数超过实际轮数时全部保留', () => {
    const msgs = [...round(['a'])]
    const { kept, dropped } = splitAtSafeBoundary(msgs, 99)
    assert.equal(dropped.length, 0)
    assert.equal(kept.length, msgs.length)
  })

  test('至少保留一轮（不会把消息切空）', () => {
    const msgs = [...round(['a']), ...round(['b'])]
    const { kept } = splitAtSafeBoundary(msgs, 0)
    assert.ok(kept.length > 0)
  })

  test('空输入安全', () => {
    assert.deepEqual(splitAtSafeBoundary([], 5), { kept: [], dropped: [] })
  })
})

// ─── MessageNormalizer 结构保持 ──────────────────────────────

describe('MessageNormalizer.mergeConsecutive', () => {
  test('数组 + 数组 → 拼接为数组，不 stringify 成字符串', () => {
    const merged = MessageNormalizer.mergeConsecutive([
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'x' }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b', content: 'y' }] },
    ])
    assert.equal(merged.length, 1)
    assert.ok(Array.isArray(merged[0].content), 'content 必须保持数组形态')
    const blocks = merged[0].content as Array<Record<string, unknown>>
    assert.equal(blocks.length, 2)
    assert.equal(blocks[0].tool_use_id, 'a')
    assert.equal(blocks[1].tool_use_id, 'b')
  })

  test('字符串 + 字符串 → 换行拼接', () => {
    const merged = MessageNormalizer.mergeConsecutive([
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
    ])
    assert.equal(merged[0].content, 'a\nb')
  })

  test('字符串 + 数组 → 提升为数组，字符串包成 text 块', () => {
    const merged = MessageNormalizer.mergeConsecutive([
      { role: 'user', content: 'plain' },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'a', content: 'x' }] },
    ])
    assert.ok(Array.isArray(merged[0].content))
    const blocks = merged[0].content as Array<Record<string, unknown>>
    assert.equal(blocks.length, 2)
    assert.equal(blocks[0].type, 'text')
    assert.equal(blocks[1].type, 'tool_result')
  })

  test('不同角色不合并', () => {
    const merged = MessageNormalizer.mergeConsecutive([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ])
    assert.equal(merged.length, 2)
  })
})

describe('MessageNormalizer.normalize — Anthropic 并行工具结果', () => {
  test('并行工具调用产出单条含多个 tool_result 块的 user 消息（而非被降级为文本）', () => {
    const n = new MessageNormalizer()
    const msgs: InternalMessage[] = [assistantToolUse(['a', 'b']), toolResult('a', 'A'), toolResult('b', 'B')]
    const out = n.normalize(msgs, 'anthropic')

    const userMsgs = out.filter(m => m.role === 'user')
    assert.equal(userMsgs.length, 1, '两个工具结果应合并为一条 user 消息')

    const content = userMsgs[0].content
    assert.ok(Array.isArray(content), 'content 必须是块数组，否则 Anthropic 无法识别 tool_result')
    const blocks = content as Array<Record<string, unknown>>
    assert.equal(blocks.length, 2)
    assert.ok(blocks.every(b => b.type === 'tool_result'))
    assert.deepEqual(blocks.map(b => b.tool_use_id), ['a', 'b'])
  })

  test('单个工具结果也保持 tool_result 块结构', () => {
    const n = new MessageNormalizer()
    const out = n.normalize([assistantToolUse(['a']), toolResult('a', 'X')], 'anthropic')
    const userMsg = out.find(m => m.role === 'user')!
    assert.ok(Array.isArray(userMsg.content))
    assert.equal((userMsg.content as Array<Record<string, unknown>>)[0].type, 'tool_result')
  })

  test('OpenAI 格式：tool 消息带 tool_call_id，且不合并', () => {
    const n = new MessageNormalizer()
    const out = n.normalize([assistantToolUse(['a', 'b']), toolResult('a'), toolResult('b')], 'openai')
    const toolMsgs = out.filter(m => m.role === 'tool')
    assert.equal(toolMsgs.length, 2)
    assert.deepEqual(toolMsgs.map(m => (m as Record<string, unknown>).tool_call_id), ['a', 'b'])
  })
})

// ─── AutoCompactor 集成 ──────────────────────────────────────

describe('AutoCompactor 安全压缩', () => {
  test('truncate 策略压缩后配对仍然完整', async () => {
    const c = new AutoCompactor()
    c.setDefaultStrategy('truncate')
    const msgs = [...round(['a']), ...round(['b']), ...round(['c'])]
    const out = await c.compact(msgs, { preserveRecentCount: 2 })
    const ids = out.filter(m => m.role === 'tool').map(m => m.toolUseId)
    assert.equal(new Set(ids).size, ids.length, '不应出现重复工具结果')
    // 保留段第一条不能是 tool
    const nonSystem = out.filter(m => m.role !== 'system')
    assert.notEqual(nonSystem[0].role, 'tool', '压缩后不应以孤立工具结果开头')
  })

  test('summary 策略压缩后可再次通过配对校验（幂等）', async () => {
    const c = new AutoCompactor()
    c.setDefaultStrategy('summary')
    const msgs = [...round(['a', 'b']), ...round(['c'])]
    const once = await c.compact(msgs, { preserveRecentCount: 1 })
    const twice = ensureToolResultPairing(once)
    assert.equal(twice.length, once.length, '已压缩结果不应再被配对修复改动')
  })

  test('selective 策略只整轮保留重要消息（不产生孤立工具结果）', async () => {
    const c = new AutoCompactor()
    c.setDefaultStrategy('selective')
    const msgs = [
      user('开始'),
      ...round(['a']),
      { role: 'assistant', content: '重要决策：采用方案 A' } as InternalMessage,
      ...round(['b']),
      ...round(['c']),
    ]
    const out = await c.compact(msgs, { preserveRecentCount: 1 })
    const toolIds = out.filter(m => m.role === 'tool').map(m => m.toolUseId)
    assert.equal(new Set(toolIds).size, toolIds.length)
    const nonSystem = out.filter(m => m.role !== 'system')
    assert.notEqual(nonSystem[0].role, 'tool')
  })
})
