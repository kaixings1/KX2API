/**
 * tests/words.test.ts — 随机词 slug 生成测试
 *
 * 运行：node --import tsx --test tests/words.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { generateWordSlug, generateShortWordSlug } from '../src/utils/words.ts'

describe('generateWordSlug 三词 slug', () => {
  test('返回形容词-动词-名词 三段式', () => {
    const slug = generateWordSlug()
    const parts = slug.split('-')
    assert.equal(parts.length, 3, `应有 3 段，实际 ${slug}`)
  })

  test('每次生成随机且可重复调用', () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateWordSlug()))
    assert.ok(seen.size > 1, '应产生随机变体')
  })
})

describe('generateShortWordSlug 两词 slug', () => {
  test('返回形容词-名词 两段式', () => {
    const slug = generateShortWordSlug()
    assert.equal(slug.split('-').length, 2)
  })

  test('非空字符串', () => {
    assert.ok(generateShortWordSlug().length > 0)
  })
})