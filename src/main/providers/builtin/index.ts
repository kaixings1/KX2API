import deepseekConfig from './deepseek.ts'
import glmConfig from './glm.ts'
import kimiConfig from './kimi.ts'
import minimaxConfig from './minimax.ts'
import mimoConfig from './mimo.ts'
import perplexityConfig from './perplexity.ts'
import qwenConfig from './qwen.ts'
import qwenAiConfig from './qwen-ai.ts'
import zaiConfig from './zai.ts'
import stepfunConfig from './stepfun.ts'
import stepfunStudioConfig from './stepfun-studio.ts'
import openaiConfig from './openai.ts'
import anthropicConfig from './anthropic.ts'
import googleConfig from './google.ts'
import ollamaConfig from './ollama.ts'
import groqConfig from './groq.ts'
import togetherConfig from './together.ts'
import mistralConfig from './mistral.ts'
import xaiConfig from './xai.ts'
import siliconCloudConfig from './siliconcloud.ts'
import cozeConfig from './coze.ts'
import type { BuiltinProviderConfig } from '../../store/types.ts'

export const builtinProviders: BuiltinProviderConfig[] = [
  deepseekConfig,
  glmConfig,
  kimiConfig,
  minimaxConfig,
  mimoConfig,
  perplexityConfig,
  qwenConfig,
  qwenAiConfig,
  zaiConfig,
  stepfunConfig,
  stepfunStudioConfig,
  openaiConfig,
  anthropicConfig,
  googleConfig,
  ollamaConfig,
  groqConfig,
  togetherConfig,
  mistralConfig,
  xaiConfig,
  siliconCloudConfig,
  cozeConfig,
]

export const builtinProviderMap: Record<string, BuiltinProviderConfig> = {
  deepseek: deepseekConfig,
  glm: glmConfig,
  kimi: kimiConfig,
  minimax: minimaxConfig,
  mimo: mimoConfig,
  perplexity: perplexityConfig,
  qwen: qwenConfig,
  'qwen-ai': qwenAiConfig,
  zai: zaiConfig,
  stepfun: stepfunConfig,
  'stepfun-studio': stepfunStudioConfig,
  openai: openaiConfig,
  anthropic: anthropicConfig,
  google: googleConfig,
  ollama: ollamaConfig,
  groq: groqConfig,
  together: togetherConfig,
  mistral: mistralConfig,
  xai: xaiConfig,
  siliconcloud: siliconCloudConfig,
  coze: cozeConfig,
}

export function getBuiltinProvider(id: string): BuiltinProviderConfig | undefined {
  return builtinProviderMap[id]
}

export function getBuiltinProviders(): BuiltinProviderConfig[] {
  return builtinProviders
}

export {
  deepseekConfig,
  glmConfig,
  kimiConfig,
  minimaxConfig,
  mimoConfig,
  perplexityConfig,
  qwenConfig,
  qwenAiConfig,
  zaiConfig,
  stepfunConfig,
  stepfunStudioConfig,
  openaiConfig,
  anthropicConfig,
  googleConfig,
  ollamaConfig,
  groqConfig,
  togetherConfig,
  mistralConfig,
  xaiConfig,
  siliconCloudConfig,
  cozeConfig,
}

export default builtinProviders
