/**
 * Kilo Code Prompt Adapter
 * Handles tool prompt injection for Kilo Code client
 *
 * Kilo Code injects its own tool prompt format, but some models (like DeepSeek)
 * may not understand it. This adapter:
 * 1. Detects Kilo Code's injected prompts
 * 2. Cleans them from the messages
 * 3. Replaces them with our standard format that models understand better
 */
import { ChatMessage, ChatCompletionTool } from '../types';
import { BasePromptAdapter, PromptVariant, TransformResult, ParseResult } from './BasePromptAdapter';
import { ClientType } from '../../constants/signatures';
export declare class KiloCodePromptAdapter extends BasePromptAdapter {
    name: string;
    clientType: ClientType;
    detectSignatures: string[];
    constructor();
    hasPromptInjected(messages: ChatMessage[]): boolean;
    toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string;
    parseToolCalls(content: string): ParseResult;
    getPromptVariant(model: string, _provider?: string): PromptVariant | null;
    /**
     * KiloCode special handling: if prompt already injected, CLEAN it first
     * then re-inject with our standard format. This fixes models that
     * don't understand KiloCode's native format.
     */
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, provider?: string): TransformResult;
    /**
     * Remove KiloCode's tool prompt sections from system messages
     */
    private cleanKiloCodePrompt;
    /**
     * Strip KiloCode-specific tool sections from content
     */
    private removeKiloCodeToolSection;
}
export declare const kiloCodePromptAdapter: KiloCodePromptAdapter;
