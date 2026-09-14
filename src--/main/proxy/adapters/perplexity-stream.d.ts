import type { PerplexityAdapter } from './perplexity';
interface SessionTokens {
    backend_uuid?: string;
    read_write_token?: string;
    thread_url_slug?: string;
}
export declare class PerplexityStreamHandler {
    private model;
    private sessionId;
    private isFirstChunk;
    private created;
    private onEnd?;
    private toolCallState;
    private adapter?;
    private sessionTokens;
    private accumulatedContent;
    private accumulatedReasoning;
    private sources;
    constructor(model: string, sessionId: string, onEnd?: () => void, adapter?: PerplexityAdapter);
    getSessionTokens(): SessionTokens;
    private formatStreamError;
    private parseSSE;
    private createChunk;
    /** Check if chunk has native tool_calls and forward them directly */
    private _forwardNativeToolCalls;
    handleStream(stream: NodeJS.ReadableStream): Promise<NodeJS.ReadableStream>;
    private processEvent;
    private processBlock;
    private handleReasoning;
    private handleContent;
    private handleDone;
    handleNonStream(stream: NodeJS.ReadableStream): Promise<any>;
    private processEventForNonStream;
    private processBlockForNonStream;
}
export {};
