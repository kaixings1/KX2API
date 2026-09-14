/**
 * Cherry Studio Prompt Adapter
 * Handles prompt detection and transformation for Cherry Studio client
 *
 * Supports both bracket format and XML format tool calls
 */
import { ChatMessage, ChatCompletionTool } from '../types';
import { BasePromptAdapter, PromptVariant, TransformResult, ParseResult } from './BasePromptAdapter';
import { ClientType } from '../../constants/signatures';
/**
 * Cherry Studio prompt variant
 */
export declare const CHERRY_STUDIO_VARIANT: PromptVariant;
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
    /**
     * Parse Cherry Studio XML format: <tool_use><name>xxx</name><arguments>{...}</arguments></tool_use>
     */
    private parseXmlToolCalls;
    getPromptVariant(_model: string, _provider?: string): PromptVariant | null;
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, _provider?: string): TransformResult;
}
export declare const cherryStudioPromptAdapter: CherryStudioPromptAdapter;
