import { describe, it, expect } from 'vitest'
import {
  buildCompactPrompt,
  formatCompactSummary,
  buildSummaryMessage,
  COMPACT_NO_TOOLS_PREAMBLE,
  COMPACT_NO_TOOLS_TRAILER,
  COMPACT_SUMMARY_TEMPLATE,
  SUMMARY_HEADING,
} from '../../engine/compactPrompt'

/**
 * 摘要提示词的三条设计约束各自防一个真实问题：
 *   1. 首尾强约束「不许调工具」—— 压缩只给一轮机会，调工具就白费
 *   2. <analysis> 草稿后剥离 —— 提升质量但不占上下文
 *   3. 9 段固定结构 —— 防自由摘要漏掉「用户纠正过什么」
 */

describe('buildCompactPrompt', () => {
  it('包含前置与后置的工具禁用约束', () => {
    const p = buildCompactPrompt()
    expect(p).toContain(COMPACT_NO_TOOLS_PREAMBLE)
    expect(p).toContain(COMPACT_NO_TOOLS_TRAILER)
  })

  it('前置约束在最前，后置约束在最后', () => {
    const p = buildCompactPrompt()
    expect(p.startsWith(COMPACT_NO_TOOLS_PREAMBLE)).toBe(true)
    expect(p.endsWith(COMPACT_NO_TOOLS_TRAILER)).toBe(true)
  })

  it('要求输出 <analysis> 与 <summary> 两块', () => {
    const p = buildCompactPrompt()
    expect(p).toContain('<analysis>')
    expect(p).toContain('</analysis>')
    expect(p).toContain('<summary>')
    expect(p).toContain('</summary>')
  })

  it('包含 9 段结构', () => {
    const p = buildCompactPrompt()
    for (let i = 1; i <= 9; i++) {
      expect(p).toContain(`${i}. **`)
    }
  })

  it('明确要求记录用户纠正（最易被自由摘要漏掉）', () => {
    const p = buildCompactPrompt()
    expect(p).toContain('用户给出的纠正')
    expect(p).toContain('所有用户消息')
  })

  it('附加指令被插入', () => {
    const p = buildCompactPrompt('重点保留数据库 schema 决策')
    expect(p).toContain('附加指令')
    expect(p).toContain('重点保留数据库 schema 决策')
    // 附加指令仍要在后置约束之前，保证禁用工具是最后一句
    expect(p.endsWith(COMPACT_NO_TOOLS_TRAILER)).toBe(true)
  })

  it('空白附加指令被忽略', () => {
    expect(buildCompactPrompt('   ')).not.toContain('附加指令')
    expect(buildCompactPrompt('')).not.toContain('附加指令')
  })
})

describe('formatCompactSummary — 剥离草稿', () => {
  it('剥离 <analysis> 块', () => {
    const raw = '<analysis>\n内部思考过程\n</analysis>\n<summary>\n实际摘要\n</summary>'
    const out = formatCompactSummary(raw)
    expect(out).not.toContain('内部思考过程')
    expect(out).toContain('实际摘要')
  })

  it('<summary> 转为可读标题', () => {
    const out = formatCompactSummary('<summary>\n内容\n</summary>')
    expect(out).toContain(`${SUMMARY_HEADING}：`)
    expect(out).not.toContain('<summary>')
  })

  it('未闭合的 analysis 剥到结尾', () => {
    const raw = '开头正文\n<analysis>\n思考没写完就结束了'
    const out = formatCompactSummary(raw)
    expect(out).not.toContain('思考没写完')
    expect(out).toContain('开头正文')
  })

  it('未闭合的 summary 只去标签保留内容', () => {
    const out = formatCompactSummary('<summary>\n摘要内容在此')
    expect(out).toContain('摘要内容在此')
    expect(out).not.toContain('<summary>')
  })

  it('完全没有标签时按整段为摘要处理（不丢内容）', () => {
    const out = formatCompactSummary('1. 主要需求\n2. 关键技术概念')
    expect(out).toContain('主要需求')
    expect(out).toContain('关键技术概念')
  })

  it('压缩多余空行', () => {
    const out = formatCompactSummary('a\n\n\n\n\nb')
    expect(out).toBe('a\n\nb')
  })

  it('去掉行尾空白', () => {
    expect(formatCompactSummary('a   \nb\t\n')).toBe('a\nb')
  })

  it('空输入返回空串', () => {
    expect(formatCompactSummary('')).toBe('')
  })

  it('只有 analysis 时返回空（不残留标签）', () => {
    const out = formatCompactSummary('<analysis>只有思考</analysis>')
    expect(out).toBe('')
  })

  it('大小写不敏感', () => {
    const out = formatCompactSummary('<ANALYSIS>思考</ANALYSIS><SUMMARY>内容</SUMMARY>')
    expect(out).not.toContain('思考')
    expect(out).toContain('内容')
  })

  it('端到端：完整输出被正确规整', () => {
    const raw = [
      '<analysis>',
      '1. 用户要修 bug',
      '2. 涉及 validate.ts',
      '</analysis>',
      '',
      '<summary>',
      '1. **主要需求与意图**：修复空指针',
      '4. **错误与修复**：加了空值检查',
      '</summary>',
    ].join('\n')
    const out = formatCompactSummary(raw)
    expect(out).toContain('摘要：')
    expect(out).toContain('主要需求与意图')
    expect(out).toContain('错误与修复')
    expect(out).not.toContain('validate.ts')
  })
})

describe('buildSummaryMessage', () => {
  it('明确标注这是压缩摘要', () => {
    const m = buildSummaryMessage('内容')
    expect(m).toContain('上下文已压缩')
    expect(m).toContain('内容')
  })

  it('提示不要复述摘要本身', () => {
    expect(buildSummaryMessage('x')).toContain('不要向用户复述')
  })

  it('空摘要时有兜底文案', () => {
    expect(buildSummaryMessage('')).toContain('摘要为空')
  })

  it('内部先做 formatCompactSummary 清理', () => {
    const m = buildSummaryMessage('<analysis>思考</analysis><summary>真内容</summary>')
    expect(m).not.toContain('思考')
    expect(m).toContain('真内容')
  })
})

describe('模板内容要点', () => {
  it('要求按时间顺序分析（防只总结最后几轮）', () => {
    expect(COMPACT_SUMMARY_TEMPLATE).toContain('按时间顺序')
  })

  it('第 3 段要求具体文件与代码片段', () => {
    expect(COMPACT_SUMMARY_TEMPLATE).toContain('具体文件与代码')
  })

  it('第 4 段要求记录错误与修复', () => {
    expect(COMPACT_SUMMARY_TEMPLATE).toContain('错误与修复')
  })

  it('明确 analysis 会被程序剥离', () => {
    expect(COMPACT_SUMMARY_TEMPLATE).toContain('将被程序剥离')
  })
})
