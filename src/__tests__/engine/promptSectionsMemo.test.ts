import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  memoizeByKey,
  invalidateMemoized,
  invalidateMemoizedByPrefix,
  getMemoizedCacheSize,
  clearSectionCache,
} from '../../engine/promptSections'

/**
 * 泛型缓存（memoizeByKey）的契约。
 *
 * 它存在的理由：分片缓存只支持字符串，但像「记忆召回」这类昂贵计算
 * 返回的是列表 —— 缓存原始结果、每轮再做依赖历史的过滤，
 * 比缓存最终文本更灵活（缓存文本会让历史变化读到过期结果）。
 */
describe('memoizeByKey', () => {
  beforeEach(() => clearSectionCache())

  it('同一 key 只计算一次', async () => {
    const fn = vi.fn(async () => [1, 2, 3])
    await memoizeByKey('k1', fn)
    await memoizeByKey('k1', fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('返回缓存的值本身（数组等非字符串类型保持原样）', async () => {
    const arr = [{ a: 1 }, { b: 2 }]
    const r1 = await memoizeByKey('k2', async () => arr)
    const r2 = await memoizeByKey('k2', async () => [])
    expect(r1).toEqual(arr)
    expect(r2).toEqual(arr)
    expect(Array.isArray(r2)).toBe(true)
  })

  it('不同 key 各自计算', async () => {
    const fn1 = vi.fn(async () => 'a')
    const fn2 = vi.fn(async () => 'b')
    await memoizeByKey('x', fn1)
    await memoizeByKey('y', fn2)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  it('并发同 key 共享同一次计算（避免重复昂贵调用）', async () => {
    let calls = 0
    const slow = async () => {
      calls++
      await new Promise(r => setTimeout(r, 20))
      return 'value'
    }
    const [a, b, c] = await Promise.all([
      memoizeByKey('cc', slow),
      memoizeByKey('cc', slow),
      memoizeByKey('cc', slow),
    ])
    expect(calls).toBe(1)
    expect(a).toBe('value')
    expect(b).toBe('value')
    expect(c).toBe('value')
  })

  it('计算抛错时不缓存失败结果（下次可重试）', async () => {
    let attempts = 0
    const failing = async () => {
      attempts++
      if (attempts === 1) throw new Error('boom')
      return 'ok'
    }
    await expect(memoizeByKey('f', failing)).rejects.toThrow('boom')
    // 第二次应重新计算而非拿到缓存的异常
    expect(await memoizeByKey('f', failing)).toBe('ok')
    expect(attempts).toBe(2)
  })

  it('抛错后 inflight 被清理（不会永久卡住该 key）', async () => {
    await expect(
      memoizeByKey('g', async () => {
        throw new Error('x')
      }),
    ).rejects.toThrow()
    // 能重新进入（若 inflight 泄漏，这里会拿到旧 Promise）
    expect(await memoizeByKey('g', async () => 'recovered')).toBe('recovered')
  })

  it('缓存 null 与 undefined 也算命中', async () => {
    const fn = vi.fn(async () => null)
    await memoizeByKey('n', fn)
    await memoizeByKey('n', fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('invalidateMemoized 只清除指定键', async () => {
    const f1 = vi.fn(async () => 1)
    const f2 = vi.fn(async () => 2)
    await memoizeByKey('a', f1)
    await memoizeByKey('b', f2)
    invalidateMemoized('a')
    await memoizeByKey('a', f1)
    await memoizeByKey('b', f2)
    expect(f1).toHaveBeenCalledTimes(2)
    expect(f2).toHaveBeenCalledTimes(1)
  })

  it('invalidateMemoizedByPrefix 批量清除', async () => {
    const m1 = vi.fn(async () => 1)
    const m2 = vi.fn(async () => 2)
    const other = vi.fn(async () => 3)
    await memoizeByKey('memory-recall:1', m1)
    await memoizeByKey('memory-recall:2', m2)
    await memoizeByKey('tool:1', other)

    invalidateMemoizedByPrefix('memory-recall:')

    await memoizeByKey('memory-recall:1', m1)
    await memoizeByKey('memory-recall:2', m2)
    await memoizeByKey('tool:1', other)

    expect(m1).toHaveBeenCalledTimes(2)
    expect(m2).toHaveBeenCalledTimes(2)
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('clearSectionCache 同时清空泛型缓存', async () => {
    const fn = vi.fn(async () => 'v')
    await memoizeByKey('clear-me', fn)
    clearSectionCache()
    await memoizeByKey('clear-me', fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('getMemoizedCacheSize 反映条目数', async () => {
    clearSectionCache()
    await memoizeByKey('s1', async () => 1)
    await memoizeByKey('s2', async () => 2)
    expect(getMemoizedCacheSize()).toBe(2)
  })

  it('缓存条目数受限（不会无限增长）', async () => {
    clearSectionCache()
    for (let i = 0; i < 300; i++) {
      await memoizeByKey(`bulk-${i}`, async () => i)
    }
    expect(getMemoizedCacheSize()).toBeLessThanOrEqual(200)
  })
})
