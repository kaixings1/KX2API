/**
 * StepFun Adapter
 * Supports two modes:
 *   1. API Key (sk-*): direct API call to api.stepfun.com
 *   2. Web session (Oasis-Token + web_id): same-origin proxy like the web frontend
 */
import { Readable } from 'stream';
import { Account, Provider } from '../../store/types';
interface StepFunMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_call_id?: string;
    tool_calls?: any[];
}
interface ChatCompletionRequest {
    model: string;
    messages: StepFunMessage[];
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    n?: number;
    tools?: any[];
    tool_choice?: any;
    frequency_penalty?: number;
    stop?: string[];
    reasoning_effort?: string;
}
export declare class StepFunAdapter {
    private provider;
    private account;
    private oasisToken;
    private webId;
    private allCookies;
    private isApiKeyMode;
    private chatSessionId;
    private chatId;
    private cachedAppId;
    constructor(provider: Provider, account: Account);
    private acquireToken;
    private getCachedSession;
    private setCachedSession;
    private clearSessionCache;
    deleteSession(sessionId: string): Promise<boolean>;
    deleteAllChats(): Promise<boolean>;
    private buildHeaders;
    private getEndpoint;
    private formatNetworkError;
    private buildFlatRequest;
    private mapModel;
    chatCompletion(request: ChatCompletionRequest, sessionId?: string): Promise<{
        success: boolean;
        status?: number;
        stream?: Readable;
        body?: any;
        headers?: Record<string, string>;
        error?: string;
    }>;
    /**
     * Connect protocol for web session mode
     * Uses HTTP streaming with length-prefixed JSON frames
     * Frame format: 1-byte flag + 4-byte big-endian length + JSON body
     */
    private chatCompletionConnect;
    /**
     * Strip internal protocol markers from response text.
     * Removes <|PREFIX|...|> tags that leak into user-facing output.
     */
    private static filterProtocolMarkers;
    private static extractToolCalls;
    /**
     * Process Connect protocol frames from response buffer
     * Frame format: 1-byte flag + 4-byte big-endian length + JSON body
     * Returns the number of bytes consumed from the buffer
     */
    private processConnectFrames;
    /**
     * Handle a single Connect protocol event
     */
    private handleConnectEvent;
    static isStepFunProvider(provider: Provider): boolean;
}
export { StepFunStreamHandler } from './stepfun-stream';
export declare const stepfunAdapter: {
    StepFunAdapter: typeof StepFunAdapter;
};
