/**
 * Provider Adapter Index
 */

export { StepFunAdapter, StepFunStreamHandler, stepfunAdapter } from './stepfun'
export { DeepSeekAdapter, deepSeekAdapter } from './deepseek'
export { DeepSeekStreamHandler } from './deepseek-stream'
export { GLMAdapter, GLMStreamHandler, glmAdapter } from './glm'
export { KimiAdapter, KimiStreamHandler, kimiAdapter } from './kimi'
export { MimoAdapter, MimoStreamHandler, mimoAdapter } from './mimo'
export { MiniMaxAdapter, MiniMaxStreamHandler, minimaxAdapter } from './minimax'
// 注：perplexity.ts 只导出 PerplexityAdapter / perplexityAdapter，
// 没有 PerplexityStreamHandler（原导出指向不存在的成员，TS2305）。
export { PerplexityAdapter, perplexityAdapter } from './perplexity'
export { QwenAdapter, QwenStreamHandler, qwenAdapter } from './qwen'
export { QwenAiAdapter, QwenAiStreamHandler, qwenAiAdapter } from './qwen-ai'
export { ZaiAdapter, ZaiStreamHandler, zaiAdapter } from './zai'

// --- Extended suppliers (one-api/new-api parity) ---
export { OpenAIAdapter, openaiAdapter } from './openai'
export { OpenAIStreamHandler } from './openai-stream'
export { AnthropicAdapter, anthropicAdapter } from './anthropic'
export { AnthropicStreamHandler } from './anthropic-stream'
export { GoogleAdapter, googleAdapter } from './google'
export { GoogleStreamHandler } from './google-stream'
export { OllamaAdapter, ollamaAdapter } from './ollama'
export { OllamaStreamHandler } from './ollama-stream'
export { GroqAdapter, groqAdapter } from './groq'
export { GroqStreamHandler } from './groq-stream'
export { TogetherAdapter, togetherAdapter } from './together'
export { TogetherStreamHandler } from './together-stream'
export { CozeAdapter, cozeAdapter } from './coze'
export { CozeStreamHandler } from './coze-stream'
export { MistralAdapter, mistralAdapter } from './mistral'
export { MistralStreamHandler } from './mistral-stream'
export { XAIAdapter, xaiAdapter } from './xai'
export { XAIStreamHandler } from './xai-stream'
export { SiliconCloudAdapter, siliconCloudAdapter } from './siliconcloud'
export { SiliconCloudStreamHandler } from './siliconcloud-stream'
// 注：transformers/* 导出的是**函数集合**（toOpenAIMessage / fromAnthropicResponse 等），
// 没有名为 XxxTransformer 的类 —— 原先这三行指向不存在的成员（TS2305）。
// 需要转换函数请直接从对应模块导入。
export * from './transformers/openai'
export * from './transformers/anthropic'
export * from './transformers/gemini'
