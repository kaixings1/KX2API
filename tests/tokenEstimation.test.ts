/**
 * tests/tokenEstimation.test.ts — token 估算纯函数测试
 *
 * 运行：node --import tsx --test tests/tokenEstimation.test.ts
 * （纯函数零外部依赖，node:test 直接可用，被 test:extras 接住）
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  roughTokenCountEstimation,
  bytesPerTokenForFileType,
  roughTokenCountEstimationForFileType,
  roughTokenCountEstimationForMessages,
  roughTokenCountEstimationForMessage,
  safeStringify,
} from '../src/utils/tokenEstimation.ts'

describe('roughTokenCountEstimation 基础估算', () => {
  test('默认 bytesPerToken=4', () => {
    assert.equal(roughTokenCountEstimation('hello world'), 3) // 11/4=2.75→round 3
  })

  test('按内容长度线性估算', () => {
    const s = 'x'.repeat(100)
    assert.equal(roughTokenCountEstimation(s), 25) // 100/4
  })

  test('自定义 bytesPerToken', () => {
    assert.equal(roughTokenCountEstimation('abcdef', 2), 3)
  })

  test('空串返回 0', () => {
    assert.equal(roughTokenCountEstimation(''), 0)
  })
})

describe('bytesPerTokenForFileType / forFileType', () => {
  test('json 系列用 2，其余用 4', () => {
    assert.equal(bytesPerTokenForFileType('json'), 2)
    assert.equal(bytesPerTokenForFileType('jsonl'), 2)
    assert.equal(bytesPerTokenForFileType('jsonc'), 2)
    assert.equal(bytesPerTokenForFileType('ts'), 4)
    assert.equal(bytesPerTokenForFileType('md'), 4)
  })

  test('已知文件类型更精确估算', () => {
    const json = '{"a":"b","c":"d","e":"f"}'
    const linear = roughTokenCountEstimationForFileType(json, 'ts') // /4
    const dense = roughTokenCountEstimationForFileType(json, 'json') // /2
    assert.ok(dense >= linear, 'JSON 字节更密 → token 估算应不低')
  })
})

describe('结构性块级估算', () => {
  test('messages 级合计，内容按默认比率', () => {
    const msgs = [
      { type: 'user', message: { content: 'hello world hello world' } }, // 22/4→round 6
      { type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } }, // 2/4→round 1
    ]
    const total = roughTokenCountEstimationForMessages(msgs)
    assert.equal(total, 6 + 1)
  })

  test('内容块累计（tool_use 计入）', () => {
    const hit = roughTokenCountEstimationForMessages([
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'hi' },
            { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      },
    ])
    assert.ok(hit > 0, 'tool_use 块也应估算')
    assert.ok(hit > 1, 'text(1) + tool_use 应有更多')
  })

  test('非 user/assistant 类型返回 0', () => {
    assert.equal(roughTokenCountEstimationForMessage({ type: 'system' }), 0)
  })
})

describe('safeStringify', () => {
  test('圆形引用容错', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    assert.equal(safeStringify(a), '')
  })

  test('普通对象正常序列化', () => {
    assert.equal(safeStringify({ x: 1 }), '{"x":1}')
  })

  test('undefined 返回空串', () => {
    assert.equal(safeStringify(undefined), '')
  })
})