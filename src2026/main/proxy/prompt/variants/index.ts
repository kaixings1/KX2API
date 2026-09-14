/**
 * Prompt Variants Index
 * Single source of truth for all built-in prompt variants.
 * Exports individual variants and the sorted BUILTIN_VARIANTS array.
 */

export { DEFAULT_VARIANT } from './default'
export { XML_VARIANT } from './xml'
export { QWEN_VARIANT } from './qwen'
export { DEEPSEEK_VARIANT } from './deepseek'
export { GLM_VARIANT } from './glm'

import { DEFAULT_VARIANT } from './default'
import { XML_VARIANT } from './xml'
import { QWEN_VARIANT } from './qwen'
import { DEEPSEEK_VARIANT } from './deepseek'
import { GLM_VARIANT } from './glm'
import { PromptVariant } from '../types'

/**
 * All built-in variants, sorted by priority (high to low).
 * This is the single source of truth — variantSelector.ts imports from here.
 */
export const BUILTIN_VARIANTS: PromptVariant[] = [
  QWEN_VARIANT,
  DEEPSEEK_VARIANT,
  GLM_VARIANT,
  XML_VARIANT,
  DEFAULT_VARIANT,
].sort((a, b) => (b.priority || 0) - (a.priority || 0))
