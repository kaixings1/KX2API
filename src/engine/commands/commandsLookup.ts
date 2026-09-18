/**
 * engine/commands/commandsLookup.ts — 命令查找与描述
 *
 * 实现 getCommand()、findCommand()、hasCommand()、formatDescriptionWithSource()。
 */

import type { Command } from './types.ts'

/** 统一命令获取接口（精确 -> 别名 -> 前缀匹配） */
export function getCommand(name: string, commands: Command[]): Command | undefined {
  const lower = name.toLowerCase()

  // 精确匹配
  const exact = commands.find(c => c.name.toLowerCase() === lower)
  if (exact) return exact

  // 别名匹配
  const aliasMatch = commands.find(c =>
    c.alias?.some(a => a.toLowerCase() === lower),
  )
  if (aliasMatch) return aliasMatch

  // 前缀匹配
  const prefixMatch = commands.find(c =>
    c.name.toLowerCase().startsWith(lower) ||
    c.alias?.some(a => a.toLowerCase().startsWith(lower)),
  )
  if (prefixMatch) return prefixMatch

  return undefined
}

/** 检查命令是否存在 */
export function hasCommand(name: string, commands: Command[]): boolean {
  return getCommand(name, commands) !== undefined
}

/** 查找命令（支持模糊/别名/前缀匹配） */
export function findCommand(nameOrAlias: string, commands: Command[]): Command | undefined {
  const lower = nameOrAlias.toLowerCase()

  // 精确名称匹配
  const exact = commands.find(c => c.name.toLowerCase() === lower)
  if (exact) return exact

  // 别名匹配
  const aliasMatch = commands.find(c =>
    c.alias?.some(a => a.toLowerCase() === lower),
  )
  if (aliasMatch) return aliasMatch

  // 前缀匹配（如 /t 匹配 /task）
  const prefixMatch = commands.find(c =>
    c.name.toLowerCase().startsWith(lower) ||
    c.alias?.some(a => a.toLowerCase().startsWith(lower)),
  )
  if (prefixMatch) return prefixMatch

  return undefined
}

/** 格式化命令描述（带来源标签） */
export function formatDescriptionWithSource(cmd: Command): string {
  const prefix = getSourcePrefix(cmd)
  return `${prefix} ${cmd.description}`.trim()
}

/** 获取来源前缀 */
function getSourcePrefix(cmd: Command): string {
  const name = cmd.name
  if (name.startsWith('mcp:')) return '[mcp]'
  if (name.startsWith('skill:')) return '[skill]'
  return '[builtin]'
}
