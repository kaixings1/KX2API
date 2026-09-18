/**
 * engine/commands/getCommands.ts — 命令获取与缓存
 *
 * 实现 getCommands()、clearCommandsCache()、getRemoteSafeCommands()。
 */

import type { Command, AvailabilityRequirement } from './types.ts'

/** 缓存键 */
type CacheKey = string

/** 命令获取选项 */
export interface GetCommandsOptions {
  group?: string
  tags?: string[]
  includeDisabled?: boolean
  mode?: 'cli' | 'web' | 'electron'
  remote?: boolean
}

/** 命令缓存 */
const commandCache = new Map<CacheKey, Command[]>()
const memoizationCache = new Map<string, unknown>()

/** 生成缓存键 */
function makeCacheKey(opts: GetCommandsOptions): CacheKey {
  return JSON.stringify({
    g: opts.group,
    t: opts.tags?.sort(),
    d: opts.includeDisabled,
    m: opts.mode,
    r: opts.remote,
  })
}

/** 清除命令缓存 */
export function clearCommandsCache(): void {
  commandCache.clear()
}

/** 清除所有命令相关的 memoization 缓存 */
export function clearCommandMemoizationCaches(): void {
  memoizationCache.clear()
  clearCommandsCache()
}

/** 检查命令是否满足可用性要求 */
function meetsAvailability(cmd: Command, opts: GetCommandsOptions): boolean {
  const req = cmd.availability
  if (!req) return true

  if (opts.mode && req.mode && req.mode !== opts.mode) return false
  if (opts.remote !== undefined && req.remote !== undefined && req.remote !== opts.remote) return false
  if (opts.includeDisabled === false && req.feature) return false

  return true
}

/** 检查命令是否匹配标签 */
function matchesTags(cmd: Command, tags?: string[]): boolean {
  if (!tags || tags.length === 0) return true
  if (!cmd.tags || cmd.tags.length === 0) return false
  return tags.some(t => cmd.tags!.includes(t))
}

/**
 * 获取过滤后的命令列表
 * @param commands 完整命令列表
 * @param options 过滤选项
 */
export function getCommands(commands: Command[], options: GetCommandsOptions = {}): Command[] {
  const cacheKey = makeCacheKey(options)
  const cached = commandCache.get(cacheKey)
  if (cached) return cached

  let result = commands

  // 按可用性过滤
  if (options.mode !== undefined || options.remote !== undefined) {
    result = result.filter(cmd => meetsAvailability(cmd, options))
  }

  // 按组过滤
  if (options.group) {
    result = result.filter(cmd => cmd.group === options.group)
  }

  // 按标签过滤
  if (options.tags && options.tags.length > 0) {
    result = result.filter(cmd => matchesTags(cmd, options.tags))
  }

  commandCache.set(cacheKey, result)
  return result
}

/** 远程安全命令列表 */
const REMOTE_SAFE_COMMANDS = new Set([
  'help', 'list', 'status', 'history', 'search',
])

/**
 * 过滤出远程模式可用的命令
 */
export function getRemoteSafeCommands(commands: Command[]): Command[] {
  return commands.filter(cmd => {
    if (cmd.availability?.remote === false) return false
    return REMOTE_SAFE_COMMANDS.has(cmd.name)
  })
}

/**
 * 过滤命令列表供远程模式使用
 * (re-export from bridgeSafety for backward compatibility)
 */
export { filterCommandsForRemoteMode } from './bridgeSafety.ts'
