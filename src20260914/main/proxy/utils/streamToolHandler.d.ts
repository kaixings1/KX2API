/**
 * Stream Tool Handler Module - Handle tool calls in streaming responses
 * Used by all provider-specific StreamHandlers
 *
 * Strategy: Buffer content when [function_calls] marker is detected,
 * parse tool calls and emit them as tool_calls delta instead of text content
 *
 * @deprecated This module is being phased out. Use the new unified toolParser module instead.
 * Import from './toolParser/index.ts' for the latest unified parsing functionality.
 */
export type { StreamState } from './toolParser/index';
/**
 * Tool call state for backward compatibility
 * @deprecated Use StreamState from './toolParser/index.ts' instead
 */
export interface ToolCallState {
    contentBuffer: string;
    isBufferingToolCall: boolean;
    toolCallIndex: number;
    hasEmittedToolCall: boolean;
}
/**
 * Create tool call state
 * @deprecated Use createStreamState from './toolParser/index.ts' instead
 */
export declare function createToolCallState(): ToolCallState;
/**
 * Process streaming content and detect/parse tool calls
 * Returns the chunks that should be sent to the client
 * @deprecated Use parseToolCallsStream from './toolParser/index.ts' instead
 */
export declare function processStreamContent(content: string, state: ToolCallState, baseChunk: any, isFirstChunk: boolean, modelType?: string): {
    chunks: any[];
    shouldFlush: boolean;
};
/**
 * Flush any remaining content in the buffer at the end of stream
 * @deprecated Use flushToolCallBuffer from './toolParser/index.ts' instead
 */
export declare function flushToolCallBuffer(state: ToolCallState, baseChunk: any, modelType?: string): any[];
/**
 * Check if we should block normal content output
 * Returns true if we are currently buffering a potential tool call
 */
export declare function shouldBlockOutput(state: ToolCallState): boolean;
/**
 * Create a base chunk structure for OpenAI-compatible responses
 */
export declare function createBaseChunk(id: string, model: string, created: number): {
    id: string;
    model: string;
    object: string;
    created: number;
};
