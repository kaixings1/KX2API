import { describe, it, expect } from 'vitest'
import {
  stringWidth,
  codePointWidth,
  segmentGraphemes,
  truncateToWidth,
  truncateStartToWidth,
  truncateToWidthNoEllipsis,
  truncatePathMiddle,
  truncate,
  wrapText,
} from '../../shared/textTruncate'

/**
 * 这个模块存在的理由：`str.length` 截断会劈坏内容。
 * 因此测试的重点不是「截到几位」，而是「有没有劈坏」。
 */

/** 检查字符串是否含未配对的代理项（劈坏的标志） */
function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true
      i++
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true
    }
  }
  return false
}

describe('stringWidth — 显示宽度而非字符数', () => {
  it('ASCII 计 1', () => {
    expect(stringWidth('abc')).toBe(3)
  })

  it('中文计 2', () => {
    expect(stringWidth('中文')).toBe(4)
    expect(stringWidth('你好世界')).toBe(8)
  })

  it('日文假名与韩文计 2', () => {
    expect(stringWidth('ひらがな')).toBe(8)
    expect(stringWidth('한글')).toBe(4)
  })

  it('全角标点计 2，半角计 1', () => {
    expect(stringWidth('。')).toBe(2)
    expect(stringWidth('，')).toBe(2)
    expect(stringWidth('.')).toBe(1)
    expect(stringWidth(',')).toBe(1)
  })

  it('emoji 计 2（且不按代理对计成 2 个字符）', () => {
    expect(stringWidth('😀')).toBe(2)
    expect('😀'.length).toBe(2) // 确实是代理对
  })

  it('组合字符计 0（变音符不占宽度）', () => {
    // e + U+0301（组合尖音符）
    expect(stringWidth('e\u0301')).toBe(1)
  })

  it('零宽字符计 0', () => {
    expect(stringWidth('\u200b')).toBe(0)
    expect(stringWidth('\ufeff')).toBe(0)
  })

  it('控制字符计 0', () => {
    expect(stringWidth('\u0000\u0007')).toBe(0)
  })

  it('中英混排累加正确', () => {
    expect(stringWidth('abc中文')).toBe(3 + 4)
  })

  it('空串为 0', () => {
    expect(stringWidth('')).toBe(0)
  })
})

describe('codePointWidth', () => {
  it('典型码点宽度', () => {
    expect(codePointWidth(0x41)).toBe(1) // A
    expect(codePointWidth(0x4e2d)).toBe(2) // 中
    expect(codePointWidth(0x1f600)).toBe(2) // 😀
    expect(codePointWidth(0x0301)).toBe(0) // 组合符
  })
})

describe('segmentGraphemes', () => {
  it('代理对不被拆开', () => {
    const segs = segmentGraphemes('a😀b')
    expect(segs.join('')).toBe('a😀b')
    expect(segs.every(s => !hasLoneSurrogate(s))).toBe(true)
  })

  it('切分后可无损拼回', () => {
    const src = '中文😀abc\u0301'
    expect(segmentGraphemes(src).join('')).toBe(src)
  })
})

describe('truncateToWidth', () => {
  it('未超宽时原样返回', () => {
    expect(truncateToWidth('abc', 10)).toBe('abc')
  })

  it('超宽时加省略号且总宽不超限', () => {
    const r = truncateToWidth('abcdefghij', 5)
    expect(stringWidth(r)).toBeLessThanOrEqual(5)
    expect(r.endsWith('…')).toBe(true)
  })

  it('中文按宽度截断（不是按字符数）', () => {
    // 10 个中文 = 20 列宽；限制 10 列 → 最多 4 个中文 + 省略号
    const r = truncateToWidth('一二三四五六七八九十', 10)
    expect(stringWidth(r)).toBeLessThanOrEqual(10)
    expect(r).toBe('一二三四…')
  })

  it('不劈坏 emoji（模拟代理对）', () => {
    const r = truncateToWidth('a😀😀😀b', 5)
    expect(hasLoneSurrogate(r)).toBe(false)
    expect(stringWidth(r)).toBeLessThanOrEqual(5)
  })

  it('maxWidth <= 1 时只返回省略号', () => {
    expect(truncateToWidth('abc', 1)).toBe('…')
    expect(truncateToWidth('abc', 0)).toBe('…')
  })

  it('不会因为省略号而超出限制', () => {
    for (const w of [2, 3, 4, 5, 6, 7, 8]) {
      const r = truncateToWidth('中文测试字符串', w)
      expect(stringWidth(r)).toBeLessThanOrEqual(w)
    }
  })
})

describe('truncateStartToWidth', () => {
  it('保留尾部', () => {
    expect(truncateStartToWidth('abcdefghij', 5)).toBe('…ghij')
  })

  it('中文按宽度', () => {
    const r = truncateStartToWidth('一二三四五六七八九十', 10)
    expect(r.startsWith('…')).toBe(true)
    expect(stringWidth(r)).toBeLessThanOrEqual(10)
  })

  it('未超宽时原样返回', () => {
    expect(truncateStartToWidth('abc', 10)).toBe('abc')
  })

  it('不劈坏 emoji', () => {
    expect(hasLoneSurrogate(truncateStartToWidth('😀😀😀abc', 5))).toBe(false)
  })

  it('maxWidth <= 1', () => {
    expect(truncateStartToWidth('abc', 1)).toBe('…')
  })
})

describe('truncateToWidthNoEllipsis', () => {
  it('不加省略号', () => {
    expect(truncateToWidthNoEllipsis('abcdefgh', 3)).toBe('abc')
  })

  it('未超宽时原样', () => {
    expect(truncateToWidthNoEllipsis('ab', 5)).toBe('ab')
  })

  it('maxWidth <= 0 返回空', () => {
    expect(truncateToWidthNoEllipsis('abc', 0)).toBe('')
  })
})

describe('truncatePathMiddle — 保留目录头与文件名', () => {
  it('中段省略，文件名完整保留', () => {
    const p = 'src/components/deeply/nested/folder/MyComponent.tsx'
    const r = truncatePathMiddle(p, 30)
    expect(r).toContain('MyComponent.tsx')
    expect(r).toContain('…')
    expect(stringWidth(r)).toBeLessThanOrEqual(30)
  })

  it('未超宽时原样返回', () => {
    const p = 'src/a.ts'
    expect(truncatePathMiddle(p, 30)).toBe(p)
  })

  it('Windows 反斜杠路径能取出文件名', () => {
    const r = truncatePathMiddle('D:\\projects\\very\\deep\\nested\\file.ts', 20)
    expect(r).toContain('file.ts')
    expect(stringWidth(r)).toBeLessThanOrEqual(20)
  })

  it('中文路径按宽度截断', () => {
    const p = '项目/组件/很深的/嵌套/文件夹/我的组件.tsx'
    const r = truncatePathMiddle(p, 20)
    expect(stringWidth(r)).toBeLessThanOrEqual(20)
  })

  it('文件名本身就超宽时保留尾部', () => {
    const p = 'dir/' + 'a'.repeat(50) + '.tsx'
    const r = truncatePathMiddle(p, 10)
    expect(stringWidth(r)).toBeLessThanOrEqual(10)
    expect(r.startsWith('…')).toBe(true)
  })

  it('极小的 maxWidth 不崩', () => {
    expect(truncatePathMiddle('a/b/c.ts', 0)).toBe('…')
    expect(() => truncatePathMiddle('a/b/c.ts', 3)).not.toThrow()
    expect(() => truncatePathMiddle('a/b/c.ts', -5)).not.toThrow()
  })

  it('无目录分隔符时退化为普通截断', () => {
    const r = truncatePathMiddle('abcdefghijklmnop', 5)
    expect(stringWidth(r)).toBeLessThanOrEqual(5)
  })

  it('常见层级路径结果可读', () => {
    const r = truncatePathMiddle('src/main/tools/toolManager.ts', 25)
    expect(r).toContain('toolManager.ts')
    expect(r).toContain('…')
  })
})

describe('truncate — 通用入口', () => {
  it('未超宽原样返回', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('单行模式截断到首个换行', () => {
    const r = truncate('first line\nsecond line', 100, true)
    expect(r).toBe('first line…')
  })

  it('单行模式且首行超宽时按宽度截', () => {
    const r = truncate('averylongfirstline\nsecond', 5, true)
    expect(stringWidth(r)).toBeLessThanOrEqual(5)
  })

  it('多行模式不处理换行', () => {
    const r = truncate('ab\ncd', 100)
    expect(r).toBe('ab\ncd')
  })

  it('多行且超宽时整体截断', () => {
    const r = truncate('abcdefghij', 5)
    expect(stringWidth(r)).toBeLessThanOrEqual(5)
  })
})

describe('wrapText', () => {
  it('按宽度折行', () => {
    expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('中文按双列宽折行', () => {
    const lines = wrapText('一二三四五六', 4) // 每行 2 个中文
    expect(lines).toEqual(['一二', '三四', '五六'])
  })

  it('不劈坏 emoji', () => {
    const lines = wrapText('😀😀😀', 2)
    expect(lines.every(l => !hasLoneSurrogate(l))).toBe(true)
    expect(lines.join('')).toBe('😀😀😀')
  })

  it('width <= 0 时返回整块', () => {
    expect(wrapText('abc', 0)).toEqual(['abc'])
  })

  it('空串返回空数组', () => {
    expect(wrapText('', 10)).toEqual([])
  })

  it('折行后拼回等于原文（无损）', () => {
    const src = '混合 mixed 文本 😀 with emoji'
    expect(wrapText(src, 7).join('')).toBe(src)
  })
})
