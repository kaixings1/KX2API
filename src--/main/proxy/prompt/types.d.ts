/**
 * Prompt Variant Types
 * Defines types for model-specific prompt variants
 */
import type { ToolCallFormat } from '../toolCalling/promptAdapters/BasePromptAdapter';
/**
 * Prompt variant configuration
 */
export interface PromptVariant {
    id: string;
    name: string;
    description?: string;
    modelPatterns: string[];
    providerPatterns?: string[];
    systemPrompt: string;
    toolPromptTemplate: string;
    toolCallFormat: ToolCallFormat;
    examples?: string[];
    priority?: number;
}
/**
 * Prompt variant selector options
 */
export interface PromptVariantSelectorOptions {
    model: string;
    provider?: string;
    preferVariant?: string;
}
/**
 * Built-in variant IDs
 */
export declare const BUILTIN_VARIANT_IDS: {
    readonly DEFAULT: "default";
    readonly QWEN: "qwen";
    readonly DEEPSEEK: "deepseek";
    readonly GLM: "glm";
    readonly KIMI: "kimi";
    readonly MINIMAX: "minimax";
    readonly ANTHROPIC: "anthropic";
};
export type BuiltinVariantId = typeof BUILTIN_VARIANT_IDS[keyof typeof BUILTIN_VARIANT_IDS];
