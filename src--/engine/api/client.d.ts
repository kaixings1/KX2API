/**
 * engine/api/client.ts — LLM API 统一客户端
 *
 * 支持 Anthropic Messages API 和 OpenAI Chat Completions API
 * 流式传输 + Tool Use
 */
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string | ContentBlock[];
}
export interface ContentBlock {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string;
}
export interface ApiConfig {
    provider: 'anthropic' | 'openai' | 'custom';
    apiKey: string;
    model: string;
    baseUrl?: string;
    maxTokens?: number;
    maxToolRounds?: number;
    maxRepeat?: number;
}
export interface StreamCallbacks {
    onText: (text: string) => void;
    onToolUse: (block: ContentBlock) => void;
    onDone: (fullContent: string, toolCalls: ContentBlock[]) => void;
    onError: (error: string) => void;
}
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}
export interface ToolCallResult {
    tool_use_id: string;
    output: string;
}
export declare function sendMessageStream(config: ApiConfig, messages: Message[], callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void>;
/**
 * 执行单个本地工具命令（通过 commandRegistry + AgentDispatcher）
 * needsAgent 命令会通过 AgentDispatcher 获得真实执行能力
 */
export declare function executeLocalTool(name: string, args: string[]): Promise<ToolCallResult>;
/**
 * 从 ToolCollection 构建 OpenAI tools 定义
 * 使用 toolCollection 统一管理工具，消除硬编码白名单
 * 使用动态 import 避免与 registry.ts 形成循环依赖
 */
export declare function buildToolsFromRegistry(): Promise<ToolDefinition[]>;
/**
 * OpenAI tool_use 工具调用循环 — 最多 MAX_TOOL_ROUNDS 轮
 * 每轮：LLM 返回 tool_calls → 本地执行 → 结果喂回 → 再问 LLM
 */
export declare function sendOpenAIStreamWithTools(config: ApiConfig, messages: Message[], callbacks: StreamCallbacks, signal?: AbortSignal, reqId?: number): Promise<void>;
