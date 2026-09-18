/**
 * engine/cost/pricing.ts — 模型价格表
 *
 * 定义主流模型的定价信息。
 */

/** 模型价格条目 */
export interface ModelPricing {
  inputPer1K: number
  outputPer1K: number
  cacheReadPer1K?: number
  cacheCreationPer1K?: number
}

/** 模型价格表 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015 },
  'gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  'gpt-4-turbo': { inputPer1K: 0.01, outputPer1K: 0.03 },
  'claude-3-5-sonnet-20241022': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-opus-20240229': { inputPer1K: 0.015, outputPer1K: 0.075 },
  'claude-3-haiku-20240307': { inputPer1K: 0.00025, outputPer1K: 0.00125 },
  'step-2-16k': { inputPer1K: 0.001, outputPer1K: 0.002 },
}

/** 计算单次 API 调用成本 */
export function calculateCost(model: string, usage: {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return NaN

  const inputCost = (usage.inputTokens / 1000) * pricing.inputPer1K
  const outputCost = (usage.outputTokens / 1000) * pricing.outputPer1K
  const cacheReadCost = ((usage.cacheReadInputTokens || 0) / 1000) * (pricing.cacheReadPer1K ?? pricing.inputPer1K)
  const cacheCreateCost = ((usage.cacheCreationInputTokens || 0) / 1000) * (pricing.cacheCreationPer1K ?? pricing.inputPer1K)

  return inputCost + outputCost + cacheReadCost + cacheCreateCost
}
