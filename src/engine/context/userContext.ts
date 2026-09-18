/**
 * engine/context/userContext.ts — 用户上下文
 *
 * 获取用户级上下文：CLAUDE.md 文件内容、日期等。
 */

import { getExternalClaudeMdIncludes, getMemoryFiles, shouldShowClaudeMdExternalIncludesWarning } from '../utils/claudeMd.js'
import { isBareMode, getAdditionalDirectoriesForClaudeMd, filterInjectedMemoryFiles, getCachedClaudeMdContent } from './claudeMd.js'

/** 用户上下文数据 */
export interface UserContextData {
  claudeMd: string | null
  currentDate: string
}

let _cache: UserContextData | null = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/** 获取用户上下文 */
export async function getUserContext(): Promise<UserContextData> {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return _cache
  }

  const result: UserContextData = {
    claudeMd: null,
    currentDate: new Date().toISOString().split('T')[0] || new Date().toLocaleDateString(),
  }

  if (isBareMode()) {
    _cache = result
    _cacheTime = now
    return result
  }

  // 优先使用缓存内容
  const cached = getCachedClaudeMdContent()
  if (cached) {
    result.claudeMd = cached
  } else {
    // 尝试加载 CLAUDE.md 外部引用
    try {
      const includes = getExternalClaudeMdIncludes('')
      if (includes.length > 0) {
        const memoryFiles = getMemoryFiles(process.cwd())
        const filtered = filterInjectedMemoryFiles(memoryFiles)
        if (filtered.length > 0) {
          result.claudeMd = filtered.map(f => f.content).join('\n\n---\n\n')
        }
      }
    } catch {
      // ignore
    }
  }

  _cache = result
  _cacheTime = now
  return result
}

/** 清除用户上下文缓存 */
export function clearUserContextCache(): void {
  _cache = null
  _cacheTime = 0
}
