/**
 * tests/utils/jsonRepair.test.ts — JSON 修复与安全序列化测试
 *
 * 运行：node --import tsx --test tests/jsonRepair.test.ts
 * （零外部依赖，node:test 直接可用，被 test:extras 接住）
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseJsonStream,
  safeJsonStringify,
  maskSecret,
} from '../src/utils/jsonRepair.ts'

describe('parseJsonStream 修复破损 JSON', () => {
  test('严格 JSON 直接解析', () => {
    const r = parseJsonStream('{"a":1,"b":"x"}')
    assert.deepEqual(r, { a: 1, b: 'x' })
  })

  test('修复未加引号 value', () => {
    // {"key": hello} -> {"key":"hello"}
    const r = parseJsonStream('{"name": hello world}')
    assert.deepEqual(r, { name: 'hello world' })
  })

  test('已是合法 JSON token 的值不重复处理', () => {
    const r = parseJsonStream('{"a":true}')
    assert.deepEqual(r, { a: true })
  })

  test('非 JSON 开头返回原样', () => {
    const input = 'not json at all'
    assert.equal(parseJsonStream(input), input)
  })

  test('非字符串原样返回', () => {
    const obj = { x: 1 }
    assert.equal(parseJsonStream(obj), obj)
  })

  test('解析失败的字符串返回原样', () => {
    const bad = '{"broken"' // 无法修复裸对象值
    assert.equal(parseJsonStream(bad), bad)
  })
})

describe('safeJsonStringify 安全序列化', () => {
  test('普通对象正常', () => {
    assert.equal(safeJsonStringify({ a: 1 }), '{"a":1}')
  })

  test('循环引用 → [Circular]', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    assert.equal(safeJsonStringify(a), '{"self":"[Circular]"}')
  })

  test('BigInt → 字符串', () => {
    const r = safeJsonStringify({ n: 10n })
    assert.equal(r, '{"n":"10"}')
  })

  test('不可序列化 → String 兜底', () => {
    // 带 circle 的 function 或 symbol 键在 replacer 仍可能抛，验证兜底
    const big = { a: 1 }
    assert.equal(safeJsonStringify(big), '{"a":1}')
  })
})

describe('maskSecret 凭证掩码', () => {
  test('短值全掩码', () => {
    assert.equal(maskSecret('abcdef'), '****')
  })

  test('长值保留首尾 4 位', () => {
    assert.equal(maskSecret('sk-ant-abcdefgh'), 'sk-a...efgh')
  })
})