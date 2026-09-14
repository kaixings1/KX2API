/**
 * Planner — 多角色规划器
 *
 * 职责：组织多个角色（Planner、Discussant、Reviewer）进行讨论，
 * 最终生成一份可执行的 Plan JSON 文件。
 *
 * 讨论流程：
 *   1. brainstorm  — 每个角色提出自己的想法
 *   2. debate      — 角色之间质疑、补充、修正
 *   3. consensus   — 投票/协商达成共识
 *   4. finalize    — Planner 汇总为最终 Plan
 *
 * 输出：Plan 对象（包含 tasks、discussions），同时写入 .plan.json 文件
 */
import type { AgentRole, CoordinatorConfig, CoordinatorCallbacks, Plan } from "./types.ts";
export declare const BUILTIN_ROLES: AgentRole[];
export interface PlannerOptions {
    config: CoordinatorConfig;
    roles?: AgentRole[];
    callbacks?: CoordinatorCallbacks;
}
export declare class Planner {
    private config;
    private roles;
    private callbacks?;
    constructor(opts: PlannerOptions);
    /**
     * 生成执行计划
     *
     * 流程：
     *   1. brainstorm — 每个角色提出想法
     *   2. debate     — 多轮讨论（最多 maxDiscussionRounds 轮）
     *   3. consensus  — Planner 汇总为 Plan JSON
     *   4. finalize   — 审查和修正
     */
    generatePlan(objective: {
        id: string;
        description: string;
    }): Promise<Plan>;
    private brainstorm;
    private debate;
    private consolidate;
    private finalize;
    /** 可被测试 override 的 LLM 调用方法 */
    protected callLLM(role: AgentRole, userPrompt: string): Promise<string>;
    private parseTasks;
    private fallbackTasks;
}
export default Planner;
