/**
 * tests/batchUtils3.test.ts — 消息格式互转 + 文本工具移植测试
 *
 * 覆盖：messageFormat（OpenAI/Anthropic/Vercel/Gemini 互转）+
 *       textUtils（文本处理）
 *
 * 运行：node --import tsx --test tests/batchUtils3.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  detectFormat,
  anthropicToOpenAI,
  openAIToAnthropic,
  openAIToVercel,
  vercelToOpenAI,
  geminiToOpenAI,
  openAIToGemini,
  toOpenAI,
  fromOpenAI,
  extractUserQuery,
  countTurns,
  extractToolCalls,
} from '../src/utils/messageFormat.ts'
import {
  addAffix,
  removeAffix,
  removeComments,
  parseJsonCodeBlock,
  truncateAtSentence,
  concatenateEpisodes,
  splitParagraph,
  decodeUnicodeEscape,
} from '../src/utils/textUtils.ts'

describe('detectFormat', () => {
  test('检测 OpenAI 格式', () => {
    assert.equal(detectFormat([{ role: 'user', content: 'hi' }]), 'openai')
  })

  test('检测 Gemini 格式 (parts + model role)', () => {
    assert.equal(detectFormat([{ role: 'model', parts: [] }]), 'gemini')
  })

  test('检测 Anthropic 格式 (tool_use 块)', () => {
    const msgs = [{ role: 'assistant', content: [{ type: 'tool_use', id: 'x' }] }]
    assert.equal(detectFormat(msgs), 'anthropic')
  })
})

describe('anthropicToOpenAI', () => {
  test('user tool_result → tool 消息', () => {
    const out = anthropicToOpenAI([
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
        ],
      },
    ])
    assert.equal(out[0].role, 'tool')
    assert.equal(out[0].tool_call_id, 't1')
    assert.equal(out[0].content, 'ok')
  })

  test('assistant tool_use → tool_calls', () => {
    const out = anthropicToOpenAI([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'hi' },
          { type: 'tool_use', id: 't1', name: 'read', input: { path: 'a' } },
        ],
      },
    ])
    assert.equal(out[0].content, 'hi')
    assert.ok(out[0].tool_calls)
    assert.equal(out[0].tool_calls![0].function.name, 'read')
    assert.equal(JSON.parse(out[0].tool_calls![0].function.arguments).path, 'a')
  })
})

describe('toOpenAI / fromOpenAI', () => {
  test('往返转换保持结构', () => {
    const openai = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ]
    const an = fromOpenAI(openai as any, 'anthropic')
    assert.ok(Array.isArray(an))
    const back = toOpenAI(an)
    assert.equal(back[0].content, 'hello')
    assert.equal(back[1].content, 'world')
  })

  test('gemini 转换', () => {
    const openai = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'g1', type: 'function', function: { name: 'x', arguments: '{}' } }] },
    ]
    const gem = fromOpenAI(openai as any, 'gemini')
    assert.equal(gem[1].role, 'model')
    assert.ok(gem[1].parts.some((p: any) => p.functionCall))
    const back = geminiToOpenAI(gem)
    assert.equal(back[1].tool_calls![0].id, 'gemini_x')
  })
})

describe('extractUserQuery / countTurns / extractToolCalls', () => {
  test('提取最后用户文本', () => {
    const msgs = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'mid' },
      { role: 'user', content: 'last' },
    ]
    assert.equal(extractUserQuery(msgs), 'last')
  })

  test('计数用户轮次', () => {
    assert.equal(countTurns([{ role: 'user' }, { role: 'assistant' }, { role: 'user' }] as any), 2)
  })

  test('提取工具调用名（支持多格式）', () => {
    const msgs = [
      { role: 'assistant', tool_calls: [{ function: { name: 'a' } }] },
      { role: 'user', content: [{ type: 'tool_use', name: 'b' }] },
    ] as any
    const names = extractToolCalls(msgs)
    assert.ok(names.includes('a'))
    assert.ok(names.includes('b'))
  })
})

describe('textUtils', () => {
  test('addAffix/removeAffix 花括号', () => {
    assert.equal(addAffix('x'), '{x}')
    assert.equal(removeAffix('{x}'), 'x')
  })

  test('removeComments 移除 # 行注释但保留字符串内的 #', () => {
    const code = 'a = 1 # comment\nb = "keep # inside"'
    const out = removeComments(code)
    assert.ok(!out.includes('comment'))
    assert.ok(out.includes('keep # inside'))
  })

  test('parseJsonCodeBlock 提取 json 块', () => {
    const text = '```json\n{"a": 1}\n```\n```json\n{"b": 2}\n```'
    const blocks = parseJsonCodeBlock(text)
    assert.equal(blocks.length, 2)
    assert.deepEqual(JSON.parse(blocks[0]), { a: 1 })
  })

  test('truncateAtSentence 按句子边界截断', () => {
    const out = truncateAtSentence('First sentence. Second sentence. Third.', 20)
    assert.ok(out.length <= 20)
    assert.ok(out.includes('First'))
  })

  test('concatenateEpisodes 拼接剧集', () => {
    const out = concatenateEpisodes([
      { content: 'A', valid_at: 't1' },
      { content: 'B' },
    ])
    assert.ok(out.includes('[Episode 0]'))
    assert.ok(out.includes('t1'))
    assert.ok(out.includes('B'))
  })

  test('splitParagraph 分割段落', () => {
    const parts = splitParagraph('aa. bb. cc.', '.,', 2)
    assert.ok(parts.length >= 2)
  })

  test('decodeUnicodeEscape 解码', () => {
    assert.equal(decodeUnicodeEscape('hello\\u4e16\\u754c'), 'hello世界')
  })
})