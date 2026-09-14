/**
 * Prompt Adapter Registry
 * Central registry for managing client-specific prompt adapters
 *
 * This is the integration point between the fork project's client detection
 * system and the current project's ToolCallingEngine.
 *
 * Usage in ToolCallingEngine.transformRequest():
 *   1. Before injecting our own prompt, ask the registry if a known client
 *      has already injected one
 *   2. If KiloCode injected its prompt → clean it, then inject our standard format
 *   3. If Cherry Studio / unknown → skip duplicate injection
 *   4. If no client detected → proceed with normal injection
 */
import { ChatMessage, ChatCompletionTool } from '../types';
import { PromptAdapter, PromptVariant, TransformResult, ParseResult } from './BasePromptAdapter';
/**
 * Registry for prompt adapters
 * Manages adapter registration, client detection, and request transformation
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
     * Unregister a prompt adapter
     */
    unregister(name: string): boolean;
    /**
     * Get adapter by name
     */
    getAdapter(name: string): PromptAdapter | undefined;
    /**
     * Get all registered adapters
     */
    getAllAdapters(): PromptAdapter[];
    /**
     * Detect which client has injected the prompt from messages.
     * Returns the most appropriate adapter, or null if unknown.
     */
    detect(messages: ChatMessage[]): PromptAdapter | null;
    /**
     * Check if any known client has injected a tool prompt
     */
    hasPromptInjected(messages: ChatMessage[]): boolean;
    /**
     * Transform request using the appropriate adapter for the detected client
     *
     * This is the main entry point called by ToolCallingEngine before injecting
     * its own prompt. It handles:
     * - Detecting client-injected prompts
     * - Cleaning KiloCode's incompatible format
     * - Skipping injection if Cherry Studio already injected one
     */
    transformRequest(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, model: string, provider?: string): TransformResult;
    /**
     * Parse tool calls using the appropriate adapter
     */
    parseToolCalls(content: string, adapterName?: string): ParseResult;
    /**
     * Get prompt variant for a specific model
     */
    getPromptVariant(model: string, provider?: string, adapterName?: string): PromptVariant | null;
    /**
     * Find adapter by client type
     */
    private findAdapterByClientType;
    /**
     * Detect adapter from response content format
     */
    private detectAdapterFromContent;
    /**
     * Extract all text content from messages
     */
    private extractAllContent;
}
/**
 * Singleton instance
 */
export declare const promptAdapterRegistry: PromptAdapterRegistry;
