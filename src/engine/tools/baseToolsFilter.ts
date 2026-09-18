/**
 * engine/tools/baseToolsFilter.ts — 基础工具获取与过滤
 *
 * 实现 getAllBaseTools() 和 filterToolsByDenyRules()。
 */

import type { Tool } from '../toolScheduler.ts'
import type { PresetId } from './presets.ts'
import { TOOL_PRESETS } from './presets.ts'

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

export type { PresetId } from './presets.ts'

/**
 * 按预设过滤工具。
 *
 * 语义：预设的 `tags` 是**允许的标签白名单**（如 minimal = read + bash）。
 * - 有 allowRules/denyRules 时优先按规则；
 * - 否则按 tags 白名单：工具的 tags 与预设 tags 有交集即保留。
 *
 * ⚠️ 原实现只看 `preset.denyRules`，而 TOOL_PRESETS 里没有任何预设定义该字段
 * （只有 tags），于是函数恒返回全部工具 —— "按预设筛选"完全没生效，
 * 而且就算定义了也是按 tag 当 deny 用，与 tags 的允许语义正好相反。
 */
export function getToolsForPreset(tools: Tool[], presetId: PresetId): Tool[] {
  const preset = TOOL_PRESETS[presetId]
  if (!preset) return tools

  // 显式 deny 规则优先（若预设将来定义）
  if (preset.denyRules && preset.denyRules.length > 0) {
    return filterToolsByDenyRules(tools, preset.denyRules.map(r => ({ tag: r })))
  }

  // 按 tags 白名单筛选
  if (preset.tags.length === 0) return tools
  const allowed = new Set(preset.tags)
  return tools.filter(t => {
    const tags = (t as { tags?: string[] }).tags
    if (!tags || tags.length === 0) return true // 无标签的工具不做限制
    return tags.some(tag => allowed.has(tag))
  })
}
