/**
 * Orchestrator — 多目标协调器
 *
 * 职责：
 *   1. 接收高层目标（可能包含多个子目标）
 *   2. 用 Planner 生成执行计划（多角色讨论）
 *   3. 执行计划（并行/串行任务）
 *   4. 生成执行报告
 *   5. 全程持久化，支持断点续跑
 *
 * 用法：
 *   const orchestrator = new Orchestrator({ llm: { provider, apiKey, model } })
 *   const report = await orchestrator.execute({
 *     id: "obj-1",
 *     description: "重构认证模块并写测试",
 *   })
 *   // report 包含所有任务的执行结果、讨论记录、总耗时
 */
import type { AgentRole, CoordinatorConfig, CoordinatorCallbacks, ExecutionReport, Objective } from "./types.ts";
export declare class Orchestrator {
    private config;
    private callbacks?;
    private roles;
    constructor(config: CoordinatorConfig, callbacks?: CoordinatorCallbacks, roles?: AgentRole[]);
    /**
     * 执行一个高层目标
     *
     * 流程：
     *   1. 检查是否有未完成的计划（续跑）
     *   2. 如果有子目标，递归执行
     *   3. 生成计划（多角色讨论）
     *   4. 执行计划
     *   5. 返回报告
     */
    execute(objective: Objective): Promise<ExecutionReport>;
    private executePlan;
    private executeTask;
    private tryResumePlan;
    private resumePlan;
    private buildReport;
    /**
     * 返回不覆盖已有文件的唯一路径。
     * 规则：先试 baseName.ext，若存在则 baseName-1.ext，再存在 baseName-2.ext，依此类推。
     */
    private uniquePath;
    private persistPlan;
    /** 持久化执行报告 */
    persistReport(report: ExecutionReport): void;
}
export default Orchestrator;
