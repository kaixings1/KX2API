/**
 * Prompt Variant Selector
 * Selects the appropriate prompt variant based on model and provider
 */

import type { PromptVariantSelectorOptions } from './types'
import { BUILTIN_VARIANTS } from './variants'

/**
 * Select the appropriate prompt variant
 */
export function selectPromptVariant(options: PromptVariantSelectorOptions): PromptVariant {
  const { model, provider, preferVariant } = options

  if (preferVariant) {
    const preferred = BUILTIN_VARIANTS.find(v => v.id === preferVariant)
    if (preferred) {
      console.log('[VariantSelector] Using preferred variant: ' + preferVariant)
      return preferred
    }
  }

  const lowerModel = model.toLowerCase()
  const lowerProvider = provider ? provider.toLowerCase() : ''

  for (const variant of BUILTIN_VARIANTS) {
    if (variant.id === 'default') continue

    const modelMatch = variant.modelPatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i')
      return regex.test(lowerModel)
    })

    if (modelMatch) {
      if (variant.providerPatterns && lowerProvider) {
        const providerMatch = variant.providerPatterns.some(pattern => {
          const regex = new RegExp(pattern, 'i')
          return regex.test(lowerProvider)
        })
        
        if (providerMatch) {
          console.log('[VariantSelector] Selected variant: ' + variant.id + ' (model: ' + model + ', provider: ' + provider + ')')
          return variant
        }
      } else {
        console.log('[VariantSelector] Selected variant: ' + variant.id + ' (model: ' + model + ')')
        return variant
      }
    }
  }

  console.log('[VariantSelector] Using default variant (model: ' + model + ')')
  const defaultVariant = BUILTIN_VARIANTS.find(v => v.id === 'default')
  if (defaultVariant) return defaultVariant
  return BUILTIN_VARIANTS[0]
}

/**
 * 批量注册变体。
 *
 * 注册后必须重排 —— `selectPromptVariant` 是**按数组顺序**返回首个匹配项，
 * 所以数组顺序即匹配优先级。只 push 不排序会让后注册的高优先级变体排在末尾、
 * 永远匹配不到（单个注册的 registerVariant 有排序，这里原先漏了，行为不一致）。
 *
 * 注：原实现在循环里写 `_sorted = false`，该变量从未声明 —— 在 ES module 的
 * 严格模式下必然抛 ReferenceError，使批量注册完全不可用。
 */
export function registerVariants(variants: PromptVariant[]): void {
  for (const variant of variants) {
    const existingIndex = BUILTIN_VARIANTS.findIndex(v => v.id === variant.id)
    if (existingIndex >= 0) {
      BUILTIN_VARIANTS[existingIndex] = variant
    } else {
      BUILTIN_VARIANTS.push(variant)
    }
  }
  BUILTIN_VARIANTS.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  console.log('[VariantSelector] Registered ' + variants.length + ' variants')
}

/**
 * Get all available variants
 */
export function getAvailableVariants(): PromptVariant[] {
  return [...BUILTIN_VARIANTS]
}

/**
 * Get variant by ID
 */
export function getVariantById(id: string): PromptVariant | undefined {
  return BUILTIN_VARIANTS.find(v => v.id === id)
}

/**
 * Register a custom variant
 */
export function registerVariant(variant: PromptVariant): void {
  const existingIndex = BUILTIN_VARIANTS.findIndex(v => v.id === variant.id)
  
  if (existingIndex >= 0) {
    BUILTIN_VARIANTS[existingIndex] = variant
  } else {
    BUILTIN_VARIANTS.push(variant)
    BUILTIN_VARIANTS.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }
  
  console.log('[VariantSelector] Registered variant: ' + variant.id)
}
