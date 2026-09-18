/**
 * engine/tools/baseToolsFilter.ts — 基础工具获取与过滤
 *
 * 实现 getAllBaseTools() 和 filterToolsByDenyRules()。
 */

import type { Tool } from '../toolScheduler.js'
import type { PresetId } from './presets.js'
import { TOOL_PRESETS } from './presets.js'

/** Deny 规则 */
export interface DenyRule {
  tool?: string
  tag?: string
  path?: string
  env?: string
}

/** 基础工具列表 */
export const BASE_TOOL_NAMES: string[] = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
]

/** 获取所有基础工具 */
export function getAllBaseTools(tools: Tool[]): Tool[] {
  return tools.filter(t => BASE_TOOL_NAMES.some(name => t.name === name))
}

/** 按 deny 规则过滤工具 */
export function filterToolsByDenyRules(tools: Tool[], rules: DenyRule[]): Tool[] {
  if (rules.length === 0) return tools

  return tools.filter(tool => {
    for (const rule of rules) {
      if (matchesDenyRule(tool, rule)) return false
    }
    return true
  })
}

/** 检查工具是否匹配 deny 规则 */
function matchesDenyRule(tool: Tool, rule: DenyRule): boolean {
  if (rule.tool && tool.name === rule.tool) return true
  if (rule.tag && tool.tags?.some(t => t === rule.tag)) return true
  return false
}

export type { PresetId } from './presets.js'

/** 按预设过滤工具 */
export function getToolsForPreset(tools: Tool[], presetId: PresetId): Tool[] {
  const preset = TOOL_PRESETS[presetId]
  if (!preset.denyRules) return tools

  const rules: DenyRule[] = preset.denyRules.map(r => ({ tag: r }))
  return filterToolsByDenyRules(tools, rules)
}
