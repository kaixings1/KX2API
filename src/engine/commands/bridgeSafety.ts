/**
 * engine/commands/bridgeSafety.ts — 桥接安全命令
 *
 * 实现 BRIDGE_SAFE_COMMANDS 常量和 isBridgeSafeCommand() / filterCommandsForRemoteMode()。
 */

import type { Command } from './types.ts'
import { BRIDGE_SAFE_COMMANDS } from './types.ts'

/** 检查是否为桥接安全命令 */
export function isBridgeSafeCommand(name: string): boolean {
  const normalized = name.toLowerCase()
  return BRIDGE_SAFE_COMMANDS.some(cmd => cmd.toLowerCase() === normalized)
}

/** 检测命令是否有危险操作 */
export function hasDangerousOperation(cmd: Command): boolean {
  // 简单约定检测：查看命令名和 tags
  const dangerousPatterns = ['write', 'delete', 'remove', 'exec', 'shell', 'bash']
  const nameLower = cmd.name.toLowerCase()
  const tagsLower = (cmd.tags || []).map(t => t.toLowerCase())

  return (
    dangerousPatterns.some(p => nameLower.includes(p)) ||
    tagsLower.some(t => dangerousPatterns.some(p => t.includes(p)))
  )
}

/** 过滤出远程模式可用的命令 */
export function filterCommandsForRemoteMode(commands: Command[]): Command[] {
  return commands.filter(cmd => {
    if (isBridgeSafeCommand(cmd.name)) return true
    if (hasDangerousOperation(cmd)) return false
    // 检查 availability.remote 字段
    if (cmd.availability?.remote === false) return false
    return true
  })
}
