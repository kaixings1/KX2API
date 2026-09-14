/**
 * src/engine/commands/registry.ts — 命令注册表
 *
 * 从 doge-code 移植命令系统。命令分为两类：
 * - 本地命令：直接在 Node.js 执行，返回结果
 * - AI 代理命令：将命令意图转为 prompt，由 LLM 执行
 */
export interface CommandResult {
    success: boolean;
    output?: string;
    error?: string;
    needsAgent?: boolean;
}
export interface Command {
    name: string;
    description: string;
    execute: (args: string[]) => Promise<CommandResult>;
}
declare class CommandRegistry {
    private commands;
    register(cmd: Command): void;
    get(name: string): Command | undefined;
    getAll(): Command[];
    has(name: string): boolean;
    getNames(): string[];
}
export declare const commandRegistry: CommandRegistry;
export {};
