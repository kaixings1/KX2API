/**
 * Prompt Variant Selector
 * Selects the appropriate prompt variant based on model and provider
 */
import type { PromptVariantSelectorOptions } from './types';
/**
 * Select the appropriate prompt variant
 */
export declare function selectPromptVariant(options: PromptVariantSelectorOptions): PromptVariant;
export declare function registerVariants(variants: PromptVariant[]): void;
/**
 * Get all available variants
 */
export declare function getAvailableVariants(): PromptVariant[];
/**
 * Get variant by ID
 */
export declare function getVariantById(id: string): PromptVariant | undefined;
/**
 * Register a custom variant
 */
export declare function registerVariant(variant: PromptVariant): void;
