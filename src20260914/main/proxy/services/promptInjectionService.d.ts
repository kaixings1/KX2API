/**
 * Prompt Injection Service
 * Single entry point for all tool prompt injection logic
 *
 * Responsibilities:
 * 1. Read configuration
 * 2. Detect client and tool source
 * 3. Decide whether to inject based on mode
 * 4. Generate and inject prompt
 */
import { ChatMessage, ChatCompletionTool } from '../types';
/**
 * Injection mode type (simplified)
 */
export type InjectionMode = 'auto' | 'always' | 'never';
/**
 * Injection result
 */
export interface InjectionResult {
    messages: ChatMessage[];
    injected: boolean;
    tools: ChatCompletionTool[] | null;
    shouldParseToolCalls: boolean;
    reason?: string;
}
/**
 * Prompt Injection Service
 */
export declare class PromptInjectionService {
    /**
     * Process messages and inject tool prompt if needed
     * This is the SINGLE ENTRY POINT for all injection logic
     */
    process(messages: ChatMessage[], tools: ChatCompletionTool[], model: string, provider?: string): InjectionResult;
    /**
     * Get configuration from store
     */
    private getConfig;
    /**
     * Decide whether to inject
     * Simplified logic based on mode
     */
    private shouldInject;
    /**
     * Generate prompt based on detection result
     */
    private generatePrompt;
    /**
     * Generate Perplexity-specific prompt from MCP tool definitions
     */
    private generatePerplexityPromptFromMCP;
    /**
     * Inject prompt to messages
     */
    private injectToMessages;
}
/**
 * Singleton instance
 */
export declare const promptInjectionService: PromptInjectionService;
