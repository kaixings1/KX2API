/**
 * Cherry Studio Prompt Adapter
 * Handles prompt detection and transformation for Cherry Studio client
 */
import { ChatMessage, ChatCompletionTool } from '../../types';
import { BasePromptAdapter, PromptVariant, TransformResult, ParseResult } from './BasePromptAdapter';
import { ClientType } from '../../utils/promptSignatures';
/**
 * Cherry Studio Prompt Adapter
 * Supports both bracket format and XML format tool calls
 */
export declare class CherryStudioPromptAdapter extends BasePromptAdapter {
    name: string;
    clientType: ClientType;
    detectSignatures: string[];
    constructor();
    hasPromptInjected(messages: ChatMessage[]): boolean;
    toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string;
    parseToolCalls(content: string): ParseResult;
    private parseXmlToolCalls;
    getPromptVariant(_model: string, _provider?: string): PromptVariant | null;
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, _provider?: string): TransformResult;
}
export declare const cherryStudioPromptAdapter: CherryStudioPromptAdapter;
