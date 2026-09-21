/**
 * Bing 搜索（无需 API Key）
 *
 * 自 D:\src\tools\MultiSearchTool\engines\bing.ts 移植。
 * 修正：
 *   1. 上游标题正则写死 `<a[^>]*href="..."[^>]*>`，网页实际常见 href 与 class 换位，
 *      会漏抓 —— 改为先整体取 <a> 标签，再单独抽 href / 文本。
 *   2. 无去重 —— 补 seen 集合。
 *   3. 标题正则要求文本非空，但上游把 linkUrl 也一并判空，逻辑冗余，已简化。
 */
import type { SearchResultItem } from '../types.ts'
import { stripHtml, looksLikeBlockPage } from '../htmlUtils.ts'
import { BROWSER_HEADERS } from '../httpHeaders.ts'

const ENGINE = 'bing'

export const name = 'bing'
export const displayName = 'Bing'
export const needsKey = false

export function isAvailable(): boolean {
  return true
}

/** 结果块：<li class="b_algo"> ... </li> */
const BLOCK_RE = /<li[^>]*class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/g
/** 块内标题链接（href 与 class 顺序无关） */
const ANCHOR_RE = /<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/
const DESC_RE = /<p[^>]*>([\s\S]*?)<\/p>/
/** 标题里混入的站点信息块（<cite>/<div class="tptt"> 等），提取前先剥掉 */
const TITLE_NOISE_RE = /<cite[^>]*>[\s\S]*?<\/cite>|<div[^>]*class="[^"]*tptt[^"]*"[^>]*>[\s\S]*?<\/div>|<span[^>]*class="[^"]*url[^"]*"[^>]*>[\s\S]*?<\/span>/g

export async function search(
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = []
  const seen = new Set<string>()

  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    const resp = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Referer: 'https://www.bing.com/' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await resp.text()

    if (looksLikeBlockPage(html)) {
      console.error('[WebSearch:Bing] 命中反爬/验证页，返回空结果')
      return results
    }

    BLOCK_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = BLOCK_RE.exec(html)) !== null) {
      if (results.length >= limit) break
      const block = m[1]

      const anchorMatch = block.match(ANCHOR_RE)
      if (!anchorMatch) continue

      const linkUrl = anchorMatch[1]
      if (seen.has(linkUrl)) continue
      // 先剥掉锚点里的 cite/站点信息块，否则标题会变成 "域名https://..."
      const title = stripHtml(anchorMatch[2].replace(TITLE_NOISE_RE, ''))
      if (!title) continue

      const descMatch = block.match(DESC_RE)
      seen.add(linkUrl)
      results.push({
        title,
        url: linkUrl,
        description: descMatch ? stripHtml(descMatch[1]) : '',
        engine: ENGINE,
      })
    }

    return results.slice(0, limit)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WebSearch:Bing] 搜索失败:', msg)
    return results
  }
}
