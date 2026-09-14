/**
 * TaskDecomposer — 复杂任务自动拆解器
 *
 * 职责：把用户的复杂请求拆成有序的子任务列表，每个子任务可独立执行、
 * 追踪进度、验证结果，最终合并为完整输出。
 *
 * 拆解策略：
 *   - llm 模式：调用 LLM 生成子任务分解（基于用户请求 + 可用工具列表）
 *   - static 模式：基于命令注册表静态分析（fallback，无需 LLM）
 *   - single 模式：单任务，不拆解
 *
 * 用法：
 *   const decomposer = new TaskDecomposer({ mode: 'llm', config: llmConfig })
 *   const plan = await decomposer.decompose("重构登录模块并写测试")
 *   // plan.subtasks = [
 *   //   { id: 1, desc: "分析登录模块现有代码", tool: "analyze" },
 *   //   { id: 2, desc: "重构 auth.ts 中的验证逻辑", tool: "refactor" },
 *   //   { id: 3, desc: "为重构后的代码生成单元测试", tool: "generate-test" },
 *   //   { id: 4, desc: "运行测试验证结果", tool: "test" },
 *   // ]
 *   // plan.mergeStrategy = "sequential"  // 顺序执行，上一步结果传给下一步
 */
export interface Subtask {
    id: number;
    description: string;
    /** 建议使用的命令/工具名 */
    toolHint?: string;
    /** 子任务参数 */
    args?: string[];
    /** 依赖的上游子任务 ID */
    dependsOn?: number[];
    /** 执行结果（执行后填充） */
    result?: SubTaskResult;
}
export interface SubTaskResult {
    success: boolean;
    output: string;
    error?: string;
    durationMs: number;
    /** 传递给下游的数据 */
    artifact?: unknown;
}
export interface DecompositionPlan {
    /** 原始请求 */
    originalRequest: string;
    /** 子任务列表 */
    subtasks: Subtask[];
    /** 合并策略 */
    mergeStrategy: "sequential" | "parallel" | "merge";
    /** 创建时间 */
    createdAt: string;
    /** 会话 ID（用于续跑） */
    sessionId: string;
}
export interface DecomposerConfig {
    /** 拆解模式 */
    mode: "llm" | "static" | "single";
    /** 可用工具列表（用于 prompt） */
    availableTools?: Array<{
        name: string;
        description: string;
    }>;
    /** 持久化目录（用于断点续跑） */
    stateDir?: string;
    /** LLM 调用回调（llm 模式需要）。传入 systemPrompt + userPrompt，返回 LLM 文本输出 */
    llmCall?: (system: string, user: string) => Promise<string>;
}
export declare class TaskDecomposer {
    private config;
    private static counter;
    constructor(config: DecomposerConfig);
    /**
     * 将复杂请求拆解为子任务
     */
    decompose(request: string): Promise<DecompositionPlan>;
    private decomposeWithLLM;
    private parseLLMResult;
    private decomposeStatic;
    private extractTarget;
    private getOrCreateSessionId;
    private persistPlan;
    private tryResumePlan;
    /** 更新某个子任务的结果（供 executor 调用） */
    updateSubTaskResult(plan: DecompositionPlan, subtaskId: number, result: SubTaskResult): void;
    /** 获取已完成的子任务数 */
    getCompletedCount(plan: DecompositionPlan): number;
}
export default TaskDecomposer;
