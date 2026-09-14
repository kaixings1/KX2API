/**
 * Tool Parser Module - Parse tool calls from text content
 *
 * Supported format:
 * Bracket format: [function_calls][call:name]{args}[/call][/function_calls]
 *
 * All formats are normalized to the standard OpenAI tool_calls format
 */
export interface ParsedToolCall {
    index: number;
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
    rawText?: string;
}
/**
 * Parse tool calls from text content
 */
export declare function parseToolCallsFromText(text: string, modelType?: string): {
    content: string;
    toolCalls: ParsedToolCall[];
};
