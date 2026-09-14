/**
 * Prompt Adapter Module - Base Interface and Types
 * Provides abstraction for different client prompt formats
 */
import { ChatMessage, ChatCompletionTool, ToolCall } from '../../types';
import { ClientType } from '../../utils/promptSignatures';
/**
 * Tool call output format
 */
export type ToolCallFormat = 'bracket' | 'xml' | 'anthropic' | 'json' | 'native';
/**
 * Prompt variant configuration
 */
export interface PromptVariant {
    id: string;
    name: string;
    description?: string;
    modelPatterns: string[];
    systemPrompt: string;
    toolPromptTemplate: string;
    toolCallFormat: ToolCallFormat;
    examples?: string[];
}
/**
 * Result of prompt transformation
 */
export interface TransformResult {
    messages: ChatMessage[];
    tools: ChatCompletionTool[] | undefined;
    injected: boolean;
    variant?: PromptVariant;
}
/**
 * Result of tool call parsing
 */
export interface ParseResult {
    content: string;
    toolCalls: ToolCall[];
    format: ToolCallFormat;
}
/**
 * Base interface for prompt adapters
 */
export interface PromptAdapter {
    name: string;
    clientType: ClientType;
    detectSignatures: string[];
    hasPromptInjected(messages: ChatMessage[]): boolean;
    toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string;
    parseToolCalls(content: string): ParseResult;
    getPromptVariant(model: string, provider?: string): PromptVariant | null;
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, provider?: string): TransformResult;
}
/**
 * Abstract base class for prompt adapters
 */
export declare abstract class BasePromptAdapter implements PromptAdapter {
    abstract name: string;
    abstract clientType: ClientType;
    abstract detectSignatures: string[];
    protected variants: PromptVariant[];
    hasPromptInjected(messages: ChatMessage[]): boolean;
    abstract toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string;
    abstract parseToolCalls(content: string): ParseResult;
    getPromptVariant(model: string, provider?: string): PromptVariant | null;
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, provider?: string): TransformResult;
    protected injectPrompt(messages: ChatMessage[], prompt: string): ChatMessage[];
    protected extractAllContent(messages: ChatMessage[]): string;
    protected registerVariant(variant: PromptVariant): void;
}
