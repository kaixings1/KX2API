/**
 * src/engine/commands/importer.ts — 命令导入器
 *
 * 返回已注册的命令总数。
 * 所有命令在 registry.ts 中静态注册，此处仅做计数。
 */

import { commandRegistry } from './registry.ts'
import type { Command } from './types.ts'

export async function importCommands(): Promise<number> {
  // 所有命令已在 registry.ts 中注册，返回总数
  return commandRegistry.getNames().length
}
