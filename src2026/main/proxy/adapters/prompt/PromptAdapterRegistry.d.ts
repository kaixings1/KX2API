/**
 * Prompt Adapter Registry
 * Central registry for managing prompt adapters
 * Simplified to focus on adapter registration and lookup
 */
import { ChatMessage, ChatCompletionTool } from '../../types';
import { PromptAdapter, PromptVariant, TransformResult, ParseResult } from './BasePromptAdapter';
import { ClientType } from '../../utils/promptSignatures';
/**
 * Registry for prompt adapters
 * Manages adapter registration, detection, and selection
 */
export declare class PromptAdapterRegistry {
    private adapters;
    private defaultAdapter;
    constructor();
    /**
     * Register a prompt adapter
     */
    register(adapter: PromptAdapter): void;
    /**
     * Get adapter by name
     */
    get(name: string): PromptAdapter | undefined;
    /**
     * Get all registered adapters
     */
    getAll(): PromptAdapter[];
    /**
     * Check if any prompt has been injected
     * Uses unified signature detection
     */
    hasPromptInjected(messages: ChatMessage[]): boolean;
    /**
     * Detect client type from messages
     */
    detectClient(messages: ChatMessage[]): ClientType;
    /**
     * Transform request using appropriate adapter
     */
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, provider?: string): TransformResult;
    /**
     * Transform request with specific format
     * Used by PromptInjectionService for controlled injection
     */
    transformRequestWithFormat(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, format: 'bracket' | 'xml', provider?: string, skipDetection?: boolean): TransformResult;
    /**
     * Parse tool calls from response content
     */
    parseToolCalls(content: string, adapterName?: string): ParseResult;
    /**
     * Get prompt variant for model
     */
    getPromptVariant(model: string, provider?: string): PromptVariant | null;
    /**
     * Detect adapter from messages
     */
    private detect;
    /**
     * Find adapter by client type
     */
    private findAdapterByClientType;
    /**
     * Detect adapter from response content
     */
    private detectAdapterFromContent;
    /**
     * Extract all text content from messages
     */
    private extractAllContent;
}
export declare const promptAdapterRegistry: PromptAdapterRegistry;
