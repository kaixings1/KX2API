/**
 * DeepSeek Stream Response Handler
 * Converts DeepSeek SSE stream to OpenAI compatible format
 */
import type { ToolCallingPlan } from '../toolCalling/types.ts';
export declare class DeepSeekStreamHandler {
    private model;
    private sessionId;
    private isFirstChunk;
    private messageId;
    private currentPath;
    private searchResults;
    private thinkingStarted;
    private accumulatedTokenUsage;
    private created;
    private onEnd?;
    private toolStreamParser?;
    private toolCallingPlan?;
    private webSearchEnabled;
    private reasoningEffort;
    private isDone;
    private semanticModel;
    constructor(model: string, sessionId: string, onEnd?: () => void, webSearchEnabled?: boolean, reasoningEffort?: string, toolCallingPlan?: ToolCallingPlan, semanticModel?: string);
    getLastMessageId(): string;
    private isThinkingModel;
    private isFoldModel;
    private isSilentModel;
    private isSearchSilentModel;
    private shouldStripSearchControlMarker;
    private static normalizeSearchResult;
    private static mergeSearchResultsInto;
    private static applySearchResultBatch;
    private static formatSearchCitations;
    private parseSSE;
    private createChunk;
    /** Check if chunk has native tool_calls and forward them directly */
    private _forwardNativeToolCalls;
    handleStream(stream: NodeJS.ReadableStream): Promise<NodeJS.ReadableStream>;
    private processChunk;
    private sendContent;
    private handleDone;
    handleNonStream(stream: NodeJS.ReadableStream): Promise<any>;
}
