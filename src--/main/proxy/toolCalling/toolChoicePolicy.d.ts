import type { ChatCompletionToolChoice } from '../types.ts';
import type { NormalizedToolDefinition } from './types.ts';
export type ToolChoiceMode = 'auto' | 'none' | 'required' | 'forced';
export interface NormalizedToolChoicePolicy {
    mode: ToolChoiceMode;
    allowedToolNames: Set<string>;
    forcedName?: string;
}
export declare class ToolChoicePolicyError extends Error {
    code: string;
    constructor(code: string, message: string);
}
export declare function normalizeToolChoicePolicy(toolChoice: ChatCompletionToolChoice | undefined, tools: NormalizedToolDefinition[]): NormalizedToolChoicePolicy;
