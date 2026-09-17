import { describe, it, expect } from 'vitest'
import {
  SessionMemory,
  extractKeyPoints,
  MAX_ENTRIES,
  MAX_ENTRY_CHARS,
} from '../../engine/memory/sessionMemory'

/**
 * 会话级滚动记忆。
 *
 * 解决的问题：长对话会被多次压缩，每次摘要都是对「上一次摘要」的二次加工，
 * 早期关键信息（用户原始约束、纠正过的方向、踩过的坑）会逐轮衰减。
 * 本模块把这些要点以累加方式保留，只喂给压缩，不进主上下文。
 */
describe('SessionMemory 基本行为', () => {
  it('追加并读取要点', () => {
    const m = new SessionMemory()
    m.add('用户要求统一用 pnpm', 1)
    m.add('接口必须兼容 OpenAI 格式', 1)
    expect(m.size).toBe(2)
    expect(m.list().map(e => e.text)).toEqual([
      '用户要求统一用 pnpm',
      '接口必须兼容 OpenAI 格式',
    ])
  })

  it('忽略空内容与纯空白', () => {
    const m = new SessionMemory()
    m.add('', 1)
    m.add('   ', 1)
    m.add('\n\t', 1)
    expect(m.size).toBe(0)
  })

  it('逐条去重：相同要点不重复占用额度', () => {
    const m = new SessionMemory()
    m.add('同一条要点', 1)
    m.add('同一条要点', 2)
    m.add('同一条要点', 3)
    expect(m.size).toBe(1)
  })

  it('超长要点被截断', () => {
    const m = new SessionMemory()
    m.add('x'.repeat(MAX_ENTRY_CHARS + 200), 1)
    expect(m.list()[0].text.length).toBe(MAX_ENTRY_CHARS)
  })

  it('超出总上限时丢弃最旧的（最近的更相关）', () => {
    const m = new SessionMemory()
    for (let i = 0; i < MAX_ENTRIES + 10; i++) m.add(`要点${i}`, i)
    expect(m.size).toBe(MAX_ENTRIES)
    // 最旧的已被丢弃，最新的还在
    expect(m.list().some(e => e.text === `要点${MAX_ENTRIES + 9}`)).toBe(true)
    expect(m.list().some(e => e.text === '要点0')).toBe(false)
  })

  it('clear 清空全部', () => {
    const m = new SessionMemory()
    m.add('a', 1)
    m.add('b', 1)
    m.clear()
    expect(m.size).toBe(0)
    expect(m.list()).toEqual([])
  })

  it('list 返回副本，外部修改不影响内部状态', () => {
    const m = new SessionMemory()
    m.add('a', 1)
    const list = m.list()
    list.push({ text: 'injected', at: 0, round: 0 })
    expect(m.size).toBe(1)
  })

  it('addAll 批量追加', () => {
    const m = new SessionMemory()
    m.addAll(['a', 'b', 'c'], 1)
    expect(m.size).toBe(3)
  })
})

describe('formatForCompact', () => {
  it('空记忆返回空串（调用方据此跳过注入）', () => {
    expect(new SessionMemory().formatForCompact()).toBe('')
  })

  it('有记忆时列出全部要点并附冲突处理说明', () => {
    const m = new SessionMemory()
    m.add('统一用 pnpm', 1)
    const text = m.formatForCompact()
    expect(text).toContain('统一用 pnpm')
    expect(text).toContain('本会话此前的要点')
    // 必须说明冲突时以本次消息为准，否则模型可能死守过期要点
    expect(text).toContain('以本次消息为准')
  })
})

describe('extractKeyPoints 从摘要抽取要点', () => {
  it('保留约束/决策/错误类段落', () => {
    const summary = [
      '## 1. 主要请求',
      '用户要求重构压缩逻辑',
      '',
      '## 4. 错误与修复',
      '曾出现孤立 tool_result 导致 400，已用 splitAtSafeBoundary 修复',
      '',
      '## 8. 下一步',
      '继续写测试',
    ].join('\n')

    const points = extractKeyPoints(summary)
    expect(points.some(p => p.includes('重构压缩逻辑'))).toBe(true)
    expect(points.some(p => p.includes('孤立 tool_result'))).toBe(true)
  })

  it('丢弃「当前工作/下一步」这类下一轮就过时的段落', () => {
    const summary = [
      '## 8. 当前工作',
      '正在写第 3 个测试文件',
      '',
      '## 9. 下一步',
      '跑全量测试',
    ].join('\n')
    const points = extractKeyPoints(summary)
    expect(points.some(p => p.includes('正在写'))).toBe(false)
    expect(points.some(p => p.includes('跑全量'))).toBe(false)
  })

  it('多行段落压成单行（避免单条占满额度）', () => {
    const summary = ['## 2. 约束', '第一行', '第二行', '第三行'].join('\n')
    const points = extractKeyPoints(summary)
    expect(points).toHaveLength(1)
    expect(points[0]).not.toContain('\n')
    expect(points[0]).toContain('第一行')
    expect(points[0]).toContain('第三行')
  })

  it('空输入返回空数组', () => {
    expect(extractKeyPoints('')).toEqual([])
    expect(extractKeyPoints('   ')).toEqual([])
  })

  it('模型没按格式输出时，退化取首段（不丢信息）', () => {
    const points = extractKeyPoints('这是一段没有标题的自由摘要内容。')
    expect(points).toHaveLength(1)
    expect(points[0]).toContain('自由摘要')
  })

  it('单条要点超长时截断', () => {
    const long = '## 1. 约束\n' + 'x'.repeat(MAX_ENTRY_CHARS + 100)
    const points = extractKeyPoints(long)
    expect(points[0].length).toBe(MAX_ENTRY_CHARS)
  })
})
