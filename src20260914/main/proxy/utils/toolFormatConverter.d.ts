/**
 * Tool Format Converter
 * Converts between OpenAI tool_calls and Anthropic tool_use formats
 */
import { ToolCall } from '../types';
/**
 * Anthropic-style tool use block
 */
export interface AnthropicToolUse {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, any>;
}
/**
 * Anthropic-style tool result block
 */
export interface AnthropicToolResult {
    type: 'tool_result';
    tool_use_id: string;
    content: string | any[];
}
/**
 * Check if the request expects Anthropic-style tool format
 */
export declare function isAnthropicToolFormat(toolFormat?: string): boolean;
/**
 * Convert OpenAI tool_calls to Anthropic tool_use format
 */
export declare function openaiToAnthropicToolCalls(toolCalls: ToolCall[]): AnthropicToolUse[];
/**
 * Convert Anthropic tool_use to OpenAI tool_calls format
 */
export declare function anthropicToOpenAIToolCalls(toolUses: AnthropicToolUse[]): ToolCall[];
/**
 * Convert OpenAI streaming tool_calls delta to Anthropic format
 */
export declare function openaiDeltaToAnthropic(delta: any): any;
/**
 * Format tool calls based on the requested format
 */
export declare function formatToolCalls(toolCalls: ToolCall[], format?: 'native' | 'json' | 'auto'): ToolCall[] | AnthropicToolUse[];
/**
 * Create Anthropic-style content block for response
 */
export declare function createAnthropicContent(content: string | null, toolCalls: ToolCall[] | undefined): (string | AnthropicToolUse)[];
/**
 * Transform response body to Anthropic format if needed
 */
export declare function transformResponseToAnthropic(response: any): any;
/**
 * Transform streaming chunk to Anthropic format if needed
 */
export declare function transformChunkToAnthropic(chunk: any): any;
