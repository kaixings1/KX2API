/**
 * DeepSeek Adapter
 * Implements DeepSeek web API protocol
 *
 * NOTE: Tool prompt injection is handled by Forwarder.transformRequestForPromptToolUse()
 * This adapter only handles message format conversion and API communication
 */
import { AxiosResponse } from 'axios';
import type { Account, Provider } from '../../store/types';
interface DeepSeekMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    tool_call_id?: string;
    tool_calls?: any[];
}
interface ChatCompletionRequest {
    model: string;
    messages: DeepSeekMessage[];
    stream?: boolean;
    temperature?: number;
    web_search?: boolean;
    reasoning_effort?: 'low' | 'medium' | 'high';
    tools?: any[];
    tool_choice?: any;
}
export declare class DeepSeekAdapter {
    private provider;
    private account;
    private token;
    constructor(provider: Provider, account: Account);
    private acquireToken;
    private createSession;
    deleteSession(sessionId: string): Promise<boolean>;
    private getChallenge;
    private calculateChallengeAnswer;
    private messagesToPrompt;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        response: AxiosResponse;
        sessionId: string;
    }>;
    deleteAllChats(): Promise<boolean>;
    static isDeepSeekProvider(provider: Provider): boolean;
    /**
     * Clear session cache for a specific account
     * This should be called when a session is deleted externally (e.g., from web)
     */
    static clearSessionCache(accountId: string): void;
}
export declare const deepSeekAdapter: {
    DeepSeekAdapter: typeof DeepSeekAdapter;
};
export {};
