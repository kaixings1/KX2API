/**
 * Z.ai Adapter
 * Implements Z.ai (GLM International) API protocol
 */
import { AxiosResponse } from 'axios';
import { PassThrough } from 'stream';
import { Account, Provider } from '../../store/types';
interface ZaiMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | any[];
}
interface ChatCompletionRequest {
    model: string;
    /** Original model name before mapping (used for feature detection like web search, thinking mode) */
    originalModel?: string;
    messages: ZaiMessage[];
    stream?: boolean;
    temperature?: number;
    web_search?: boolean;
    reasoning_effort?: 'low' | 'medium' | 'high' | boolean;
    chatId?: string;
    parentMessageId?: string;
}
export declare class ZaiAdapter {
    private provider;
    private account;
    private token;
    constructor(provider: Provider, account: Account);
    private getToken;
    private getCaptchaVerifyParam;
    private ensureToken;
    private extractLastUserMessage;
    private extractUserIDFromToken;
    private generateSignature;
    createChat(model?: string, firstMessageContent?: string): Promise<{
        chatId: string;
        messageId: string;
    }>;
    deleteChat(chatId: string): Promise<boolean>;
    deleteAllChats(): Promise<boolean>;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        response: AxiosResponse;
        chatId: string;
        requestId: string;
    }>;
    static isZaiProvider(provider: Provider): boolean;
}
export declare class ZaiStreamHandler {
    private chatId;
    private model;
    private created;
    private onEnd?;
    private content;
    private toolCallsSent;
    private lastMessageId;
    private toolCallState;
    private sentRole;
    private sentThinkingRole;
    private streamEnded;
    private citationBuffer;
    private thinkingCitationBuffer;
    constructor(model: string, onEnd?: (chatId: string) => void);
    setChatId(chatId: string): void;
    getLastMessageId(): string;
    private sendToolCalls;
    /** Check if chunk has native tool_calls and forward them directly */
    private _forwardNativeToolCalls;
    handleStream(stream: any): Promise<PassThrough>;
    handleNonStream(response: any): Promise<any>;
    getChatId(): string;
}
export declare const zaiAdapter: {
    ZaiAdapter: typeof ZaiAdapter;
    ZaiStreamHandler: typeof ZaiStreamHandler;
};
export {};
