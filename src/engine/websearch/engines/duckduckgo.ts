/**
 * DuckDuckGo 搜索（无需 API Key）
 *
 * 自 D:\src\tools\MultiSearchTool\engines\duckduckgo.ts 移植。
 * 修正：上游用两个独立正则分别扫全页的标题与摘要，再按下标配对，
 * 一旦某结果没有摘要（或摘要数量与标题数不等）就会整体错位。
 * 这里改为逐结果块内提取，标题与摘要天然对齐。
 */
import type { SearchResultItem } from '../types.ts'
import { stripHtml, looksLikeBlockPage } from '../htmlUtils.ts'
import { BROWSER_HEADERS } from '../httpHeaders.ts'

const ENGINE = 'duckduckgo'

export const name = 'duckduckgo'
export const displayName = 'DuckDuckGo'
export const needsKey = false

export function isAvailable(): boolean {
  return true
}

// 每个结果块：<div class="result ..."> ... </div>
const RESULT_BLOCK_RE = /<div[^>]*class="[^"]*result results_links[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g
// 块内：标题链接
const TITLE_RE = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
// 块内：摘要
const SNIPPET_RE = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/

export async function search(
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = []
  const seen = new Set<string>()

  try {
    const formData = new URLSearchParams()
    formData.append('q', query)

    const resp = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://html.duckduckgo.com',
        Referer: 'https://html.duckduckgo.com/',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(15000),
    })

    const html = await resp.text()

    if (looksLikeBlockPage(html)) {
      console.error('[WebSearch:DuckDuckGo] 命中反爬/验证页，返回空结果')
      return results
    }

    const blocks: string[] = []
    let m: RegExpExecArray | null
    RESULT_BLOCK_RE.lastIndex = 0
    while ((m = RESULT_BLOCK_RE.exec(html)) !== null) {
      blocks.push(m[1])
      if (blocks.length >= limit * 3) break
    }

    for (const block of blocks) {
      if (results.length >= limit) break

      const titleMatch = block.match(TITLE_RE)
      if (!titleMatch) continue

      const url = titleMatch[1]
      // 跳过广告位
      if (url.includes('//duckduckgo.com/y.js') || url.includes('//duckduckgo.com/l/')) continue
      if (seen.has(url)) continue

      const title = stripHtml(titleMatch[2])
      if (!title) continue

      const snippetMatch = block.match(SNIPPET_RE)
      seen.add(url)
      results.push({
        title,
        url,
        description: snippetMatch ? stripHtml(snippetMatch[1]) : '',
        engine: ENGINE,
      })
    }

    return results.slice(0, limit)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WebSearch:DuckDuckGo] 搜索失败:', msg)
    return results
  }
}
