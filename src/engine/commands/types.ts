/**
 * engine/commands/types.ts — 命令系统类型与常量
 *
 * 定义 Command 接口、常量列表和分类。
 */

/** 命令结果 */
export interface CommandResult {
  success: boolean
  output?: string
  error?: string
  needsAgent?: boolean
}

/** 命令执行函数类型 */
export type CommandExecute = (
  args: string[],
  context?: Record<string, unknown>,
) => Promise<CommandResult>

/** 命令接口 */
export interface Command {
  name: string
  description: string
  execute: CommandExecute
  group?: string
  tags?: string[]
  availability?: AvailabilityRequirement
  alias?: string[]
}

/** 可用性要求 */
export interface AvailabilityRequirement {
  platform?: 'win32' | 'darwin' | 'linux'
  mode?: 'cli' | 'web' | 'electron'
  remote?: boolean
  minVersion?: string
  feature?: string
}

/** 本地命令结果（扩展 CommandResult） */
export interface LocalCommandResult extends CommandResult {
  meta?: Record<string, unknown>
}

/** 内部专用命令列表 */
export const INTERNAL_ONLY_COMMANDS: string[] = [
  '/init',
  '/compact',
  '/clear',
  '/hooks',
]

/** 所有内置命令名 */
export const builtInCommandNames: string[] = [
  '/help',
  '/version',
  '/list',
  '/status',
  '/history',
  '/clear',
  '/init',
  '/compact',
  '/hooks',
  '/search',
  '/settings',
]

/** 桥接安全命令列表 */
export const BRIDGE_SAFE_COMMANDS: string[] = [
  '/help',
  '/version',
  '/list',
  '/status',
  '/history',
]
