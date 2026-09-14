/**
 * Coordinator 模块 — 多目标、多子代理协同的类型定义
 *
 * 核心概念：
 *   Objective  — 一个高层目标（如"重构登录模块"），可包含多个并行/串行任务
 *   Plan       — 由多角色讨论生成的执行规划文件（JSON）
 *   AgentRole  — 角色定义（Planner / Discussant / Executor / Reviewer）
 *   Discussion — 多角色之间的讨论回合
 *   TaskNode   — 规划中的任务节点（可依赖其他节点）
 */
export {};
