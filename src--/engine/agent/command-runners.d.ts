/**
 * Agent 命令具体实现
 * 每个 AI-agent 命令都有真实的执行逻辑
 *
 * 分类：
 * - local: 直接调用本地工具（git、文件系统、进程等）
 * - llm: 构建专用 prompt 交给 LLM 执行（代码生成、分析等）
 * - team: 多角色协作（复杂任务）
 */
export type RunnerType = 'local' | 'llm' | 'team';
export interface CommandRunner {
    type: RunnerType;
    description: string;
    /**
     * @param args 命令参数
     * @param cwd 工作目录
     * @param config LLM 配置（llm 类型需要）
     */
    execute: (args: string[], cwd: string, config?: {
        provider: string;
        apiKey: string;
        model: string;
        baseUrl?: string;
        maxTokens?: number;
    }) => Promise<string>;
}
export declare const commandRunners: Map<string, CommandRunner>;
