/**
 * engine/tools/presets.ts — 工具预设系统
 *
 * 实现 TOOL_PRESETS 常量和 ToolPreset 类型。
 */

/** 工具预设 */
export interface ToolPreset {
  id: string
  name: string
  description: string
  tags: string[]
  denyRules?: string[]
  allowRules?: string[]
}

/** 预设 ID 类型 */
export type PresetId = 'default' | 'programming' | 'search' | 'minimal'

/** 工具预设常量 */
export const TOOL_PRESETS: Record<PresetId, ToolPreset> = {
  default: {
    id: 'default',
    name: 'Default',
    description: '所有基础工具',
    tags: ['read', 'write', 'edit', 'bash', 'search', 'web'],
  },
  programming: {
    id: 'programming',
    name: 'Programming',
    description: '编程相关工具',
    tags: ['read', 'write', 'edit', 'bash', 'grep', 'glob'],
  },
  search: {
    id: 'search',
    name: 'Search',
    description: '搜索相关工具',
    tags: ['search', 'web', 'fetch', 'grep', 'glob'],
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: '最小工具集',
    tags: ['read', 'bash'],
  },
}

/**
 * 解析工具预设。
 *
 * 返回值是**副本**：TOOL_PRESETS 是全局常量，若直接把常量对象交出去，
 * 调用方一句 `preset.tags.push(...)` 就会永久污染该预设，之后所有解析
 * 同一预设的代码都拿到被改过的数据（且重启前不会自愈）。
 */
export function parseToolPreset(input: string): ToolPreset | null {
  // 直接匹配预设 ID
  const direct = TOOL_PRESETS[input as PresetId]
  if (direct) return clonePreset(direct)

  // 名称模糊匹配
  const lower = input.toLowerCase()
  for (const preset of Object.values(TOOL_PRESETS)) {
    if (preset.name.toLowerCase() === lower) return clonePreset(preset)
    if (preset.id.toLowerCase() === lower) return clonePreset(preset)
  }

  return null
}

/** 复制预设（含数组字段），避免调用方污染全局常量 */
export function clonePreset(preset: ToolPreset): ToolPreset {
  return {
    ...preset,
    tags: [...preset.tags],
    denyRules: preset.denyRules ? [...preset.denyRules] : undefined,
    allowRules: preset.allowRules ? [...preset.allowRules] : undefined,
  }
}
