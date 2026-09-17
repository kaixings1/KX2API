import { describe, it, expect } from 'vitest'
import {
  absorb,
  absorbText,
  absorbIfWorthwhile,
  createAbsorbSession,
  extractSegments,
  DEFAULT_ABSORB_OPTIONS,
} from '../../engine/absorb'

/**
 * 这些用例同时是「上游 4 个 bug 已修复」的回归防线：
 *   ① 缓存写入早于相似判定 → 被丢弃块的指纹污染缓存 → 返回空字符串
 *   ② join('\n\n') 重建 → 空行/缩进丢失、Markdown 被拆
 *   ③ pass 顺序 → 前一步成果被覆盖
 *   ④ 缺长度闸 → 超大文本全量跑
 */

describe('默认值与上游口径一致', () => {
  it('关键阈值保持上游取值', () => {
    expect(DEFAULT_ABSORB_OPTIONS.minRepeat).toBe(2)
    expect(DEFAULT_ABSORB_OPTIONS.minRepeatLines).toBe(3)
    expect(DEFAULT_ABSORB_OPTIONS.minBlockSize).toBe(30)
    expect(DEFAULT_ABSORB_OPTIONS.similarityThreshold).toBe(0.88)
    expect(DEFAULT_ABSORB_OPTIONS.maxInputLength).toBe(500_000)
  })
})

describe('Pass 1：行级吸收', () => {
  it('连续相同行只保留 1 份', () => {
    // 4 份相同 → 留 1 份，去掉 3 份
    const r = absorb('same\nsame\nsame\nsame\nother', { consecutive: false, structural: false })
    expect(r.text).toBe('same\nother')
    expect(r.stats.lines).toBe(3)
  })

  it('不足阈值时原样保留', () => {
    const r = absorb('a\na\nb', { minRepeatLines: 3, consecutive: false, structural: false })
    expect(r.text).toBe('a\na\nb')
  })

  it('空行不参与吸收（空行是格式的一部分）', () => {
    const r = absorb('x\n\n\n\n\ny', { consecutive: false, structural: false })
    expect(r.text).toBe('x\n\n\n\n\ny')
  })

  it('非相邻的重复行不被吸收', () => {
    const r = absorb('a\nb\na', { consecutive: false, structural: false })
    expect(r.text).toBe('a\nb\na')
  })
})

describe('Pass 2：连续块吸收', () => {
  const block = 'line1\nline2\nline3'
  const dup = `${block}\n\n${block}\n\n${block}`

  it('连续相同块只保留 1 份', () => {
    const r = absorb(dup, { lines: false, structural: false })
    expect(r.text).toBe(block)
    expect(r.stats.consecutive).toBe(2)
  })

  it('保留块之间的空行与缩进（bug ② 回归）', () => {
    const src = 'A\n  indented\n\n\nB\n\nC'
    const r = absorb(src, { lines: false, structural: false })
    // 没有连续重复块，应逐字节不变
    expect(r.text).toBe(src)
  })

  it('Markdown 列表与表格在无重复时逐字节保留', () => {
    const md = [
      '| a | b |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '- item1',
      '- item2',
      '',
      '```js',
      'const x = 1',
      '```',
    ].join('\n')
    const r = absorb(md, { lines: false, consecutive: false, structural: false })
    expect(r.text).toBe(md)
  })

  it('吸收后不破坏代码块结构', () => {
    const code = '```js\nconst a = 1\n```'
    const src = `${code}\n\n${code}\n\n尾部`
    const r = absorb(src, { lines: false, structural: false })
    expect(r.text).toBe(`${code}\n\n尾部`)
    expect(r.text.split('```').length - 1).toBe(2) // 围栏成对
  })
})

describe('Pass 3：结构化去重', () => {
  it('同一大块在文中出现两次时只留一份', () => {
    const big = 'x'.repeat(200)
    const src = `前缀\n\n${big}\n\n中间\n\n${big}\n\n后缀`
    const r = absorb(src, { lines: false, consecutive: false })
    expect(r.text.split(big).length - 1).toBe(1)
    expect(r.text).toContain('前缀')
    expect(r.text).toContain('中间')
    expect(r.text).toContain('后缀')
  })

  it('小于 minBlockSize 的块不被去重（防破坏语法）', () => {
    const src = '}\n\n}\n\n}\n\nreal content here'
    const r = absorb(src, { lines: false, consecutive: false, minBlockSize: 30 })
    expect(r.text).toBe(src)
  })

  it('结构相同但内容不同的块都保留', () => {
    const a = `{${'a'.repeat(150)}}`
    const b = `{${'b'.repeat(150)}}`
    const r = absorb(`${a}\n\n${b}`, { lines: false, consecutive: false })
    expect(r.text).toContain(a)
    expect(r.text).toContain(b)
  })
})

describe('bug ① 回归：缓存写入时机', () => {
  it('把同一段内容送入 session 两次，第二次才允许删除', () => {
    const session = createAbsorbSession()
    const big = 'y'.repeat(300)
    const text = `头\n\n${big}\n\n尾`

    const first = absorb(text, { lines: false, consecutive: false }, session)
    expect(first.text).toContain(big) // 首次必须保留

    const second = absorb(text, { lines: false, consecutive: false }, session)
    expect(second.stats.crossCall).toBe(1)
  })

  it('被相似度判定丢弃的块不污染缓存（上游会污染）', () => {
    const session = createAbsorbSession()
    // A 与 B 高度相似但不同；B 会被相似度规则丢弃
    const a = `const value = "${'a'.repeat(180)}"`
    const b = `const value = "${'a'.repeat(179)}b"`
    absorb(`${a}\n\n${b}`, { lines: false, consecutive: false }, session)
    // 缓存里不应出现被丢弃块的内容
    expect(session.seen.has(b.replace(/\s+/g, '').toLowerCase())).toBe(false)
  })
})

describe('安全兜底：绝不把非空内容压成空', () => {
  it('整段被删空时回退原文', () => {
    const session = createAbsorbSession()
    const only = `w${'z'.repeat(250)}`
    // 先让 session 记住这段
    absorb(only, { lines: false, consecutive: false }, session)
    // 再单独送同一段：全部命中跨调用去重 → 若不兜底会返回空串
    const r = absorb(only, { lines: false, consecutive: false }, session)
    expect(r.text.trim()).not.toBe('')
    expect(r.text).toBe(only)
  })

  it('空输入安全', () => {
    const r = absorb('')
    expect(r.text).toBe('')
    expect(r.skipped).toBe(false)
  })

  it('纯空白输入安全', () => {
    const r = absorb('   \n\n  ')
    expect(r.text).toBe('   \n\n  ')
  })
})

describe('bug ④ 回归：长度闸', () => {
  it('超过 maxInputLength 时跳过并原样返回', () => {
    const huge = 'q'.repeat(1000)
    const r = absorb(huge, { maxInputLength: 100 })
    expect(r.skipped).toBe(true)
    expect(r.text).toBe(huge)
    expect(r.saved).toBe(0)
  })

  it('恰好等于上限时不跳过', () => {
    const exact = 'q'.repeat(100)
    const r = absorb(exact, { maxInputLength: 100 })
    expect(r.skipped).toBe(false)
  })
})

describe('bug ③ 回归：pass 顺序', () => {
  it('三段成果叠加而非互相覆盖（上游 Pass 3 会被 Pass 4 覆盖）', () => {
    // 构造让三段都有事可做的输入：
    //   - 行级：三行相同的 "aaa"
    //   - 连续块：两块相同的大块
    //   - 结构化：同一大块再次出现
    const big = 'B'.repeat(200)
    const blockA = `aaa\naaa\naaa\n${big}`
    const src = `${blockA}\n\n${blockA}\n\n${big}`

    const r = absorb(src)

    // 关键是三段统计都 > 0：若 Pass 3 被覆盖，structural 会是 0
    expect(r.stats.lines).toBeGreaterThan(0)
    expect(r.stats.consecutive).toBeGreaterThan(0)
    expect(r.stats.structural).toBeGreaterThan(0)
    expect(r.saved).toBeGreaterThan(0)
    expect(r.text.length).toBeLessThan(src.length)
  })

  it('行级吸收的成果不会被后续段落覆盖', () => {
    const src = 'aaa\naaa\naaa\naaa\n-----\n各自不同的一行'
    const r = absorb(src, { consecutive: false, structural: false })
    expect(r.stats.lines).toBe(3)
    expect(r.text).toBe('aaa\n-----\n各自不同的一行')
  })
})

describe('统计与结果字段', () => {
  it('saved / ratio 计算正确', () => {
    const src = 'a\na\na\nb'
    const r = absorb(src, { consecutive: false, structural: false })
    expect(r.originalSize).toBe(src.length)
    expect(r.compressedSize).toBe(r.text.length)
    expect(r.saved).toBe(r.originalSize - r.compressedSize)
    expect(r.ratio).toBeCloseTo(r.saved / r.originalSize, 6)
  })

  it('无重复时 saved 为 0、文本逐字节不变', () => {
    const src = 'one\ntwo\nthree'
    const r = absorb(src)
    expect(r.saved).toBe(0)
    expect(r.text).toBe(src)
  })
})

describe('absorbText / absorbIfWorthwhile', () => {
  it('absorbText 只返回文本', () => {
    expect(typeof absorbText('a\na\na')).toBe('string')
  })

  it('收益不足阈值时返回原文', () => {
    const src = 'long text without repeats here'
    expect(absorbIfWorthwhile(src, 0.5)).toBe(src)
  })

  it('收益足够时返回压缩结果', () => {
    const src = 'dup\ndup\ndup\ndup\ndup\ndup\ndup\ndup'
    expect(absorbIfWorthwhile(src, 0.1)).toBe('dup')
  })

  it('跳过压缩时返回原文', () => {
    const huge = 'z'.repeat(2000)
    expect(absorbIfWorthwhile(huge, 0.1, { maxInputLength: 10 })).toBe(huge)
  })
})

describe('extractSegments 偏移正确性', () => {
  it('段落的 [start, end) 能在原文中精确切回', () => {
    const src = 'aaa\n\n```js\ncode\n```\n\nbbb'
    for (const seg of extractSegments(src)) {
      expect(src.slice(seg.start, seg.end)).toBe(seg.text)
    }
  })

  it('识别代码围栏', () => {
    const segs = extractSegments('text\n\n```js\nconst a = 1\n```\n\nmore')
    expect(segs.some(s => s.type === 'codeblock')).toBe(true)
  })

  it('识别 XML 块', () => {
    const segs = extractSegments('<root>\n  <a>1</a>\n</root>')
    expect(segs.some(s => s.type === 'xml')).toBe(true)
  })

  it('识别 JSON 块', () => {
    const segs = extractSegments('{\n  "a": 1\n}')
    expect(segs.some(s => s.type === 'json')).toBe(true)
  })

  it('空文本返回空数组', () => {
    expect(extractSegments('')).toEqual([])
  })
})

describe('不破坏原文的边界情形', () => {
  it('CRLF 输入不会被破坏成混杂换行', () => {
    const src = 'a\r\nb\r\nc'
    const r = absorb(src)
    expect(r.text).toBe(src)
  })

  it('长文本性能不退化（超上限直接跳过）', () => {
    const huge = 'x'.repeat(600_000)
    const t0 = Date.now()
    const r = absorb(huge)
    expect(r.skipped).toBe(true)
    expect(Date.now() - t0).toBeLessThan(100)
  })
})
