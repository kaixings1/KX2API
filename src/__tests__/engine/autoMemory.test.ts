import { describe, it, expect } from 'vitest'
import { extractMemoryFromTurn, parseExtraction } from '../../engine/memory/autoMemory'

/**
 * 记忆写入侧此前零调用 —— 记忆目录永远是空的，读取侧每轮召回到「没有记忆」。
 * 本用例锁定自动提取的入口判定与输出解析。
 */
describe('parseExtraction', () => {
  it('解析标准三段结构', () => {
    const r = parseExtraction('TITLE: 构建约定\nDESC: 项目用 pnpm 而非 npm\nBODY: 用户明确要求统一用 pnpm。')
    expect(r).toEqual({
      title: '构建约定',
      desc: '项目用 pnpm 而非 npm',
      body: '用户明确要求统一用 pnpm。',
    })
  })

  it('BODY 支持多行', () => {
    const r = parseExtraction('TITLE: t\nDESC: d\nBODY: 第一行\n第二行\n第三行')
    expect(r?.body).toBe('第一行\n第二行\n第三行')
  })

  it('NONE 表示无可记内容', () => {
    expect(parseExtraction('NONE')).toBeNull()
    expect(parseExtraction('none')).toBeNull()
    expect(parseExtraction('  NONE  ')).toBeNull()
  })

  it('空输入返回 null', () => {
    expect(parseExtraction('')).toBeNull()
    expect(parseExtraction('   ')).toBeNull()
  })

  it('缺少任一字段则返回 null（避免写入残缺记忆）', () => {
    expect(parseExtraction('TITLE: t\nDESC: d')).toBeNull()
    expect(parseExtraction('TITLE: t\nBODY: b')).toBeNull()
    expect(parseExtraction('DESC: d\nBODY: b')).toBeNull()
  })
})

describe('extractMemoryFromTurn 入口判定', () => {
  const api = { provider: 'openai', apiKey: '', model: 'gpt-4o' }

  it('未启用时直接跳过，不产生任何写入', async () => {
    const r = await extractMemoryFromTurn('记住：以后都用 pnpm', {
      enabled: false,
      api,
    })
    expect(r.written).toBe(false)
    expect(r.skipped).toBe('未启用')
  })

  it('空对话跳过', async () => {
    const r = await extractMemoryFromTurn('', { enabled: true, api })
    expect(r.written).toBe(false)
    expect(r.skipped).toBe('对话为空')
  })

  it('未命中信号词的对话被预筛拦下（不花模型调用）', async () => {
    const r = await extractMemoryFromTurn('帮我看一下这个函数为什么报错', {
      enabled: true,
      api,
    })
    expect(r.written).toBe(false)
    expect(r.skipped).toContain('信号词')
  })

  it('过短的文本被预筛拦下（避免碎片入库）', async () => {
    // 预筛要求 trim 后 >= 40 字符
    const r = await extractMemoryFromTurn('记住：用 pnpm', { enabled: true, api })
    expect(r.written).toBe(false)
    expect(r.skipped).toContain('信号词')
  })

  it('命中信号词且长度足够时放行预筛', async () => {
    const longEnough =
      '记住：这个项目以后统一使用 pnpm 管理依赖，不要再出现 npm install 的用法，' +
      '这是我们团队约定的规范，避免锁文件格式混乱。'
    // 不传 api → 走「原文存档」降级路径，会真的尝试写文件
    const r = await extractMemoryFromTurn(longEnough, { enabled: true })
    // 关键：不能再停在预筛阶段
    expect(r.skipped || '').not.toContain('信号词')
  })
})
