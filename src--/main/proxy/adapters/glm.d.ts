/**
 * GLM Adapter
 * Implements GLM (Zhipu Qingyan) web API protocol
 */
import { AxiosResponse } from 'axios';
import { Account, Provider } from '../../store/types';
import { PassThrough } from 'stream';
import type { ToolCallingPlan } from '../toolCalling/types';
interface GLMMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | any[] | null;
    tool_call_id?: string;
    tool_calls?: any[];
}
interface ChatCompletionRequest {
    model: string;
    originalModel?: string;
    messages: GLMMessage[];
    stream?: boolean;
    temperature?: number;
    web_search?: boolean;
    reasoning_effort?: 'low' | 'medium' | 'high';
    deep_research?: boolean;
    tools?: any[];
    tool_choice?: any;
}
export declare class GLMAdapter {
    private provider;
    private account;
    constructor(provider: Provider, account: Account);
    private getRefreshToken;
    private acquireToken;
    /**
     * Check if URL is base64 data
     */
    private isBase64Data;
    /**
     * Extract MIME type from base64 data URL
     */
    private extractBase64Format;
    /**
     * Remove base64 data header
     */
    private removeBase64Header;
    /**
     * Upload file to GLM
     */
    private uploadFile;
    /**
     * Extract file URLs from message content
     */
    private extractFileUrls;
    private messagesToPrompt;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        response: AxiosResponse;
        conversationId: string;
    }>;
    deleteConversation(conversationId: string): Promise<boolean>;
    deleteAllChats(): Promise<boolean>;
    static isGLMProvider(provider: Provider): boolean;
}
export declare class GLMStreamHandler {
    private conversationId;
    private model;
    private created;
    private onEnd?;
    private toolStreamParser?;
    private toolCallingPlan?;
    private userPrompt;
    private lastFileName;
    private injectedTool;
    emptyToolCallsDetected: boolean;
    private retryCallback?;
    alreadyRetried: boolean;
    private static readonly TOOL_DEDUP_WINDOW_MS;
    private static injectedToolFingerprints;
    private static toolFingerprint;
    private static isToolRecentlyInjected;
    private static markToolInjected;
    constructor(model: string, onEnd?: any, initialConversationId?: string, toolCallingPlan?: ToolCallingPlan, userPrompt?: string, retryCallback?: (clientStream: any) => void, lastFileName?: string);
    private buildInjectedToolCall;
    handleStream(stream: any): Promise<PassThrough>;
    handleNonStream(stream: any): Promise<any>;
    getConversationId(): string;
}
export declare const glmAdapter: {
    GLMAdapter: typeof GLMAdapter;
    GLMStreamHandler: typeof GLMStreamHandler;
};
export {};
