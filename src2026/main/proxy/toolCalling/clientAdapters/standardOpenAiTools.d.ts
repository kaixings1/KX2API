import type { ChatCompletionRequest, ChatCompletionTool } from '../../types.ts';
import type { NormalizedToolDefinition } from '../types.ts';
import type { NormalizedToolChoice, ToolClientAdapter } from './types.ts';
export declare function normalizeOpenAiTools(tools: ChatCompletionTool[] | undefined, source: 'openai' | 'mcp'): NormalizedToolDefinition[];
export declare function normalizeToolChoice(request: ChatCompletionRequest, toolNames: Set<string>): NormalizedToolChoice;
export declare const standardOpenAiToolsAdapter: ToolClientAdapter;
