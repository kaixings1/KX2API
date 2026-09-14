/**
 * Default Prompt Adapter
 * Maintains backward compatibility with existing tool prompt injection logic
 *
 * Uses variants from prompt/variants/ directory for unified variant definitions
 */
import { ChatMessage, ChatCompletionTool } from '../../types';
import { BasePromptAdapter, PromptVariant, TransformResult, ParseResult } from './BasePromptAdapter';
import { ClientType } from '../../utils/promptSignatures';
/**
 * Default Prompt Adapter
 * Implements the current tool prompt injection behavior
 */
export declare class DefaultPromptAdapter extends BasePromptAdapter {
    name: string;
    clientType: ClientType;
    detectSignatures: any;
    constructor();
    hasPromptInjected(messages: ChatMessage[]): boolean;
    toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string;
    parseToolCalls(content: string): ParseResult;
    private parseXmlToolCalls;
    getPromptVariant(model: string, _provider?: string): PromptVariant | null;
    getVariantByFormat(format: 'bracket' | 'xml'): PromptVariant;
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, _provider?: string): TransformResult;
    transformRequestWithFormat(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, format: 'bracket' | 'xml', _provider?: string, skipDetection?: boolean): TransformResult;
}
export declare const defaultPromptAdapter: DefaultPromptAdapter;
