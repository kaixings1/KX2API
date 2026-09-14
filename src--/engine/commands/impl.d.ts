/**
 * Agent 命令具体实现
 * 每个命令都有真实的执行逻辑，而非空桩
 *
 * 分类：
 * - local: 本地直接执行（git、文件系统、进程等）
 * - llm: 通过 LLM 执行（代码生成、分析等）
 * - team: 多角色协作（复杂任务）
 */
export type CommandImplType = 'local' | 'llm' | 'team';
export interface CommandImpl {
    type: CommandImplType;
    execute: (args: string[], cwd?: string) => Promise<string>;
}
export declare const gitCommitImpl: CommandImpl;
export declare const gitBlameImpl: CommandImpl;
export declare const searchImpl: CommandImpl;
export declare const dockerImpl: CommandImpl;
export declare const execImpl: CommandImpl;
export declare const commandImpls: Map<string, CommandImpl>;
