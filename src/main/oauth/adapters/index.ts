/**
 * OAuth Adapter Index
 * Export all provider authentication adapters
 */

export { StepFunOAuthAdapter } from './stepfun'
export { BaseOAuthAdapter } from './base'
export { DeepSeekAdapter } from './deepseek'
export { GLMAdapter } from './glm'
export { KimiAdapter } from './kimi'
export { MimoAdapter } from './mimo'
export { MiniMaxAdapter } from './minimax'
export { PerplexityAdapter } from './perplexity'
export { QwenAdapter } from './qwen'
export { QwenAiAdapter } from './qwen-ai'
export { ZaiAdapter } from './zai'
import { StepFunOAuthAdapter } from './stepfun'
import { BaseOAuthAdapter } from './base'
import { DeepSeekAdapter } from './deepseek'
import { GLMAdapter } from './glm'
import { KimiAdapter } from './kimi'
import { MimoAdapter } from './mimo'
import { MiniMaxAdapter } from './minimax'
import { PerplexityAdapter } from './perplexity'
import { QwenAdapter } from './qwen'
import { QwenAiAdapter } from './qwen-ai'
import { ZaiAdapter } from './zai'
import { ProviderType, AdapterConfig } from '../types'

/**
 * Adapter factory function
 */
export function createAdapter(
  providerType: ProviderType,
  config: AdapterConfig
): BaseOAuthAdapter {
  switch (providerType) {
    case 'stepfun':
      return new StepFunOAuthAdapter(config)
    case 'deepseek':
      return new DeepSeekAdapter(config)
    case 'glm':
      return new GLMAdapter(config)
    case 'kimi':
      return new KimiAdapter(config)
    case 'mimo':
      return new MimoAdapter(config)
    case 'minimax':
      return new MiniMaxAdapter(config)
    case 'perplexity':
      return new PerplexityAdapter(config)
    case 'qwen':
      return new QwenAdapter(config)
    case 'qwen-ai':
      return new QwenAiAdapter(config)
    case 'zai':
      return new ZaiAdapter(config)
    default:
      throw new Error(`不支持的供应商类型：${providerType}`)
  }
}

/**
 * Get supported authentication methods for provider
 */
export function getSupportedAuthMethods(providerType: ProviderType): string[] {
  switch (providerType) {
    case 'stepfun':
      return ['manual', 'browser']
    case 'deepseek':
      return ['manual', 'browser']
    case 'glm':
      return ['manual', 'browser']
    case 'kimi':
      return ['manual', 'browser']
    case 'mimo':
      return ['manual', 'cookie', 'browser']
    case 'minimax':
      return ['manual', 'browser']
    case 'perplexity':
      return ['manual', 'cookie']
    case 'qwen':
      return ['manual', 'cookie']
    case 'qwen-ai':
      return ['manual', 'browser']
    case 'zai':
      return ['manual', 'browser']
    default:
      return ['manual']
  }
}
