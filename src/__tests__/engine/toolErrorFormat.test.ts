import { describe, it, expect } from 'vitest'
import {
  formatToolError,
  truncateMiddle,
  getErrorParts,
  isAbortError,
  formatValidationError,
  formatValidationPath,
  issuesFromSimpleErrors,
  describeToolFailure,
  MAX_ERROR_MESSAGE_CHARS,
  INTERRUPT_MESSAGE,
} from '../../engine/errors/toolErrorFormat'

/**
 * 错误格式化的两条核心规则：
 *   1. 超长错误**中间**截断（关键信息常在末尾，切尾会丢）
 *   2. 参数错误说人话（分「缺少/多余/类型不符」三类，模型才能改对）
 */

describe('isAbortError', () => {
  it('识别 AbortError name', () => {
    const e = new Error('x')
    e.name = 'AbortError'
    expect(isAbortError(e)).toBe(true)
  })

  it('识别 ABORT_ERR code', () => {
    expect(isAbortError({ code: 'ABORT_ERR' })).toBe(true)
  })

  it('识别消息文本', () => {
    expect(isAbortError(new Error('The operation was aborted'))).toBe(true)
  })

  it('普通错误不算中断', () => {
    expect(isAbortError(new Error('ENOENT: no such file'))).toBe(false)
    expect(isAbortError(null)).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })
})

describe('getErrorParts', () => {
  it('消息在前，stdout 在后', () => {
    const parts = getErrorParts({ message: 'msg', stderr: 'err', stdout: 'out' })
    expect(parts).toEqual(['msg', 'err', 'out'])
  })

  it('跳过空白片段', () => {
    expect(getErrorParts({ message: 'm', stderr: '   ', stdout: '' })).toEqual(['m'])
  })

  it('中断标记被保留', () => {
    expect(getErrorParts({ message: 'm', interrupted: true })).toContain(INTERRUPT_MESSAGE)
  })
})

describe('truncateMiddle — 中间截断', () => {
  it('未超限原样返回', () => {
    expect(truncateMiddle('short', 100)).toBe('short')
  })

  it('恰好等于上限不截断', () => {
    const s = 'x'.repeat(100)
    expect(truncateMiddle(s, 100)).toBe(s)
  })

  it('超限时保留头尾', () => {
    const s = 'A'.repeat(5000) + 'MIDDLE' + 'B'.repeat(5000)
    const r = truncateMiddle(s, 1000)
    expect(r.startsWith('A')).toBe(true)
    expect(r.endsWith('B')).toBe(true)
    expect(r).toContain('被截断')
  })

  it('尾部信息被保留（这是中间截断的意义）', () => {
    const s = 'x'.repeat(200) + '\nerror: something failed at file.ts:42'
    const r = truncateMiddle(s, 100)
    expect(r).toContain('error: something failed at file.ts:42')
  })

  it('报告被省略的字符数', () => {
    const s = 'x'.repeat(300)
    const r = truncateMiddle(s, 100)
    expect(r).toContain('中间 200 字符被截断')
  })

  it('默认上限为 10000', () => {
    expect(MAX_ERROR_MESSAGE_CHARS).toBe(10_000)
    const s = 'y'.repeat(20_000)
    const r = truncateMiddle(s)
    expect(r.length).toBeLessThan(s.length)
    expect(r).toContain('被截断')
  })
})

describe('formatToolError — 统一入口', () => {
  it('null/undefined 有兜底文案', () => {
    expect(formatToolError(null)).toBe('命令执行失败，没有输出')
    expect(formatToolError(undefined)).toBe('命令执行失败，没有输出')
  })

  it('无输出的 Error 有兜底文案', () => {
    expect(formatToolError(new Error(''))).toBe('命令执行失败，没有输出')
  })

  it('普通 Error 返回 message', () => {
    expect(formatToolError(new Error('ENOENT: not found'))).toBe('ENOENT: not found')
  })

  it('字符串错误原样返回', () => {
    expect(formatToolError('something bad')).toBe('something bad')
  })

  it('中断错误返回中断文案', () => {
    expect(formatToolError({ name: 'AbortError' })).toBe(INTERRUPT_MESSAGE)
  })

  it('带 stderr/stdout 的错误合并输出', () => {
    const r = formatToolError({
      message: '命令失败',
      stderr: 'line1\nline2',
      stdout: 'partial output',
    })
    expect(r).toContain('命令失败')
    expect(r).toContain('line1')
    expect(r).toContain('partial output')
  })

  it('超长错误被中间截断', () => {
    const r = formatToolError({ message: 'z'.repeat(30_000) })
    expect(r.length).toBeLessThan(30_000)
    expect(r).toContain('被截断')
  })

  it('非 Error 对象不抛异常', () => {
    expect(() => formatToolError({ weird: true })).not.toThrow()
    expect(() => formatToolError(42)).not.toThrow()
    expect(() => formatToolError(Symbol('x'))).not.toThrow()
  })
})

describe('formatValidationPath', () => {
  it('数组下标用方括号', () => {
    expect(formatValidationPath(['todos', 0, 'activeForm'])).toBe('todos[0].activeForm')
  })

  it('嵌套数组', () => {
    expect(formatValidationPath(['a', 1, 'b', 2])).toBe('a[1].b[2]')
  })

  it('空路径返回空串', () => {
    expect(formatValidationPath([])).toBe('')
  })

  it('单段', () => {
    expect(formatValidationPath(['path'])).toBe('path')
  })
})

describe('formatValidationError — 三类分开陈述', () => {
  it('缺少参数', () => {
    const r = formatValidationError('read_file', [{ kind: 'missing', param: 'path' }])
    expect(r).toContain('read_file')
    expect(r).toContain('缺少必需参数 `path`')
  })

  it('多余参数', () => {
    const r = formatValidationError('read_file', [{ kind: 'unexpected', param: 'filePath' }])
    expect(r).toContain('提供了意外参数 `filePath`')
  })

  it('类型不符包含期望与实际', () => {
    const r = formatValidationError('write_file', [
      { kind: 'typeMismatch', param: 'content', expected: 'string', received: 'number' },
    ])
    expect(r).toContain('`content`')
    expect(r).toContain('`string`')
    expect(r).toContain('`number`')
  })

  it('多个问题逐条列出', () => {
    const r = formatValidationError('t', [
      { kind: 'missing', param: 'a' },
      { kind: 'unexpected', param: 'b' },
      { kind: 'typeMismatch', param: 'c', expected: 'x', received: 'y' },
    ])
    expect(r.split('\n').length).toBe(4) // 标题 + 3 条
  })

  it('空问题列表有兜底', () => {
    expect(formatValidationError('t', [])).toContain('参数校验未通过')
  })
})

describe('issuesFromSimpleErrors — 从自由文本分类', () => {
  it('识别「缺少」', () => {
    const r = issuesFromSimpleErrors(['缺少必需参数 `path`'])
    expect(r[0].kind).toBe('missing')
    expect(r[0].param).toBe('path')
  })

  it('识别英文 missing/required', () => {
    expect(issuesFromSimpleErrors(['required: path'])[0].kind).toBe('missing')
    expect(issuesFromSimpleErrors(['missing parameter path'])[0].kind).toBe('missing')
  })

  it('识别「意外参数」', () => {
    const r = issuesFromSimpleErrors(['提供了意外参数 "foo"'])
    expect(r[0].kind).toBe('unexpected')
    expect(r[0].param).toBe('foo')
  })

  it('识别类型不符并提取期望/实际', () => {
    const r = issuesFromSimpleErrors(['expected string, received number'])
    expect(r[0].kind).toBe('typeMismatch')
    expect(r[0].expected).toBe('string')
    expect(r[0].received).toBe('number')
  })

  it('认不出类别时归为 typeMismatch 但仍提取参数名', () => {
    const r = issuesFromSimpleErrors(['参数 `depth` 不合法'])
    expect(r[0].kind).toBe('typeMismatch')
    expect(r[0].param).toBe('depth')
  })

  it('空字符串被跳过', () => {
    expect(issuesFromSimpleErrors(['', '   '])).toEqual([])
  })

  it('无引号的错误仍能取到首个词作为参数名', () => {
    const r = issuesFromSimpleErrors(['path is missing'])
    expect(r[0].param).toBe('path')
  })
})

describe('describeToolFailure', () => {
  it('有校验问题时用校验格式', () => {
    const r = describeToolFailure('read_file', new Error('x'), [
      { kind: 'missing', param: 'path' },
    ])
    expect(r).toContain('缺少必需参数')
    expect(r).not.toContain('执行失败')
  })

  it('无校验问题时用通用格式', () => {
    const r = describeToolFailure('bash', new Error('command not found'))
    expect(r).toContain('bash')
    expect(r).toContain('执行失败')
    expect(r).toContain('command not found')
  })

  it('空校验数组视为无校验问题', () => {
    const r = describeToolFailure('bash', new Error('boom'), [])
    expect(r).toContain('执行失败')
  })
})
