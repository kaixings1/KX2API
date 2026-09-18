/**
 * engine/context/userContext.ts — 用户上下文
 *
 * 获取用户级上下文：CLAUDE.md 文件内容、日期等。
 */

import { isBareMode, getCachedClaudeMdContent } from './claudeMd.ts'
import { loadInstructions, formatInstructionsForPrompt } from '../instructions/claudeMdLoader.ts'

/** 用户上下文数据 */
export interface UserContextData {
  claudeMd: string | null
  currentDate: string
}

let _cache: UserContextData | null = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * 获取用户上下文。
 *
 * 命中缓存时返回**副本**：直接返回 _cache 的话，调用方（如提示词组装层）
 * 若就地改动返回值，会污染整个 TTL 窗口内的所有调用者 —— 表现为
 * "某些会话拿到的 CLAUDE.md 内容莫名其妙不对"，且 5 分钟后自愈，极难复现。
 */
export async function getUserContext(): Promise<UserContextData> {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return { ..._cache }
  }

  const result: UserContextData = {
    claudeMd: null,
    currentDate: new Date().toISOString().split('T')[0] || new Date().toLocaleDateString(),
  }

  if (isBareMode()) {
    _cache = result
    _cacheTime = now
    return { ...result }
  }

  // 优先使用缓存内容（由 claudeMdLoader 在加载后写入）
  const cached = getCachedClaudeMdContent()
  if (cached) {
    result.claudeMd = cached
  } else {
    // 缓存未命中时，直接调用带正文的项目指令加载器。
    //
    // ⚠️ 原实现的链路是断的，有两重失效：
    //   ① `getExternalClaudeMdIncludes('')` 传的是空串，解析结果恒为空数组，
    //      而它被当作闸门（`if (includes.length > 0)`）→ 整段从未执行；
    //   ② 即便进去，`getMemoryFiles` 也是空壳（恒返回 []），仍拿不到内容。
    // 这里改为直接走 instructions/claudeMdLoader（真实实现：
    // 逐级向上查找、@include 展开、本地覆盖文件优先）。
    // 失败一律静默降级为 null —— 用户上下文是增强项，不该阻断对话。
    try {
      const files = await loadInstructions({ cwd: process.cwd() })
      const formatted = formatInstructionsForPrompt(files)
      if (formatted) result.claudeMd = formatted
    } catch {
      // ignore
    }
  }

  _cache = result
  _cacheTime = now
  // 首次计算也返回副本（与命中分支一致）：否则首个调用者拿到的正是
  // 缓存内部对象，它一改就污染后续所有命中者。
  return { ...result }
}

/** 清除用户上下文缓存 */
export function clearUserContextCache(): void {
  _cache = null
  _cacheTime = 0
}
