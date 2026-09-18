/**
 * engine/tools/assemblePool.ts — 工具池组装
 *
 * 实现 assembleToolPool() 和 getMergedTools()。
 */

import type { Tool } from '../toolScheduler.ts'
import { getAllBaseTools } from './baseToolsFilter.ts'
import type { DenyRule, PresetId } from './baseToolsFilter.ts'
import { getToolsForPreset } from './baseToolsFilter.ts'

/** 工具池 */
export interface ToolPool {
  base: Tool[]
  commands: Tool[]
  mcp: Tool[]
  plugins: Tool[]
  skills: Tool[]
}

/** 工具池组装选项 */
export interface AssembleToolPoolOptions {
  preset?: PresetId
  denyRules?: DenyRule[]
  includeCommands?: boolean
  includeMcp?: boolean
  includePlugins?: boolean
  includeSkills?: boolean
}

/** 组装工具池 */
export function assembleToolPool(
  allTools: Tool[],
  options: AssembleToolPoolOptions = {},
): ToolPool {
  const {
    preset = 'default',
    denyRules = [],
    includeCommands = true,
    includeMcp = true,
    includePlugins = true,
    includeSkills = true,
  } = options

  // 获取基础工具并按预设过滤
  let base = getAllBaseTools(allTools)
  base = getToolsForPreset(base, preset)

  // 按类别分离工具
  const commands: Tool[] = []
  const mcp: Tool[] = []
  const plugins: Tool[] = []
  const skills: Tool[] = []

  for (const tool of allTools) {
    if (tool.name.startsWith('mcp:')) {
      if (includeMcp) mcp.push(tool)
    } else if (tool.name.startsWith('skill:')) {
      if (includeSkills) skills.push(tool)
    } else if (tool.name.startsWith('plugin:')) {
      if (includePlugins) plugins.push(tool)
    } else {
      if (includeCommands) commands.push(tool)
    }
  }

  return {
    base,
    commands,
    mcp,
    plugins,
    skills,
  }
}

/** 合并工具池为扁平数组 */
export function getMergedTools(pool: ToolPool): Tool[] {
  const merged: Tool[] = []
  const seen = new Set<string>()

  // 优先级：基础 > 命令 > MCP > 插件 > Skill
  const sources = [
    pool.base,
    pool.commands,
    pool.mcp,
    pool.plugins,
    pool.skills,
  ]

  for (const source of sources) {
    for (const tool of source) {
      if (!seen.has(tool.name)) {
        seen.add(tool.name)
        merged.push(tool)
      }
    }
  }

  return merged
}
