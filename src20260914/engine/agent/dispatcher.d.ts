/**
 * Agent Dispatcher - 统一处理所有 needsAgent 命令
 *
 * 执行链路升级（v2 — 任务拆解 + 结果校验）：
 *   team / llm 类型 → TaskDecomposer 拆解为子任务 → TaskExecutor 顺序执行 + 校验 → 合并结果
 *   local 类型       → 直接执行（不变）
 *
 * 新增能力：
 *   1. 复杂任务自动拆解（静态规则 + LLM 动态拆解）
 *   2. 子任务依赖管理（上一步结果传给下一步）
 *   3. 自动重试（失败 N 次自动重跑）
 *   4. 结果校验（每个子任务完成后验证输出）
 *   5. 结果合并（所有子任务输出合并为最终报告）
 *   6. 断点续跑（崩溃后从上次完成处继续）
 */
import { type ApiConfig } from '../api/client.ts';
import { type RunnerType } from './command-runners.ts';
import { type ExecuteResult } from './task-executor.ts';
import { type DecompositionPlan } from './task-decomposer.ts';
export interface AgentDispatchResult {
    success: boolean;
    output: string;
    error?: string;
    agentUsed: string;
    /** 任务拆解计划（team/llm 类型有） */
    plan?: DecompositionPlan;
    /** 子任务执行结果（team/llm 类型有） */
    executeResult?: ExecuteResult;
}
export declare class AgentDispatcher {
    private config;
    constructor(config: ApiConfig);
    /**
     * 分发命令到对应的实现
     */
    dispatch(commandName: string, args: string[], context?: Record<string, unknown>): Promise<AgentDispatchResult>;
    /**
     * 对 team/llm 类型命令启用任务拆解：
     * 1. TaskDecomposer 拆解为子任务
     * 2. TaskExecutor 顺序执行 + 校验 + 重试
     * 3. 合并结果为最终输出
     */
    private dispatchWithDecomposition;
    /**
     * Team 策略：使用多角色协作处理复杂任务
     */
    private dispatchTeam;
    /**
     * LLM 策略：构建专用 prompt 交给 LLM 执行
     */
    private dispatchLLM;
    /**
     * 本地策略：直接执行本地命令
     */
    private dispatchLocal;
    private buildSystemPrompt;
    private buildUserPrompt;
    /**
     * 获取命令的执行类型
     */
    getRunnerType(commandName: string): RunnerType | undefined;
    /**
     * 获取所有已注册的命令名
     */
    getRegisteredCommands(): string[];
    private getCwd;
}
