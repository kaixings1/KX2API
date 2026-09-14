import { Readable } from 'stream';
import { Account, Provider } from '../store/types';
interface PerplexityMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    tool_call_id?: string;
    tool_calls?: any[];
}
interface ChatCompletionRequest {
    model: string;
    messages: PerplexityMessage[];
    stream?: boolean;
    temperature?: number;
    web_search?: boolean;
    reasoning_effort?: 'low' | 'medium' | 'high';
    tools?: any[];
    tool_choice?: any;
}
interface SessionData {
    backend_uuid: string;
    read_write_token: string;
    thread_url_slug: string;
    frontend_context_uuid: string;
    frontend_uuid: string;
    createdAt: number;
}
export declare class PerplexityAdapter {
    private provider;
    private account;
    private cookie;
    private allCookies;
    constructor(provider: Provider, account: Account);
    private buildCookieHeader;
    private formatNetworkError;
    private buildRequestData;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        stream: Readable;
        sessionId: string;
    }>;
    updateSessionData(data: Partial<SessionData>): void;
    deleteSession(sessionId: string): Promise<boolean>;
    deleteAllChats(): Promise<boolean>;
    static isPerplexityProvider(provider: Provider): boolean;
    static clearSessionCache(accountId: string): void;
    static getSessionData(accountId: string): SessionData | undefined;
}
export declare const perplexityAdapter: {
    PerplexityAdapter: typeof PerplexityAdapter;
};
export {};
