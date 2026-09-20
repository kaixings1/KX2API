/**
 * tests/tokenBudget.test.ts — 自然语言 token 预算解析测试
 *
 * 运行：node --import tsx --test tests/tokenBudget.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseTokenBudget,
  findTokenBudgetPositions,
  getBudgetContinuationMessage,
} from '../src/utils/tokenBudget.ts'

describe('parseTokenBudget 各类写法', () => {
  test('前缀缩写 k/m/b', () => {
    assert.equal(parseTokenBudget('+500k'), 500_000)
    assert.equal(parseTokenBudget('+2M'), 2_000_000)
    assert.equal(parseTokenBudget('+1.5m'), 1_500_000)
  })

  test('行尾缩写', () => {
    assert.equal(parseTokenBudget('预算 +300k'), 300_000)
  })

  test('自然语言 use/spend', () => {
    assert.equal(parseTokenBudget('use 2M tokens'), 2_000_000)
    assert.equal(parseTokenBudget('spend 300k tokens'), 300_000)
  })

  test('无匹配返回 null', () => {
    assert.equal(parseTokenBudget('hello world'), null)
    assert.equal(parseTokenBudget(''), null)
  })
})

describe('findTokenBudgetPositions', () => {
  test('定位前缀表达式位置（须在行首）', () => {
    const pos = findTokenBudgetPositions('+500k 剩余')
    assert.equal(pos.length, 1)
    const text = '+500k 剩余'
    assert.equal(text.slice(pos[0].start, pos[0].end), '+500k')
  })

  test('定位行尾表达式位置', () => {
    const pos = findTokenBudgetPositions('预算 +300k')
    assert.equal(pos.length, 1)
    const text = '预算 +300k'
    assert.equal(text.slice(pos[0].start, pos[0].end), '+300k')
  })

  test('定位自然语言表达式', () => {
    const pos = findTokenBudgetPositions('需要 use 500k tokens 本次')
    assert.equal(pos.length, 1)
  })
})

describe('getBudgetContinuationMessage', () => {
  test('生成提示消息', () => {
    const m = getBudgetContinuationMessage(85, 850000, 1000000)
    assert.ok(m.includes('85%'))
    assert.ok(m.includes('850,000'))
    assert.ok(m.includes('1,000,000'))
  })
})