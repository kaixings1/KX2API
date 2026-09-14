/**
 * Mimo Adapter
 * Implements Mimo (Xiaomi AI Studio) API protocol
 */
import type { AxiosResponse } from 'axios';
import type { Account, Provider } from '../../store/types.ts';
import type { ChatMessage } from '../types.ts';
import type { ToolCallingPlan } from '../toolCalling/types.ts';
type MimoMessage = ChatMessage;
interface ChatCompletionRequest {
    model: string;
    originalModel?: string;
    messages: MimoMessage[];
    stream?: boolean;
    temperature?: number;
}
interface MimoUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens: number;
}
export interface ParsedToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
export declare function parseToolCalls(text: string): ParsedToolCall[];
export declare function hasToolCallMarker(text: string): boolean;
export declare function buildMimoQuery(messages: MimoMessage[]): string;
export declare class MimoAdapter {
    private provider;
    private account;
    constructor(provider: Provider, account: Account);
    private getCredentials;
    static isMimoProvider(provider: Provider): boolean;
    private buildUrl;
    private buildHeaders;
    private saveConversation;
    generateConversationTitle(conversationId: string, query: string, answer: string): Promise<boolean>;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        response: AxiosResponse;
        conversationId: string;
        query: string;
    }>;
    private getConversationList;
    private deleteConversations;
    deleteSession(conversationId: string): Promise<boolean>;
    deleteAllChats(): Promise<boolean>;
}
export declare class MimoStreamHandler {
    private model;
    private conversationId;
    private content;
    private thinking;
    private usage;
    private dialogId;
    private toolCalls;
    private thinkingMode;
    private lastSentContentLen;
    private lastSentThinkLen;
    private toolCallBuf;
    private pendingText;
    private citationBuffer;
    private thinkingCitationBuffer;
    private toolStreamParser?;
    constructor(model: string, conversationId: string, thinkingMode?: 'passthrough' | 'strip' | 'separate', toolCallingPlan?: ToolCallingPlan);
    handleStream(stream: NodeJS.ReadableStream): AsyncGenerator<string>;
    handleNonStream(stream: NodeJS.ReadableStream): Promise<string>;
    private formatOpenAIChunk;
    private createBaseChunk;
    private formatOpenAIToolCallChunk;
    private formatOpenAIUsageChunk;
    getConversationId(): string;
    getAssistantContentForTitle(): string;
    getDialogId(): string;
    getUsage(): MimoUsage | null;
}
export declare const mimoAdapter: {
    MimoAdapter: typeof MimoAdapter;
    MimoStreamHandler: typeof MimoStreamHandler;
};
export {};
