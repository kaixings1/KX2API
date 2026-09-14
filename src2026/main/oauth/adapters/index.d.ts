/**
 * OAuth Adapter Index
 * Export all provider authentication adapters
 */
export { StepFunOAuthAdapter } from './stepfun';
export { BaseOAuthAdapter } from './base';
export { DeepSeekAdapter } from './deepseek';
export { GLMAdapter } from './glm';
export { KimiAdapter } from './kimi';
export { MimoAdapter } from './mimo';
export { MiniMaxAdapter } from './minimax';
export { PerplexityAdapter } from './perplexity';
export { QwenAdapter } from './qwen';
export { QwenAiAdapter } from './qwen-ai';
export { ZaiAdapter } from './zai';
import { BaseOAuthAdapter } from './base';
import { ProviderType, AdapterConfig } from '../types';
/**
 * Adapter factory function
 */
export declare function createAdapter(providerType: ProviderType, config: AdapterConfig): BaseOAuthAdapter;
/**
 * Get supported authentication methods for provider
 */
export declare function getSupportedAuthMethods(providerType: ProviderType): string[];
