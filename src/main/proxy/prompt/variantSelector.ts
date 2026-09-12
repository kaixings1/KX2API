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

export function registerVariants(variants: PromptVariant[]): void {
  for (const variant of variants) {
    _sorted = false
    const existingIndex = BUILTIN_VARIANTS.findIndex(v => v.id === variant.id)
    if (existingIndex >= 0) {
      BUILTIN_VARIANTS[existingIndex] = variant
    } else {
      BUILTIN_VARIANTS.push(variant)
    }
  }
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
