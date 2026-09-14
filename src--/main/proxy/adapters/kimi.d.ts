/**
 * Kimi K2.6 Adapter
 * Implements Kimi web API protocol with thinking mode and web search support
 */
import { AxiosResponse } from 'axios';
import { Account, Provider } from '../../store/types';
import { PassThrough } from 'stream';
import type { ToolCallingPlan } from '../toolCalling/types';
interface KimiMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | any[] | null;
    tool_call_id?: string;
    tool_calls?: any[];
}
interface ChatCompletionRequest {
    model: string;
    messages: KimiMessage[];
    stream?: boolean;
    temperature?: number;
    enableThinking?: boolean;
    enableWebSearch?: boolean;
    tools?: any[];
    tool_choice?: any;
    conversationId?: string;
    parentId?: string;
}
export declare function detectTokenType(token: string): 'jwt' | 'refresh';
export declare class KimiAdapter {
    private provider;
    private account;
    private token;
    constructor(provider: Provider, account: Account);
    private acquireToken;
    private messagesPrepare;
    private wrapUrlsToTags;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        response: AxiosResponse;
        conversationId: string;
    }>;
    deleteConversation(conversationId: string): Promise<boolean>;
    private listChats;
    private batchDeleteChats;
    deleteAllChats(): Promise<boolean>;
    static isKimiProvider(provider: Provider): boolean;
}
export declare class KimiStreamHandler {
    private model;
    private conversationId;
    private enableThinking;
    private toolStreamParser?;
    private toolCallingPlan?;
    private realChatId;
    private _pendingToolCalls;
    private lastMessageId;
    private hasError;
    private currentPhase;
    private reasoningBuffer;
    private fullTextBuffer;
    constructor(model: string, conversationId: string, enableThinking?: boolean, toolCallingPlan?: ToolCallingPlan);
    getConversationId(): string | null;
    getLastMessageId(): string | null;
    hasSessionError(): boolean;
    private detectMultiStage;
    private isThinkingMask;
    private isAnswerMask;
    private extractThinkContent;
    private extractTextContent;
    handleStream(stream: any): Promise<PassThrough>;
    private processBuffer;
    private handleMessage;
    private sendChunk;
    private parseKimiNativeToolCalls;
    private buildToolCallChunk;
    handleNonStream(stream: any): Promise<any>;
}
export declare const kimiAdapter: {
    KimiAdapter: typeof KimiAdapter;
    KimiStreamHandler: typeof KimiStreamHandler;
};
export {};
