/**
 * Built-in System Prompts
 */
import type { SystemPrompt } from '../store/types';
/**
 * Built-in System Prompts Array
 */
export declare const BUILTIN_PROMPTS: SystemPrompt[];
/**
 * Get built-in prompt by ID
 */
export declare function getBuiltinPromptById(id: string): SystemPrompt | undefined;
