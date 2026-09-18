/**
 * engine/context/claudeMd.ts — CLAUDE.md 外部引用工具链
 *
 * 实现记忆文件扫描、CLAUDE.md 外部引用解析等功能。
 */

import type { MemoryFile } from '../utils/claudeMd.js'

/** 检测是否处于 bare 模式 */
export function isBareMode(): boolean {
  return !!process.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS ||
         process.env.CLAUDE_CODE_BARE_MODE === '1'
}

/** 获取额外扫描目录 */
export function getAdditionalDirectoriesForClaudeMd(): string[] {
  const dirs = process.env.CLAUDE_CODE_ADDITIONAL_CLAUDE_MD_DIRS
  if (!dirs) return []
  return dirs.split(',').map(d => d.trim()).filter(Boolean)
}

/** 环境变量布尔判断 */
export function isEnvTruthy(env: string): boolean {
  const val = process.env[env]
  if (!val) return false
  // 必须 trim：shell / .env / Dockerfile 里写成 `VAR= false ` 很常见，
  // 不 trim 会把带空白的假值（" false "）判为真 —— 这类"开关没生效"的
  // 问题排查起来很费时间，因为值看起来明明是对的。
  const normalized = val.trim().toLowerCase()
  if (normalized === '') return false
  return !['0', 'false', 'no', 'off'].includes(normalized)
}

/** 过滤系统注入的记忆文件 */
export function filterInjectedMemoryFiles(files: MemoryFile[]): MemoryFile[] {
  return files.filter(f => !f.scope?.includes('injected'))
}

/** 缓存 CLAUDE.md 内容（内存级） */
let _cachedClaudeMdContent: string | null = null
let _cachedClaudeMdPath: string | null = null

export function setCachedClaudeMdContent(content: string | null, path?: string): void {
  _cachedClaudeMdContent = content
  _cachedClaudeMdPath = path ?? null
}

export function getCachedClaudeMdContent(): string | null {
  return _cachedClaudeMdContent
}

export function getCachedClaudeMdPath(): string | null {
  return _cachedClaudeMdPath
}
