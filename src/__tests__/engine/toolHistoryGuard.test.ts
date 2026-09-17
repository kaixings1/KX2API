import { describe, it, expect } from 'vitest'
import { validateToolHistory } from '../../engine/tool-history-guard/validate'
import { ensureToolResultPairing } from '../../engine/messageIntegrity'

/**
 * tool-history-guard 的**诊断**能力接入。
 *
 * 它是项目里第三套 tool_use/tool_result 处理实现（另两套：engine/messageIntegrity、
 * main/proxy/toolCalling/historyGuard）。**不重复接入执行路径**，
 * 而是把它的 `validateToolHistory` 用作「配对修复之后的诊断」——
 * 因为它能检出 messageIntegrity **不检测**的顺序类问题：
 *   - tool_result_before_call（result 出现在 call 之前）
 *   - tool_result_ordering（result 未紧跟 call）
 *   - duplicate_tool_result
 *
 * 这些情况经 messageIntegrity 修复后通常能发出请求，但模型看到的顺序是乱的，
 * 表现为"工具结果对不上号"且难以反推原因。
 */
/** 构造一个「带 tool_use 的 assistant 消息」 */
const call = (id: string) => ({
  role: 'assistant',
  content: [{ type: 'tool_use', id, name: 'Read', input: {} }],
})
/** 构造一个「tool_result 消息」 */
const result = (id: string) => ({ role: 'tool', tool_call_id: id, content: 'ok' })

describe('tool-history-guard 诊断能力', () => {
  it('正常配对的历史判定为 valid', () => {
    const r = validateToolHistory([call('c1'), result('c1')] as never)
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  it('检出 result 出现在 call 之前 —— messageIntegrity 不检测这一类', () => {
    const r = validateToolHistory([result('c1'), call('c1')] as never)
    expect(r.valid).toBe(false)
    expect(r.errors.map(e => e.code)).toContain('tool_result_before_call')
  })

  it('检出缺失 result', () => {
    const r = validateToolHistory([call('c1')] as never)
    expect(r.valid).toBe(false)
    expect(r.errors.map(e => e.code)).toContain('tool_call_without_result')
  })

  it('检出孤立 result（无对应 call）', () => {
    const r = validateToolHistory([result('ghost')] as never)
    expect(r.valid).toBe(false)
    expect(r.errors.map(e => e.code)).toContain('tool_result_without_call')
  })

  it('检出重复 result', () => {
    const r = validateToolHistory([call('c1'), result('c1'), result('c1')] as never)
    expect(r.valid).toBe(false)
    expect(r.errors.map(e => e.code)).toContain('duplicate_tool_result')
  })

  it('检出缺失 id 的畸形块', () => {
    const r = validateToolHistory([
      { role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: {} }] },
    ] as never)
    expect(r.valid).toBe(false)
    expect(r.errors.map(e => e.code)).toContain('malformed_tool_call_id')
  })

  it('识别 OpenAI 风格的 tool_calls（不只是 Anthropic 的 tool_use）', () => {
    const openaiStyle = [
      { role: 'assistant', tool_calls: [{ id: 'x1', type: 'function', function: { name: 'f', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'x1', content: 'ok' },
    ]
    const r = validateToolHistory(openaiStyle as never)
    expect(r.valid).toBe(true)
  })

  it('空历史判定为 valid（无问题即通过）', () => {
    expect(validateToolHistory([]).valid).toBe(true)
  })
})

/**
 * 项目**内部**消息用 `toolUseId`（驼峰，见 messageNormalizer.ts:32），
 * 而 tool-history-guard 的默认 adapter 期望**外部格式**
 * `tool_call_id` / `tool_use_id`（下划线）。直接用它诊断会把每条正常的
 * 工具结果都误报成 malformed —— 所以接入时必须传内部 adapter。
 */
const internalAdapter = {
  getToolCalls: (m: { content?: unknown }) => {
    const out: Array<{ id: string | null; rawId: unknown }> = []
    if (Array.isArray(m?.content)) {
      for (const b of m.content as Array<Record<string, unknown>>) {
        if (b && b.type === 'tool_use' && typeof b.id === 'string') {
          out.push({ id: b.id, rawId: b.id })
        }
      }
    }
    return out
  },
  getToolResults: (m: { role?: string; toolUseId?: unknown }) => {
    if (m?.role !== 'tool') return []
    const id = typeof m.toolUseId === 'string' ? m.toolUseId : null
    return [{ id, rawId: m.toolUseId }]
  },
}

describe('项目内部方言（toolUseId）必须用自定义 adapter', () => {
  it('默认 adapter 读不懂内部格式 —— 印证必须传 adapter', () => {
    const internal = [call('c1'), { role: 'tool', toolUseId: 'c1', content: 'ok' }]
    // 默认 adapter 找 tool_call_id，找不到 → 报 malformed
    const withDefault = validateToolHistory(internal as never)
    expect(withDefault.valid).toBe(false)
    expect(withDefault.errors.map(e => e.code)).toContain('malformed_tool_result_id')
  })

  it('传入内部 adapter 后判定正确', () => {
    const internal = [call('c1'), { role: 'tool', toolUseId: 'c1', content: 'ok' }]
    const r = validateToolHistory(internal as never, { adapter: internalAdapter as never })
    expect(r.valid).toBe(true)
  })
})

describe('与 messageIntegrity 的分工', () => {
  /**
   * 关键差异：messageIntegrity 修「配对缺失」（剥离孤立 / 补占位），
   * 但**不处理顺序**。本组用例锁定该分工，防止未来有人误以为它能修顺序。
   */
  it('messageIntegrity 修复后，缺失的 result 会被补上占位', () => {
    const fixed = ensureToolResultPairing([
      { role: 'assistant', content: [{ type: 'tool_use', id: 'c1', name: 'Read', input: {} }] },
    ] as never)
    // 补了一条合成结果
    expect(fixed.length).toBeGreaterThan(1)
    expect(
      validateToolHistory(fixed as never, { adapter: internalAdapter as never }).valid,
    ).toBe(true)
  })

  it('messageIntegrity 剥离孤立 result 后，校验通过', () => {
    const fixed = ensureToolResultPairing([result('ghost')] as never)
    expect(
      validateToolHistory(fixed as never, { adapter: internalAdapter as never }).valid,
    ).toBe(true)
  })

  it('顺序错乱会被 messageIntegrity 顺带修好（剥离前置 result + 补占位）', () => {
    // 「result 在 call 之前」时，该 result 找不到已声明的 call → 被当作孤立项剥离，
    // 随后 call 因缺结果被补上占位。结果是**有效**的。
    // 所以顺序错乱并不是 messageIntegrity 的盲区 —— 它靠"剥离+补"绕开了重排。
    const wrongOrder = [result('c1'), call('c1')] as never
    const fixed = ensureToolResultPairing(wrongOrder)
    expect(
      validateToolHistory(fixed as never, { adapter: internalAdapter as never }).valid,
    ).toBe(true)
  })

  it('但"重复 result"确实是它不处理的（history-guard 的价值所在）', () => {
    // 重复 result 不被剥离时，history-guard 能报出来
    const dup = [
      call('c1'),
      { role: 'tool', toolUseId: 'c1', content: 'a' },
      { role: 'tool', toolUseId: 'c1', content: 'b' },
    ]
    const r = validateToolHistory(dup as never, { adapter: internalAdapter as never })
    expect(r.valid).toBe(false)
    expect(r.errors.map(e => e.code)).toContain('duplicate_tool_result')
  })
})
