/**
 * engine/commands/mcpSkillCommands.ts — MCP 与 Skill 命令分类
 *
 * 实现 getMcpSkillCommands()、getSkillToolCommands()、getSlashCommandToolSkills()。
 */

import type { Command } from './types.ts'
import type { Tool } from '../toolScheduler.ts'

/** MCP 命令前缀 */
const MCP_PREFIX = 'mcp:'
/** Skill 命令前缀 */
const SKILL_PREFIX = 'skill:'

/**
 * 从 MCP 工具列表生成命令
 */
export function getMcpSkillCommands(
  mcpTools: Tool[],
  skillTools: Tool[],
): Command[] {
  const commands: Command[] = []

  // MCP 工具转为命令
  for (const tool of mcpTools) {
    if (tool.name.startsWith(MCP_PREFIX)) {
      commands.push({
        name: tool.name,
        description: `[mcp] ${tool.description}`,
        group: 'mcp',
        tags: ['mcp'],
        execute: async () => ({
          success: false,
          error: 'MCP 命令需通过工具调度器执行',
          needsAgent: true,
        }),
      })
    }
  }

  // Skill 工具转为命令
  for (const tool of skillTools) {
    if (tool.name.startsWith(SKILL_PREFIX)) {
      commands.push({
        name: tool.name,
        description: `[skill] ${tool.description}`,
        group: 'skill',
        tags: ['skill'],
        execute: async () => ({
          success: false,
          error: 'Skill 命令需通过工具调度器执行',
          needsAgent: true,
        }),
      })
    }
  }

  return commands
}

/**
 * 获取 Skill 工具命令
 */
export function getSkillToolCommands(skillTools: Tool[]): Command[] {
  return skillTools
    .filter(t => t.name.startsWith(SKILL_PREFIX))
    .map(t => ({
      name: t.name,
      description: `[skill] ${t.description}`,
      group: 'skill',
      tags: ['skill'],
      execute: async () => ({
        success: false,
        error: 'Skill 命令需通过工具调度器执行',
        needsAgent: true,
      }),
    }))
}

/**
 * 获取 MCP 工具命令
 */
export function getMcpToolCommands(mcpTools: Tool[]): Command[] {
  return mcpTools
    .filter(t => t.name.startsWith(MCP_PREFIX))
    .map(t => ({
      name: t.name,
      description: `[mcp] ${t.description}`,
      group: 'mcp',
      tags: ['mcp'],
      execute: async () => ({
        success: false,
        error: 'MCP 命令需通过工具调度器执行',
        needsAgent: true,
      }),
    }))
}

/**
 * 斜杠命令到 tool/skill 的映射
 */
export interface SlashCommandMapping {
  slashCommand: string
  toolNames: string[]
}

export function getSlashCommandToolSkills(
  commands: Command[],
): Map<string, string[]> {
  const mapping = new Map<string, string[]>()

  for (const cmd of commands) {
    if (cmd.name.startsWith(MCP_PREFIX) || cmd.name.startsWith(SKILL_PREFIX)) {
      // 去掉前缀作为斜杠命令名
      const slashName = cmd.name.replace(/^(mcp:|skill:)/, '')
      const existing = mapping.get(slashName) ?? []
      existing.push(cmd.name)
      mapping.set(slashName, existing)
    }
  }

  return mapping
}
