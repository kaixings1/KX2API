/**
 * exec.ts — 安全执行本地命令
 * 使用 Node.js 原生 child_process，无需额外依赖
 */
export declare function execaCommand(command: string, cwd: string, timeout?: number): Promise<{
    stdout: string;
    stderr: string;
}>;
