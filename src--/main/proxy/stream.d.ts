/**
 * Proxy Service Module - Stream Response Handler
 * Properly handles SSE format, supports stream and non-stream response conversion
 */
import { PassThrough, Transform } from 'stream';
import { SSEEvent, ChatCompletionResponse } from './types';
/**
 * SSE Parser
 */
export declare class SSEParser {
    private buffer;
    /**
     * Parse SSE data
     */
    parse(data: string): SSEEvent[];
    /**
     * Reset parser
     */
    reset(): void;
}
/**
 * SSE Formatter
 */
export declare class SSEFormatter {
    /**
     * Format SSE event
     */
    format(event: SSEEvent): string;
    /**
     * Format JSON data
     */
    formatJSON(data: object, event?: string): string;
    /**
     * Format done marker
     */
    formatDone(): string;
}
/**
 * Stream Response Handler
 */
export declare class StreamHandler {
    private parser;
    private formatter;
    constructor();
    /**
     * Create SSE transform stream
     * Converts upstream response to OpenAI compatible format
     */
    createTransformStream(model: string, responseId: string, onEnd?: () => void): Transform;
    /**
     * Transform chunk to OpenAI format
     */
    private transformChunk;
    /**
     * Convert stream response to non-stream response
     */
    streamToResponse(stream: NodeJS.ReadableStream, model: string, responseId: string): Promise<ChatCompletionResponse>;
    /**
     * Create PassThrough stream for SSE response
     */
    createPassThrough(): PassThrough;
    /**
     * Write SSE event to stream
     */
    writeSSEEvent(stream: PassThrough, data: object): void;
    /**
     * Write SSE done marker
     */
    writeSSEDone(stream: PassThrough): void;
    /**
     * Create error response stream
     */
    createErrorStream(model: string, responseId: string, error: string): PassThrough;
}
export declare const streamHandler: StreamHandler;
export default streamHandler;
