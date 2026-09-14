/**
 * MiniMax Adapter
 * Based on MiniMax-Free-API implementation
 * https://github.com/LLM-Red-Team/MiniMax-Free-API
 */
import { PassThrough } from 'stream';
import { ClientHttp2Session, ClientHttp2Stream } from 'http2';
import { AxiosResponse } from 'axios';
import { Account, Provider } from '../../store/types';
interface MiniMaxMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | any[] | null;
    tool_call_id?: string;
    tool_calls?: any[];
}
interface ChatCompletionRequest {
    model: string;
    messages: MiniMaxMessage[];
    stream?: boolean;
    temperature?: number;
    tools?: any[];
    tool_choice?: any;
    chatId?: string;
}
interface CreditInfo {
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
    expiresAt?: number;
}
interface ChatListItem {
    chat_id: number;
    chat_name: string;
    update_time: number;
    create_time: number;
}
export declare class MiniMaxAdapter {
    private provider;
    private account;
    private rawToken;
    private jwtToken;
    private realUserID;
    private model;
    private created;
    constructor(provider: Provider, account: Account);
    private requestDeviceInfo;
    private request;
    private requestStream;
    private messagesPrepare;
    chatCompletion(request: ChatCompletionRequest): Promise<{
        response: AxiosResponse | null;
        stream: {
            session: ClientHttp2Session;
            stream: ClientHttp2Stream;
        } | null;
        chatId: string;
    }>;
    private pollForResponse;
    private createPollingStream;
    deleteChat(chatId: string): Promise<boolean>;
    getUserInfo(): Promise<any>;
    getCredits(): Promise<CreditInfo>;
    getChatList(): Promise<ChatListItem[]>;
    deleteAllChats(): Promise<boolean>;
    static isMiniMaxProvider(provider: Provider): boolean;
}
export declare class MiniMaxStreamHandler {
    private chatId;
    private model;
    private created;
    private onEnd?;
    private toolCallState;
    private sentRole;
    constructor(model: string, onEnd?: (chatId: string) => void);
    setChatId(chatId: string): void;
    getChatId(): string;
    handleStream(stream: ClientHttp2Stream): PassThrough;
    handleNonStream(stream: any): Promise<any>;
}
export declare const minimaxAdapter: {
    MiniMaxAdapter: typeof MiniMaxAdapter;
    MiniMaxStreamHandler: typeof MiniMaxStreamHandler;
};
export {};
