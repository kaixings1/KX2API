/**
 * Qwen AI International Adapter
 * Implements chat.qwen.ai API protocol
 * Based on qwen3-reverse project
 */
import { AxiosResponse } from 'axios';
import { PassThrough } from 'stream';
import { Account, Provider } from '../../store/types';
interface QwenAiMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
interface ChatCompletionRequest {
    model: string;
    /** Original model name before mapping (used for feature detection like thinking mode) */
    originalModel?: string;
    messages: QwenAiMessage[];
    stream?: boolean;
    temperature?: number;
    enable_thinking?: boolean;
    thinking_budget?: number;
    chatId?: string;
}
export declare class QwenAiAdapter {
    private provider;
    private account;
    private axiosInstance;
    constructor(provider: Provider, account: Account);
    private getToken;
    private getCookies;
    private getHeaders;
    mapModel(openaiModel: string): string;
    createChat(modelId: string, title?: string): Promise<string>;
    deleteChat(chatId: string): Promise<boolean>;
    /**
     * Delete all chats for the current account
     * @returns Promise<boolean> - true if deletion was successful
     */
    deleteAllChats(): Promise<boolean>;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        response: AxiosResponse;
        chatId: string;
        parentId: string | null;
    }>;
    static isQwenAiProvider(provider: Provider): boolean;
}
export declare class QwenAiStreamHandler {
    private chatId;
    private model;
    private created;
    private onEnd?;
    private responseId;
    private content;
    private toolCallsSent;
    constructor(model: string, onEnd?: (chatId: string) => void);
    setChatId(chatId: string): void;
    private sendToolCalls;
    /** Check if chunk has native tool_calls and forward them directly */
    private _forwardNativeToolCalls;
    handleStream(stream: any): Promise<PassThrough>;
    handleNonStream(stream: any): Promise<any>;
    getChatId(): string;
    getResponseId(): string;
}
export declare const qwenAiAdapter: {
    QwenAiAdapter: typeof QwenAiAdapter;
    QwenAiStreamHandler: typeof QwenAiStreamHandler;
};
export {};
