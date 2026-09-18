/**
 * engine/commands/availability.ts — 命令可用性检查
 *
 * 实现 meetsAvailabilityRequirement() 和 filterCommandsByAvailability()。
 */

import type { Command, AvailabilityRequirement } from './types.js'

/** 检查命令是否满足可用性要求 */
export function meetsAvailabilityRequirement(req: AvailabilityRequirement): boolean {
  // 平台检查
  if (req.platform && process.platform !== req.platform) {
    return false
  }

  // 远程模式检查
  if (req.remote !== undefined) {
    const isRemote = process.env.CLAUDE_CODE_REMOTE === '1'
    if (req.remote && !isRemote) return false
    if (!req.remote && isRemote) return false
  }

  // 版本检查（TODO: 集成版本系统）
  if (req.minVersion) {
    // 暂时跳过版本检查
  }

  // 特性标记检查（TODO: 集成 GrowthBook）
  if (req.feature) {
    // 暂时跳过特性检查
  }

  return true
}

/** 按可用性过滤命令 */
export function filterCommandsByAvailability(
  commands: Command[],
): Command[] {
  return commands.filter(cmd => {
    if (!cmd.availability) return true
    return meetsAvailabilityRequirement(cmd.availability)
  })
}
