/**
 * Qwen Adapter
 * Implements Qwen (Tongyi Qianwen) web API protocol
 * Based on new chat2.qianwen.com API
 */
import { AxiosResponse } from 'axios';
import { PassThrough } from 'stream';
import { Account, Provider } from '../../store/types';
import type { ToolCallingPlan } from '../toolCalling/types';
interface QwenMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | any[];
    tool_call_id?: string;
    tool_calls?: any[];
}
interface ChatCompletionRequest {
    model: string;
    messages: QwenMessage[];
    tools?: any[];
    stream?: boolean;
    temperature?: number;
    web_search?: boolean;
    reasoning_effort?: 'low' | 'medium' | 'high';
    enableThinking?: boolean;
    enableWebSearch?: boolean;
}
export declare class QwenAdapter {
    private provider;
    private account;
    private axiosInstance;
    constructor(provider: Provider, account: Account);
    private getTicket;
    private mapModel;
    private getApiHeaders;
    private getApiParams;
    private extractSessionIds;
    private listSessions;
    private deleteRelatedFileRecords;
    private deleteSessions;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        response: AxiosResponse;
        sessionId: string;
        reqId: string;
    }>;
    deleteSession(sessionId: string): Promise<boolean>;
    deleteAllChats(): Promise<boolean>;
    static isQwenProvider(provider: Provider): boolean;
}
export declare class QwenStreamHandler {
    private sessionId;
    private model;
    private created;
    private onEnd?;
    private content;
    private responseId;
    private stopSent;
    private toolCallsSent;
    private hasError;
    private toolStreamParser?;
    private toolCallingPlan?;
    private sentRole;
    private thinkingContent;
    private sentThinkingRole;
    constructor(model: string, onEnd?: (sessionId: string) => void, toolCallingPlan?: ToolCallingPlan);
    hasSessionError(): boolean;
    private sendToolCalls;
    handleStream(stream: any, response?: AxiosResponse): PassThrough;
    handleNonStream(stream: any, response?: AxiosResponse): Promise<any>;
    getSessionId(): string;
}
export declare const qwenAdapter: {
    QwenAdapter: typeof QwenAdapter;
    QwenStreamHandler: typeof QwenStreamHandler;
};
export {};
