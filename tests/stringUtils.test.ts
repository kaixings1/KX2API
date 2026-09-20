/**
 * tests/stringUtils.test.ts — 字符串工具函数测试
 *
 * 运行：node --import tsx --test tests/stringUtils.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  escapeRegExp,
  capitalize,
  plural,
  firstLineOf,
  countCharInString,
  normalizeFullWidthDigits,
  normalizeFullWidthSpace,
  safeJoinLines,
  EndTruncatingAccumulator,
  truncateToLines,
} from '../src/utils/stringUtils.ts'

describe('基础字符串函数', () => {
  test('escapeRegExp 转义特殊字符', () => {
    assert.equal(escapeRegExp('a.b*c'), 'a\\.b\\*c')
    assert.equal(escapeRegExp('hello'), 'hello')
  })

  test('capitalize 首字母大写不改变其余', () => {
    assert.equal(capitalize('fooBar'), 'FooBar')
    assert.equal(capitalize('hello world'), 'Hello world')
  })

  test('plural 单复数', () => {
    assert.equal(plural(1, 'file'), 'file')
    assert.equal(plural(3, 'file'), 'files')
    assert.equal(plural(2, 'entry', 'entries'), 'entries')
  })

  test('firstLineOf 取首行', () => {
    assert.equal(firstLineOf('#!/bin/sh\nrest'), '#!/bin/sh')
    assert.equal(firstLineOf('no newline'), 'no newline')
  })

  test('countCharInString', () => {
    assert.equal(countCharInString('a-b-c', '-'), 2)
    assert.equal(countCharInString('abc', '-'), 0)
  })
})

describe('全角归一化', () => {
  test('全角数字→半角', () => {
    assert.equal(normalizeFullWidthDigits('１2３'), '123')
  })
  test('全角空格→半角', () => {
    assert.equal(normalizeFullWidthSpace('a\u3000b'), 'a b')
  })
})

describe('safeJoinLines / truncateToLines', () => {
  test('safeJoinLines 正常连接', () => {
    assert.equal(safeJoinLines(['a', 'b'], ','), 'a,b')
  })
  test('safeJoinLines 超限截断', () => {
    const out = safeJoinLines(['abcdef', 'ghij'], ',', 10)
    assert.ok(out.includes('[truncated]'))
  })
  test('truncateToLines 截断到行数+省略号', () => {
    assert.equal(truncateToLines('a\nb\nc', 2), 'a\nb…')
  })
  test('truncateToLines 未超限原样', () => {
    assert.equal(truncateToLines('a\nb', 5), 'a\nb')
  })
})

describe('EndTruncatingAccumulator', () => {
  test('未超限正常累积', () => {
    const acc = new EndTruncatingAccumulator(100)
    acc.append('hello')
    acc.append(' world')
    assert.equal(acc.toString(), 'hello world')
    assert.equal(acc.truncated, false)
  })
  test('超限截断并标记', () => {
    const acc = new EndTruncatingAccumulator(10)
    acc.append('hello world foo')
    assert.equal(acc.truncated, true)
    assert.ok(acc.toString().includes('truncated'), '应含截断标记')
    assert.ok(acc.length <= 10, '不应超过上限')
  })
  test('clear 重置', () => {
    const acc = new EndTruncatingAccumulator(10)
    acc.append('abcdefghij')
    acc.clear()
    assert.equal(acc.toString(), '')
    assert.equal(acc.totalBytes, 0)
  })
})