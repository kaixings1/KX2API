/**
 * Tools Module - Convert OpenAI tools definition to system prompt
 * Enables tool calling for models without native function calling support
 */
import { ChatCompletionTool, ChatMessage } from '../types';
export declare const TOOL_PROMPT_SIGNATURES: {
    general: string[];
    clients: {
        [k: string]: string[];
    };
};
export declare function hasToolPromptInjected(messages: ChatMessage[]): boolean;
export interface ToolPromptConfig {
    mode: 'always' | 'smart' | 'never';
    smartThreshold: number;
    keywords: string[];
}
export declare const DEFAULT_TOOL_PROMPT_CONFIG: ToolPromptConfig;
export declare function shouldInjectToolPrompt(messages: ChatMessage[], tools: ChatCompletionTool[] | undefined, config?: ToolPromptConfig): boolean;
export declare function toolsToSystemPrompt(tools: ChatCompletionTool[], simple?: boolean): string;
export declare const TOOL_WRAP_HINT = "\n\nIMPORTANT: If you need to use a tool, you MUST wrap the tool call inside a [function_calls] block exactly like:\n[function_calls]\n[call:exact_tool_name]{\"argument\":\"value\"}[/call]\n[/function_calls]\n\nCRITICAL - MUST FOLLOW:\n- Start with [call:exact_tool_name] (MUST include prefixes like default_api: if present in the tool name)\n- Then the JSON arguments ALL ON ONE LINE - NO NEWLINES\n- Example: [call:default_api:read_file]{\"filePath\":\"/path/to/file\"}[/call]\n- Then CLOSE with [/call]\n- Respond with NOTHING else if you are calling a tool";
