/**
 * Default Prompt Adapter
 * Standard adapter for generic models using bracket format
 *
 * Handles the standard [function_calls][call:name]{args}[/call][/function_calls] format
 */
import { ChatMessage, ChatCompletionTool } from '../types';
import { BasePromptAdapter, PromptVariant, TransformResult, ParseResult } from './BasePromptAdapter';
import { ClientType } from '../../constants/signatures';
/**
 * Default prompt variant for generic models
 */
export declare const DEFAULT_VARIANT: PromptVariant;
/**
 * Default Prompt Adapter
 * Implements the standard tool prompt injection behavior
 */
export declare class DefaultPromptAdapter extends BasePromptAdapter {
    name: string;
    clientType: ClientType;
    detectSignatures: string[];
    constructor();
    hasPromptInjected(messages: ChatMessage[]): boolean;
    toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string;
    parseToolCalls(content: string): ParseResult;
    getPromptVariant(model: string, provider?: string): PromptVariant | null;
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, _provider?: string): TransformResult;
}
export declare const defaultPromptAdapter: DefaultPromptAdapter;
