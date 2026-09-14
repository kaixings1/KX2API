/**
 * TaskExecutor — 子任务执行器 + 进度追踪 + 结果校验
 *
 * 职责：
 *   1. 按依赖关系顺序执行子任务
 *   2. 每个子任务执行后自动校验结果（非空检查、错误码检查）
 *   3. 失败自动重试（最多 N 次）
 *   4. 结果合并为最终输出
 *   5. 全程进度可观测
 *   6. 崩溃后自动续跑
 *
 * 用法：
 *   const executor = new TaskExecutor({ registry: commandRegistry, toolCollection })
 *   const result = await executor.execute(plan, {
 *     onProgress: (current, total, subtask) => console.log(`${current}/${total}: ${subtask.description}`),
 *     onComplete: (finalResult) => console.log("全部完成"),
 *   })
 */
import { commandRegistry } from "../commands/registry.ts";
import { commandRunners } from "./command-runners.ts";
import { type DecompositionPlan, type SubTaskResult, type Subtask } from "./task-decomposer.ts";
export interface ExecutorOptions {
    /** 命令注册表 */
    registry?: typeof commandRegistry;
    /** 命令运行器映射 */
    runners?: typeof commandRunners;
    /** 工作目录 */
    cwd?: string;
    /** 子任务重试次数 */
    maxRetries?: number;
    /** 结果校验器 */
    validators?: Map<string, (output: string) => boolean>;
    /** 持久化目录（断点续跑） */
    stateDir?: string;
    /** LLM 配置（用于 llm 类型子任务） */
    llmConfig?: {
        provider: string;
        apiKey: string;
        model: string;
        baseUrl?: string;
        maxTokens?: number;
    };
}
export interface ExecuteResult {
    /** 是否全部成功 */
    success: boolean;
    /** 合并后的最终输出 */
    output: string;
    /** 每个子任务的结果 */
    subtaskResults: SubTaskResult[];
    /** 总耗时 */
    totalDurationMs: number;
    /** 失败的子任务 */
    failedSubtasks: Array<{
        id: number;
        description: string;
        error: string;
    }>;
}
export type ProgressCallback = (current: number, total: number, subtask: Subtask) => void;
export type CompleteCallback = (result: ExecuteResult) => void;
export declare class TaskExecutor {
    private registry;
    private runners;
    private cwd;
    private maxRetries;
    private validators;
    private stateDir;
    private llmConfig?;
    constructor(opts?: ExecutorOptions);
    /**
     * 执行完整计划
     */
    execute(plan: DecompositionPlan, callbacks?: {
        onProgress?: ProgressCallback;
        onComplete?: CompleteCallback;
    }): Promise<ExecuteResult>;
    private executeSubtask;
    private validateResult;
    private mergeResults;
    private persistPlan;
    private findResumePoint;
    private buildContext;
    private toLlmConfig;
    private persistResult;
}
export default TaskExecutor;
