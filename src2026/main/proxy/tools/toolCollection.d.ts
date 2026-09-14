/**
 * Tool Collection
 * 工具集合管理模块
 * 参考 OpenManus 的 ToolCollection 设计，移植到 TypeScript
 */
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
}
export interface Command {
    name: string;
    description: string;
    execute: (args: string[]) => Promise<{
        success: boolean;
        output?: string;
        error?: string;
    }>;
}
export declare class ToolCollection {
    private tools;
    constructor(initialTools?: Command[]);
    addTool(tool: Command): this;
    addTools(...tools: Command[]): this;
    getTool(name: string): Command | undefined;
    hasTool(name: string): boolean;
    getAllTools(): Command[];
    getToolNames(): string[];
    execute(name: string, args?: string[]): Promise<ToolResult>;
    executeAll(): Promise<ToolResult[]>;
    /**
     * 从全局 commandRegistry 同步已有命令
     * 保持向后兼容：registry 中的命令自动进入 collection
     */
    syncFromRegistry(): Promise<this>;
}
/**
 * 全局工具集合实例
 * 启动时从 commandRegistry 异步同步，运行时可动态添加
 */
export declare const toolCollection: ToolCollection;
