/**
 * Prompt Tool Use - Tool Calling Parsing
 * Parses XML-style tool calling format from clients like Cherry Studio
 *
 * For built-in providers (DeepSeek, GLM, Kimi, Qwen, etc.), use the new utils module:
 *   - utils/tools.ts: Convert OpenAI tools to system prompt
 *   - utils/toolParser.ts: Parse tool calls from model output
 *   - utils/streamToolHandler.ts: Handle tool calls in streaming responses
 *
 * This module only handles parsing of legacy XML format from external clients.
 */
/**
 * Tool Definition Interface
 */
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: {
            type: 'object';
            properties: Record<string, {
                type: string;
                description?: string;
                enum?: string[];
            }>;
            required?: string[];
        };
    };
}
/**
 * Tool Call Interface
 */
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
/**
 * Parse tool use from model output
 * Extracts tool calls from XML-style tags (used by Cherry Studio and other clients)
 */
export declare function parseToolUse(content: string): ToolCall[];
/**
 * Format tool result for injection
 */
export declare function formatToolResult(toolName: string, result: string): string;
/**
 * Check if content contains tool use (XML format from external clients)
 */
export declare function hasToolUse(content: string): boolean;
/**
 * Remove tool use tags from content
 * Returns cleaned content for display
 */
export declare function cleanToolUseFromContent(content: string): string;
/**
 * Models that support native Function Calling
 */
export declare const NATIVE_FUNCTION_CALLING_MODELS: string[];
/**
 * Check if model supports native function calling
 */
export declare function isNativeFunctionCallingModel(model: string): boolean;
declare const _default: {
    parseToolUse: typeof parseToolUse;
    formatToolResult: typeof formatToolResult;
    hasToolUse: typeof hasToolUse;
    cleanToolUseFromContent: typeof cleanToolUseFromContent;
    isNativeFunctionCallingModel: typeof isNativeFunctionCallingModel;
};
export default _default;
