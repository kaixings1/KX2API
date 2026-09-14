/**
 * Base Prompt Adapter
 * Abstract base class for client-specific prompt adapters
 *
 * Each adapter handles:
 * - Detecting if the client has already injected tool prompts
 * - Converting tools to prompt text (client-specific format)
 * - Parsing tool calls from response content (client-specific format)
 * - Selecting the best prompt variant for a model
 */
import { ChatMessage, ChatCompletionTool, ToolCall } from '../types';
import { ClientType } from '../../constants/signatures';
/**
 * Tool call output format
 */
export type ToolCallFormat = 'bracket' | 'xml' | 'anthropic' | 'json' | 'native';
/**
 * Prompt variant configuration
 * A variant defines how tools are presented to a specific model/provider
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
    priority?: number;
}
/**
 * Result of prompt transformation
 */
export interface TransformResult {
    messages: ChatMessage[];
    tools: ChatCompletionTool[] | undefined;
    injected: boolean;
    variant?: PromptVariant;
    cleaned?: boolean;
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
 * Provides common functionality for all adapters
 */
export declare abstract class BasePromptAdapter implements PromptAdapter {
    abstract name: string;
    abstract clientType: ClientType;
    abstract detectSignatures: string[];
    protected variants: PromptVariant[];
    /**
     * Check if this adapter's prompt has already been injected into messages
     */
    hasPromptInjected(messages: ChatMessage[]): boolean;
    /**
     * Convert tools array to prompt text string
     * Must be implemented by each adapter
     */
    abstract toolsToPrompt(tools: ChatCompletionTool[], variant?: PromptVariant): string;
    /**
     * Parse tool calls from response content
     * Must be implemented by each adapter
     */
    abstract parseToolCalls(content: string): ParseResult;
    /**
     * Get the best prompt variant for a given model
     */
    getPromptVariant(model: string, provider?: string): PromptVariant | null;
    /**
     * Transform request by injecting tool prompt into messages
     * If prompt already injected, skip injection
     */
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, provider?: string): TransformResult;
    /**
     * Inject prompt into messages by appending to system message
     * or creating a new system message
     */
    protected injectPrompt(messages: ChatMessage[], prompt: string): ChatMessage[];
    /**
     * Extract all text content from messages for signature detection
     */
    protected extractAllContent(messages: ChatMessage[]): string;
    /**
     * Register a prompt variant
     */
    protected registerVariant(variant: PromptVariant): void;
}
