import { describe, it, expect, beforeEach } from 'vitest'
import {
  section,
  volatileSection,
  resolveSections,
  composeSections,
  buildPromptFromSections,
  checkSectionOrder,
  clearSectionCache,
  invalidateSection,
  invalidateSectionsByPrefix,
  getSectionCacheSize,
  fingerprint,
  type PromptSection,
} from '../../engine/promptSections'

/**
 * 分片缓存的核心契约：
 *   1. 稳定分片只计算一次（工具循环每轮都会重组 system 提示，不缓存等于每轮重算）
 *   2. volatile 分片每轮重算
 *   3. 失效接口能精确/按前缀作废
 *   4. 单个分片失败不拖垮整体组装
 */
describe('分片缓存', () => {
  beforeEach(() => clearSectionCache())

  it('稳定分片命中缓存，compute 只执行一次', async () => {
    let calls = 0
    const s = section('stable', () => {
      calls++
      return `value-${calls}`
    })

    const a = await resolveSections([s])
    const b = await resolveSections([s])

    expect(a).toEqual(['value-1'])
    expect(b).toEqual(['value-1'])
    expect(calls).toBe(1)
  })

  it('volatile 分片每轮重算', async () => {
    let calls = 0
    const s = volatileSection(
      'vol',
      () => {
        calls++
        return `v${calls}`
      },
      '测试用：内容每轮不同',
    )

    await resolveSections([s])
    await resolveSections([s])

    expect(calls).toBe(2)
  })

  it('invalidateSection 只作废指定分片', async () => {
    let aCalls = 0
    let bCalls = 0
    const a = section('a', () => { aCalls++; return 'a' })
    const b = section('b', () => { bCalls++; return 'b' })

    await resolveSections([a, b])
    invalidateSection('a')
    await resolveSections([a, b])

    expect(aCalls).toBe(2)
    expect(bCalls).toBe(1)
  })

  it('invalidateSectionsByPrefix 按前缀批量作废', async () => {
    let t1 = 0
    let t2 = 0
    let other = 0
    const s1 = section('toolHint:g1', () => { t1++; return 'x' })
    const s2 = section('toolHint:g2', () => { t2++; return 'y' })
    const s3 = section('memory:1', () => { other++; return 'z' })

    await resolveSections([s1, s2, s3])
    invalidateSectionsByPrefix('toolHint:')
    await resolveSections([s1, s2, s3])

    expect(t1).toBe(2)
    expect(t2).toBe(2)
    expect(other).toBe(1)
  })

  it('clearSectionCache 清空全部', async () => {
    let calls = 0
    const s = section('k', () => { calls++; return 'v' })
    await resolveSections([s])
    clearSectionCache()
    await resolveSections([s])
    expect(calls).toBe(2)
    expect(getSectionCacheSize()).toBe(1)
  })

  it('null / 空串 / 纯空白 都被归一化为「本轮无此段」', async () => {
    clearSectionCache()
    const r = await resolveSections([
      section('n1', () => null),
      section('n2', () => ''),
      section('n3', () => '   \n  '),
      section('n4', () => 'real'),
    ])
    expect(r).toEqual(['real'])
  })

  it('compute 抛异常时降级为 null，不影响其它分片', async () => {
    const r = await resolveSections([
      section('boom', () => { throw new Error('fail') }),
      section('ok', () => 'fine'),
    ])
    expect(r).toEqual(['fine'])
  })

  it('异步 compute 被正确 await', async () => {
    const s = section('async', async () => {
      await new Promise(r => setTimeout(r, 5))
      return 'async-value'
    })
    expect(await resolveSections([s])).toEqual(['async-value'])
  })

  it('保持传入顺序', async () => {
    const r = await resolveSections([
      section('1', () => 'a'),
      section('2', () => 'b'),
      section('3', () => 'c'),
    ])
    expect(r).toEqual(['a', 'b', 'c'])
  })
})

describe('缓存容量', () => {
  beforeEach(() => clearSectionCache())

  it('超过上限时淘汰最旧条目，不会无限增长', async () => {
    for (let i = 0; i < 250; i++) {
      await resolveSections([section(`key-${i}`, () => `v${i}`)])
    }
    expect(getSectionCacheSize()).toBeLessThanOrEqual(200)
  })

  it('LRU：持续访问的热键不会被后续冷数据挤掉', async () => {
    let hotCalls = 0
    const hot = section('hot', () => { hotCalls++; return 'h' })
    await resolveSections([hot])

    for (let i = 0; i < 250; i++) {
      await resolveSections([section(`cold-${i}`, () => `v${i}`)])
      // 每轮都访问一次热键，使其保持"最近使用"
      await resolveSections([hot])
    }

    // 若实现是 FIFO（只按插入顺序淘汰），热键会在此过程中被淘汰 → calls > 1
    expect(hotCalls).toBe(1)
  })

  it('LRU：久未访问的键会被淘汰', async () => {
    let staleCalls = 0
    const stale = section('stale', () => { staleCalls++; return 's' })
    await resolveSections([stale])

    for (let i = 0; i < 250; i++) {
      await resolveSections([section(`filler-${i}`, () => `v${i}`)])
    }

    await resolveSections([stale])
    expect(staleCalls).toBe(2)
  })
})

describe('组装与顺序校验', () => {
  it('composeSections 过滤空片段', () => {
    expect(composeSections(['a', '', '  ', 'b'])).toBe('a\n\nb')
  })

  it('composeSections 空输入返回空串', () => {
    expect(composeSections([])).toBe('')
    expect(composeSections(['', '  '])).toBe('')
  })

  it('支持自定义分隔符', () => {
    expect(composeSections(['a', 'b'], '\n')).toBe('a\nb')
  })

  it('checkSectionOrder：稳定段在易变段之后即违规', () => {
    const bad: PromptSection[] = [
      volatileSection('vol', () => 'v', '理由'),
      section('stableAfter', () => 's'),
    ]
    expect(checkSectionOrder(bad)).toEqual(['stableAfter'])
  })

  it('checkSectionOrder：全稳定或全易变均无违规', () => {
    expect(checkSectionOrder([section('a', () => '1'), section('b', () => '2')])).toEqual([])
    expect(
      checkSectionOrder([
        volatileSection('a', () => '1', 'r'),
        volatileSection('b', () => '2', 'r'),
      ]),
    ).toEqual([])
  })

  it('buildPromptFromSections 组装并按顺序解析', async () => {
    clearSectionCache()
    const out = await buildPromptFromSections([
      section('s1', () => 'STATIC'),
      section('s2', () => 'DYNAMIC'),
    ])
    expect(out).toBe('STATIC\n\nDYNAMIC')
  })

  it('volatileReason 被记录（要求破坏缓存时自证）', () => {
    const s = volatileSection('v', () => 'x', '因为内容随用户输入变化')
    expect(s.volatile).toBe(true)
    expect(s.volatileReason).toBe('因为内容随用户输入变化')
  })
})

describe('fingerprint', () => {
  it('相同输入产生相同指纹', () => {
    expect(fingerprint('hello world')).toBe(fingerprint('hello world'))
  })

  it('不同输入产生不同指纹', () => {
    expect(fingerprint('a')).not.toBe(fingerprint('b'))
  })

  it('长度差异也能区分（防哈希碰撞后无法区分）', () => {
    expect(fingerprint('ab')).not.toBe(fingerprint('ba'))
  })

  it('长文本指纹长度固定，适合做缓存键', () => {
    const long = 'x'.repeat(100_000)
    expect(fingerprint(long).length).toBeLessThan(20)
  })

  it('空串可用', () => {
    expect(fingerprint('')).toBeTruthy()
  })
})
