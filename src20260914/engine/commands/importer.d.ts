/**
 * src/engine/commands/importer.ts — 命令导入器
 *
 * 返回已注册的命令总数。
 * 所有命令在 registry.ts 中静态注册，此处仅做计数。
 */
export declare function importCommands(): Promise<number>;
