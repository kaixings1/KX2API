/**
 * tests/treeify.test.ts — 对象树状渲染测试
 *
 * 运行：node --import tsx --test tests/treeify.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { treeify } from '../src/utils/treeify.ts'

describe('treeify 基础渲染', () => {
  test('单层键值', () => {
    const out = treeify({ a: 1, b: 'x' })
    assert.ok(out.includes('├ a: 1'))
    assert.ok(out.includes('└ b: x'), '最后一项用 └')
  })

  test('嵌套对象缩进', () => {
    const out = treeify({ parent: { child: 1 } })
    assert.ok(out.includes('└ parent'))
    assert.ok(out.includes('child: 1'), 'child 应有值')
  })

  test('数组节点展示长度', () => {
    const out = treeify({ list: [1, 2, 3] })
    assert.ok(out.includes('[Array(3)]'))
  })

  test('空对象返回 (empty)', () => {
    assert.equal(treeify({}), '(empty)')
  })

  test('循环引用 → [Circular]', () => {
    const obj: Record<string, unknown> = { a: { b: 1 } }
    ;(obj.a as Record<string, unknown>).self = obj.a
    const out = treeify(obj)
    assert.ok(out.includes('[Circular]'))
  })

  test('hideFunctions 过滤函数字段', () => {
    const obj = { fn: () => 1, x: 2 }
    const out = treeify(obj, { hideFunctions: true })
    assert.ok(!out.includes('fn'), '函数字段应被过滤')
    assert.ok(out.includes('x: 2'))
  })

  test('showValues=false 隐藏值', () => {
    const out = treeify({ a: 1 }, { showValues: false })
    assert.ok(!out.includes('1'))
  })
})