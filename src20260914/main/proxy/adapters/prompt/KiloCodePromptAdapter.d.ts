/**
 * Kilo Code Prompt Adapter
 * Handles tool prompt injection for Kilo Code client
 *
 * Kilo Code injects its own tool prompt format, but some models (like DeepSeek)
 * may not understand it. This adapter:
 * 1. Detects Kilo Code's injected prompts
 * 2. Replaces them with our standard format that models understand better
 */
import { ChatMessage, ChatCompletionTool } from '../../types';
import { BasePromptAdapter, PromptVariant, TransformResult, ParseResult } from './BasePromptAdapter';
import { ClientType } from '../../utils/promptSignatures';
export declare class KiloCodePromptAdapter extends BasePromptAdapter {
    name: string;
    clientType: ClientType;
    detectSignatures: string[];
    constructor();
    hasPromptInjected(messages: ChatMessage[]): boolean;
    toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string;
    parseToolCalls(content: string): ParseResult;
    getPromptVariant(model: string, _provider?: string): PromptVariant | null;
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, provider?: string): TransformResult;
    private cleanKiloCodePrompt;
    private removeKiloCodeToolSection;
}
export declare const kiloCodePromptAdapter: KiloCodePromptAdapter;
