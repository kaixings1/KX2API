/**
 * 网络搜索（自 D:\src\tools\MultiSearchTool\MultiSearchTool.ts 移植）
 *
 * 上游是一个 buildTool 工厂产物（依赖 Tool.js/lazySchema/zod），这里剥离为纯函数，
 * 由 registry 的 /websearch 命令调用。
 *
 * 修正：上游 searchAll 的 perEngine 用 ceil(limit/引擎数)，多引擎时可能超过 limit；
 * 且每个引擎各自 limit 会放大请求量。这里改为按引擎均分且总和不超过 limit。
 */
import type { SearchResultItem } from './types.ts'
import engines, { getAvailableEngines, getEngine } from './engines/index.ts'

export type { SearchResultItem, SearchEngine } from './types.ts'
export { getAvailableEngines, getEngine } from './engines/index.ts'

export const WEB_SEARCH_DEFAULT_LIMIT = 5
export const WEB_SEARCH_MAX_LIMIT = 20

export interface WebSearchOptions {
  /** 搜索引擎：duckduckgo / baidu / bing；省略或 'auto' 则聚合全部可用引擎 */
  engine?: string
  /** 最大结果数，1-20，默认 5 */
  limit?: number
}

export interface WebSearchResponse {
  query: string
  engine: string
  results: SearchResultItem[]
  durationMs: number
}

/** 列出已注册的引擎（含是否需要 Key） */
export function listEngines(): { name: string; displayName: string; needsKey: boolean; available: boolean }[] {
  return engines.map((e) => ({
    name: e.name,
    displayName: e.displayName,
    needsKey: e.needsKey,
    available: e.isAvailable(),
  }))
}

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return WEB_SEARCH_DEFAULT_LIMIT
  return Math.min(WEB_SEARCH_MAX_LIMIT, Math.max(1, Math.trunc(limit as number)))
}

/** 单引擎搜索；引擎未知时回退到 duckduckgo */
export async function searchWithEngine(
  engineName: string,
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const engine = getEngine(engineName)
  if (!engine) {
    const fallback = getEngine('duckduckgo')
    return fallback ? fallback.search(query, limit) : []
  }
  return engine.search(query, limit)
}

/** 聚合所有可用引擎的结果，按 URL 去重后截断到 limit */
export async function searchAll(
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const available = getAvailableEngines()
  if (available.length === 0) return []

  // 每个引擎只取「均分份额」，避免总量放大；余数补给前面的引擎
  const base = Math.floor(limit / available.length)
  const remainder = limit % available.length
  const batches = await Promise.all(
    available.map((e, i) => e.search(query, Math.max(1, base + (i < remainder ? 1 : 0)))),
  )

  const seen = new Set<string>()
  const merged: SearchResultItem[] = []
  for (const batch of batches) {
    for (const item of batch) {
      if (seen.has(item.url)) continue
      seen.add(item.url)
      merged.push(item)
    }
  }
  return merged.slice(0, limit)
}

/** 主入口：执行搜索并返回结构化结果 */
export async function webSearch(
  query: string,
  options: WebSearchOptions = {},
): Promise<WebSearchResponse> {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('需要提供搜索查询词')

  const engineName = options.engine?.trim() || 'auto'
  const limit = clampLimit(options.limit)
  const startTime = performance.now()

  const results =
    engineName === 'auto'
      ? await searchAll(trimmed, limit)
      : await searchWithEngine(engineName, trimmed, limit)

  return {
    query: trimmed,
    engine: engineName,
    results,
    durationMs: Math.round(performance.now() - startTime),
  }
}

/** 把搜索结果渲染为便于阅读的文本 */
export function formatSearchResults(resp: WebSearchResponse): string {
  if (resp.results.length === 0) {
    return `未找到结果（引擎: ${resp.engine}，查询: ${resp.query}）。可能是网络不可达或引擎改版。`
  }
  const lines: string[] = [
    `查询「${resp.query}」｜引擎: ${resp.engine}｜${resp.results.length} 条｜${resp.durationMs}ms`,
    '',
  ]
  resp.results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}`)
    lines.push(`   ${r.url}`)
    if (r.description) lines.push(`   ${r.description}`)
    lines.push(`   [${r.engine}]`)
    lines.push('')
  })
  return lines.join('\n').trimEnd()
}
