/**
 * Team Coordinator
 * 多角色协作编排器
 * 参考 MetaGPT 的 Team/Role/Message 设计模式
 */
import type { AgentRole, TeamMessage, TeamConfig } from './types.ts';
export declare class Team {
    private readonly roles;
    private readonly inbox;
    private leadRoleId?;
    private maxRounds;
    private roundCount;
    private readonly sampler;
    constructor(config: TeamConfig);
    getRole(id: string): AgentRole | undefined;
    getAllRoles(): AgentRole[];
    getLeadRole(): AgentRole | undefined;
    publishMessage(msg: Omit<TeamMessage, 'id' | 'timestamp'>): TeamMessage;
    getInbox(recipient: string): TeamMessage[];
    canContinue(): boolean;
    nextRound(): void;
    getRoundCount(): number;
    /**
     * 生成角色系统 prompt
     * 格式参考 MetaGPT 的 PREFIX_TEMPLATE / CONSTRAINT_TEMPLATE
     * 全部使用中文，确保角色理解和输出一致
     */
    static buildRolePrompt(role: AgentRole, history: string[]): string;
    /**
     * 处理任务：Lead 角色分发子任务给各角色执行
     * 返回所有角色的执行结果汇总
     */
    process(task: string, executeLocalTool?: (name: string, args: string[]) => Promise<{
        output: string;
    }>): Promise<string>;
    private delegateTask;
}
