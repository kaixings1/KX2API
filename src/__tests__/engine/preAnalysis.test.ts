import { describe, it, expect } from 'vitest'
import {
  preAnalysis,
  resolvePreAnalysisOptions,
  DEFAULT_PRE_ANALYSIS_OPTIONS,
} from '../../engine/streaming/streamProcessor'

describe('resolvePreAnalysisOptions', () => {
  it('未传时返回全部默认值', () => {
    expect(resolvePreAnalysisOptions()).toEqual(DEFAULT_PRE_ANALYSIS_OPTIONS)
  })

  it('空值返回全部默认值', () => {
    expect(resolvePreAnalysisOptions(null)).toEqual(DEFAULT_PRE_ANALYSIS_OPTIONS)
  })

  it('部分覆盖，其余保持默认', () => {
    const r = resolvePreAnalysisOptions({ longFunctionLines: 10 })
    expect(r.longFunctionLines).toBe(10)
    expect(r.maxSuggestions).toBe(DEFAULT_PRE_ANALYSIS_OPTIONS.maxSuggestions)
  })

  it('非法值回落到默认', () => {
    const r = resolvePreAnalysisOptions({
      longFunctionLines: 0,
      maxSuggestions: -3,
      maxNestingDepth: NaN,
    })
    expect(r.longFunctionLines).toBe(DEFAULT_PRE_ANALYSIS_OPTIONS.longFunctionLines)
    expect(r.maxSuggestions).toBe(DEFAULT_PRE_ANALYSIS_OPTIONS.maxSuggestions)
    expect(r.maxNestingDepth).toBe(DEFAULT_PRE_ANALYSIS_OPTIONS.maxNestingDepth)
  })
})

describe('preAnalysis 阈值可控', () => {
  /** 生成一个 n 行的函数 */
  const makeFunction = (n: number) =>
    ['function big() {', ...Array.from({ length: n - 2 }, () => '  x()'), '}'].join('\n')

  it('默认阈值下 30 行函数不报超长', () => {
    const out = preAnalysis(makeFunction(30))
    expect(out.some((s) => s.type === 'long-func')).toBe(false)
  })

  it('调低阈值后同一份代码报出超长', () => {
    const out = preAnalysis(makeFunction(30), { longFunctionLines: 10 })
    expect(out.some((s) => s.type === 'long-func')).toBe(true)
  })

  it('maxSuggestions 限制返回条数', () => {
    const content = Array.from({ length: 50 }, (_, i) => `// TODO ${i}`).join('\n')
    const out = preAnalysis(content, { maxSuggestions: 3 })
    expect(out.length).toBeLessThanOrEqual(3)
  })

  it('未传 options 时行为与改造前一致（默认 20 条上限）', () => {
    const content = Array.from({ length: 50 }, (_, i) => `// TODO ${i}`).join('\n')
    expect(preAnalysis(content).length).toBe(20)
  })

  it('嵌套阈值可调：默认不报 3 层，调低后报出', () => {
    const content = ['if (a) {', '  if (b) {', '    if (c) {', '    }', '  }', '}'].join('\n')
    expect(preAnalysis(content).some((s) => s.type === 'complex')).toBe(false)
    expect(
      preAnalysis(content, { maxNestingDepth: 1 }).some((s) => s.type === 'complex'),
    ).toBe(true)
  })

  it('重复代码阈值可调', () => {
    // 构造两段完全相同的 3 行代码块，且每行足够长以通过字符数门槛
    const chunk = [
      'const firstVariable = computeSomethingVeryLongName(a, b)',
      'const secondVariable = computeAnotherVeryLongName(c, d)',
      'console.log(firstVariable, secondVariable)',
    ]
    const content = [...chunk, '', ...chunk].join('\n')
    // 默认 3 行起报
    expect(preAnalysis(content).some((s) => s.type === 'duplicate')).toBe(true)
    // 提高到 10 行后，3 行的重复块不再够格
    expect(
      preAnalysis(content, { duplicateMinLines: 10 }).some((s) => s.type === 'duplicate'),
    ).toBe(false)
  })

  it('重复代码字符阈值可调', () => {
    // 三个很短的标识符行，拼接后总长仍低于默认门槛 30
    const chunk = ['a()', 'b()', 'c()']
    const content = [...chunk, '', ...chunk].join('\n')
    // 默认字符门槛 30，该短块的长度不足，被过滤掉
    expect(preAnalysis(content).some((s) => s.type === 'duplicate')).toBe(false)
    // 降到 5 字符后即可报出
    expect(
      preAnalysis(content, { duplicateMinChars: 5 }).some((s) => s.type === 'duplicate'),
    ).toBe(true)
  })
})
