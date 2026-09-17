import { describe, it, expect, beforeEach } from 'vitest'
import {
  selectPromptVariant,
  registerVariants,
  registerVariant,
  getAvailableVariants,
  getVariantById,
} from '../../main/proxy/prompt/variantSelector'
import { BUILTIN_VARIANTS } from '../../main/proxy/prompt/variants'
import type { PromptVariant } from '../../main/proxy/prompt/types'

/**
 * 变体选择器的两个缺陷回归：
 *   1. registerVariants 里 `_sorted = false` 引用未声明变量 —— ES module 严格模式下抛
 *      ReferenceError，整个批量注册不可用
 *   2. 批量注册后不排序，而 selectPromptVariant 按数组顺序取首个匹配 —— 后注册的
 *      高优先级变体永远匹配不到（单个注册的 registerVariant 有排序，行为不一致）
 */

/** 构造一个最小可用变体 */
function makeVariant(id: string, priority: number, modelPattern: string): PromptVariant {
  return {
    id,
    name: id,
    modelPatterns: [modelPattern],
    systemPrompt: `system-${id}`,
    toolPromptTemplate: `template-${id}`,
    toolCallFormat: 'json' as PromptVariant['toolCallFormat'],
    priority,
  }
}

describe('registerVariants 批量注册', () => {
  it('不抛异常（原实现会因未声明变量抛 ReferenceError）', () => {
    expect(() => registerVariants([makeVariant('tmp-a', 1, 'tmp-model-a')])).not.toThrow()
  })

  it('注册后数组按 priority 降序排列', () => {
    registerVariants([
      makeVariant('tmp-low', 1, 'tmp-model-low'),
      makeVariant('tmp-high', 99, 'tmp-model-high'),
      makeVariant('tmp-mid', 50, 'tmp-model-mid'),
    ])
    const ids = getAvailableVariants().map(v => v.id)
    const iHigh = ids.indexOf('tmp-high')
    const iMid = ids.indexOf('tmp-mid')
    const iLow = ids.indexOf('tmp-low')
    expect(iHigh).toBeGreaterThanOrEqual(0)
    expect(iHigh).toBeLessThan(iMid)
    expect(iMid).toBeLessThan(iLow)
  })

  it('高优先级变体注册后能真正被选中（而非排在末尾匹配不到）', () => {
    registerVariants([makeVariant('tmp-pick', 100, '^tmp-unique-model$')])
    const picked = selectPromptVariant({ model: 'tmp-unique-model' })
    expect(picked.id).toBe('tmp-pick')
  })

  it('同 id 重复注册为覆盖而非追加', () => {
    registerVariants([makeVariant('tmp-dup', 1, 'tmp-dup-a')])
    const before = getAvailableVariants().filter(v => v.id === 'tmp-dup').length
    registerVariants([makeVariant('tmp-dup', 2, 'tmp-dup-b')])
    const after = getAvailableVariants().filter(v => v.id === 'tmp-dup').length
    expect(before).toBe(1)
    expect(after).toBe(1)
    expect(getVariantById('tmp-dup')!.systemPrompt).toBe('system-tmp-dup')
  })
})

describe('registerVariant 单个注册', () => {
  it('不抛异常且可按 id 取回', () => {
    expect(() => registerVariant(makeVariant('tmp-single', 5, 'tmp-single-model'))).not.toThrow()
    expect(getVariantById('tmp-single')).toBeDefined()
  })
})

describe('selectPromptVariant 选择逻辑', () => {
  it('preferVariant 命中时优先使用', () => {
    const v = selectPromptVariant({ model: 'anything', preferVariant: 'default' })
    expect(v.id).toBe('default')
  })

  it('preferVariant 不存在时回落到模式匹配', () => {
    const v = selectPromptVariant({ model: 'qwen-max', preferVariant: 'no-such-variant' })
    expect(v).toBeDefined()
    expect(v.id).not.toBe('no-such-variant')
  })

  it('模型不匹配任何模式时回落到 default', () => {
    const v = selectPromptVariant({ model: 'zzz-unknown-model-xyz' })
    expect(v.id).toBe('default')
  })

  it('通用模型（gpt-4o）落到 default 而非 xml', () => {
    // 回归：XML_VARIANT 原以 `.*` 匹配所有模型且排在 default 之前，
    // 会给 gpt-4o 之类注入 XML 协议、却被 bracket 解析器解析 → 工具调用解析失败
    expect(selectPromptVariant({ model: 'gpt-4o' }).id).toBe('default')
    expect(selectPromptVariant({ model: 'claude-sonnet-4-6' }).id).toBe('default')
  })

  it('兜底变体的格式必须与该路径的解析器一致（bracket）', () => {
    const v = selectPromptVariant({ model: 'zzz-unknown' })
    expect(v.toolCallFormat).toBe('bracket')
  })

  it('xml 变体不参与按模型名的自动匹配', () => {
    const xml = getVariantById('xml')
    expect(xml).toBeDefined()
    expect(xml!.modelPatterns).toHaveLength(0)
    // 但仍可按 id 显式取用（getVariantByFormat('xml') 依赖这条路径）
    expect(selectPromptVariant({ model: 'x', preferVariant: 'xml' }).id).toBe('xml')
  })

  it('providerPatterns 存在时要求 provider 也匹配', () => {
    registerVariants([
      {
        ...makeVariant('tmp-prov', 100, '^tmp-prov-model$'),
        providerPatterns: ['^openai$'],
      },
    ])
    // provider 不匹配 → 不应选中该变体
    const wrong = selectPromptVariant({ model: 'tmp-prov-model', provider: 'anthropic' })
    expect(wrong.id).not.toBe('tmp-prov')
    // provider 匹配 → 选中
    const right = selectPromptVariant({ model: 'tmp-prov-model', provider: 'openai' })
    expect(right.id).toBe('tmp-prov')
  })

  it('modelPatterns 支持正则', () => {
    registerVariants([makeVariant('tmp-regex', 100, '^tmp-regex-\\d+$')])
    expect(selectPromptVariant({ model: 'tmp-regex-42' }).id).toBe('tmp-regex')
  })
})

describe('内置变体数据源', () => {
  it('BUILTIN_VARIANTS 非空且含 default', () => {
    expect(BUILTIN_VARIANTS.length).toBeGreaterThan(0)
    expect(BUILTIN_VARIANTS.some(v => v.id === 'default')).toBe(true)
  })

  it('数组已按 priority 降序排列（index.ts 的单一数据源约定）', () => {
    const priorities = BUILTIN_VARIANTS.map(v => v.priority || 0)
    const sorted = [...priorities].sort((a, b) => b - a)
    expect(priorities).toEqual(sorted)
  })

  it('getAvailableVariants 返回副本，外部修改不影响内部', () => {
    const a = getAvailableVariants()
    const len = a.length
    a.push(makeVariant('tmp-injected', 0, 'x'))
    expect(getAvailableVariants().length).toBe(len)
  })
})
