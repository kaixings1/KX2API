/**
 * Context Management Service
 * Manages conversation context with multiple strategies:
 * 1. Sliding Window - Keep recent N messages
 * 2. Token Limit - Truncate by token count
 * 3. Summary Compression - Summarize early conversation
 */
import type { ChatMessage } from '../types';
/**
 * Sliding Window Strategy Configuration
 */
export interface SlidingWindowConfig {
    enabled: boolean;
    maxMessages: number;
}
/**
 * Token Limit Strategy Configuration
 */
export interface TokenLimitConfig {
    enabled: boolean;
    maxTokens: number;
}
/**
 * Summary Compression Strategy Configuration
 */
export interface SummaryConfig {
    enabled: boolean;
    keepRecentMessages: number;
    summaryPrompt?: string;
}
/**
 * Context Management Configuration
 */
export interface ContextManagementConfig {
    enabled: boolean;
    strategies: {
        slidingWindow: SlidingWindowConfig;
        tokenLimit: TokenLimitConfig;
        summary: SummaryConfig;
    };
    executionOrder: ('slidingWindow' | 'tokenLimit' | 'summary')[];
}
/**
 * Strategy Execution Result
 */
export interface StrategyResult {
    messages: ChatMessage[];
    originalCount: number;
    processedCount: number;
    strategyName: string;
    trimmed: boolean;
}
/**
 * Context Processing Result
 */
export interface ContextProcessResult {
    messages: ChatMessage[];
    originalCount: number;
    finalCount: number;
    strategyResults: StrategyResult[];
    summaryGenerated?: boolean;
}
/**
 * Default Configuration
 */
export declare const DEFAULT_SLIDING_WINDOW_CONFIG: SlidingWindowConfig;
export declare const DEFAULT_TOKEN_LIMIT_CONFIG: TokenLimitConfig;
export declare const DEFAULT_SUMMARY_CONFIG: SummaryConfig;
export declare const DEFAULT_CONTEXT_MANAGEMENT_CONFIG: ContextManagementConfig;
/**
 * Sliding Window Strategy
 * Keeps the most recent N messages, always preserving system messages
 */
export declare class SlidingWindowStrategy {
    private config;
    constructor(config?: SlidingWindowConfig);
    execute(messages: ChatMessage[]): StrategyResult;
}
/**
 * Token Limit Strategy
 * Truncates history by token count, always preserving system messages
 */
export declare class TokenLimitStrategy {
    private config;
    constructor(config?: TokenLimitConfig);
    execute(messages: ChatMessage[]): StrategyResult;
}
/**
 * Summary Generation Function Type
 */
export type SummaryGenerator = (messages: ChatMessage[], prompt?: string) => Promise<string>;
/**
 * Summary Compression Strategy
 * Generates summary for early conversation, keeps recent messages + summary
 */
export declare class SummaryStrategy {
    private config;
    private summaryGenerator?;
    constructor(config?: SummaryConfig, summaryGenerator?: SummaryGenerator);
    execute(messages: ChatMessage[]): Promise<StrategyResult>;
}
/**
 * Context Management Service
 * Orchestrates multiple context management strategies
 */
export declare class ContextManagementService {
    private config;
    private slidingWindowStrategy;
    private tokenLimitStrategy;
    private summaryStrategy;
    constructor(config?: ContextManagementConfig, summaryGenerator?: SummaryGenerator);
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ContextManagementConfig>): void;
    /**
     * Process messages through all enabled strategies
     */
    process(messages: ChatMessage[]): Promise<ContextProcessResult>;
    /**
     * Get current configuration
     */
    getConfig(): ContextManagementConfig;
    /**
     * Estimate total tokens for messages
     */
    static estimateTotalTokens(messages: ChatMessage[]): number;
}
/**
 * Create default context management service instance
 */
export declare function createContextManagementService(config?: Partial<ContextManagementConfig>, summaryGenerator?: SummaryGenerator): ContextManagementService;
