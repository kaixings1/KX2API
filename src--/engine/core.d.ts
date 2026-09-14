/**
 * engine/core.ts — 简化版 QueryEngine 核心
 *
 * 职责：
 * - 管理对话历史
 * - 调用 API 客户端
 * - 处理流式响应
 * - 执行命令
 *
 * 设计目标：轻量、无死循环、可扩展
 */
import { type Message, type ContentBlock } from './api/client.ts';
export interface EngineConfig {
    apiKey: string;
    provider: 'anthropic' | 'openai' | 'custom';
    model: string;
    baseUrl?: string;
    maxTokens?: number;
    workingDir?: string;
    maxToolRounds?: number;
    maxRepeat?: number;
}
export interface QueryResult {
    content: string;
    toolCalls: ContentBlock[];
    toolOutput?: string;
    error?: string;
}
export interface ConversationHistory {
    messages: Array<{
        role: string;
        content: string;
    }>;
}
declare class QueryEngine {
    private config;
    private history;
    private systemPrompt;
    constructor(config: EngineConfig);
    updateConfig(config: Partial<EngineConfig>): void;
    getMaxToolRounds(): number;
    getHistory(): ConversationHistory;
    clearHistory(): void;
    addMessage(msg: Message): void;
    query(text: string, _signal?: AbortSignal, onStream?: (chunk: string) => void): Promise<QueryResult>;
    /**
     * 执行命令（/xxx 格式）
     */
    executeCommand(name: string, args: string[]): Promise<{
        success: boolean;
        output: string;
        error?: string;
        needsAgent?: boolean;
        plan?: unknown;
    }>;
    getConfig(): {
        apiKey: string;
        provider: "anthropic" | "openai" | "custom";
        model: string;
        baseUrl?: string;
        maxTokens?: number;
        workingDir?: string;
        maxToolRounds?: number;
        maxRepeat?: number;
    };
    /**
     * Team 多角色协作模式
     * 统一管理 Lead + Engineer 角色配置，避免重复代码
     */
    private runTeamMode;
    /**
     * Agent 命令执行（v2 — 任务拆解 + 结果校验 + 自动续跑）
     *
     * 执行链路：
     *   team/llm 类型 → TaskDecomposer 拆解 → TaskExecutor 执行(含校验/重试/续跑) → 合并结果
     *   local 类型     → 直接执行
     */
    private runAgentCommand;
}
export declare function createEngine(config?: Partial<EngineConfig>): QueryEngine;
export declare function getEngine(): QueryEngine;
export {};
