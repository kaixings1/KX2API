/**
 * tests/memoize.test.ts — 记忆化缓存测试
 *
 * 运行：node --import tsx --test tests/memoize.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  memoizeWithTTL,
  memoizeWithTTLAsync,
  memoizeWithLRU,
} from '../src/utils/memoize.ts'

describe('memoizeWithTTL 同步缓存', () => {
  test('命中缓存不重算', () => {
    let calls = 0
    const f = memoizeWithTTL((x: number) => { calls++; return x * 2 })
    assert.equal(f(2), 4)
    assert.equal(f(2), 4)
    assert.equal(calls, 1)
  })

  test('不同参数分别缓存', () => {
    let calls = 0
    const f = memoizeWithTTL((x: number) => { calls++; return x })
    f(1); f(2); f(1)
    assert.equal(calls, 2)
  })

  test('cache.clear 清除', () => {
    let calls = 0
    const f = memoizeWithTTL((x: number) => { calls++; return x })
    f(1); f(1)
    f.cache.clear()
    f(1)
    assert.equal(calls, 2)
  })
})

describe('memoizeWithTTLAsync 异步 + 并发去重', () => {
  test('冷却并发只调用一次', async () => {
    let calls = 0
    const f = memoizeWithTTLAsync(async (x: number) => {
      calls++
      await new Promise(r => setTimeout(r, 10))
      return x
    })
    const [a, b] = await Promise.all([f(1), f(1), f(1)])
    assert.equal(calls, 1, '冷却并发应共享一次调用')
    assert.equal(a, 1)
    assert.equal(b, 1)
  })

  test('缓存命中不重算', async () => {
    let calls = 0
    const f = memoizeWithTTLAsync(async () => { calls++; return calls })
    await f()
    await f()
    assert.equal(calls, 1)
  })
})

describe('memoizeWithLRU LRU 逐出', () => {
  test('超过 maxSize 淘汰旧项', () => {
    let calls = 0
    const f = memoizeWithLRU(
      (x: number) => { calls++; return x },
      (x: number) => String(x),
      2,
    )
    f(1); f(2); f(3)  // 1 被淘汰
    assert.equal(calls, 3)
    f(2)  // 命中
    f(1)  // 已淘汰，重算
    assert.equal(calls, 4)
  })

  test('cache.size / has / delete', () => {
    let calls = 0
    const f = memoizeWithLRU((x: number) => { calls++; return x }, x => String(x), 5)
    f(1); f(2)
    assert.equal(f.cache.size(), 2)
    assert.equal(f.cache.has('1'), true)
    f.cache.delete('1')
    assert.equal(f.cache.has('1'), false)
  })
})