/**
 * 百度搜索（无需 API Key）
 *
 * 自 D:\src\tools\MultiSearchTool\engines\baidu.ts 移植。
 * 修正：
 *   1. 上游无去重，同一 URL 可重复入列 —— 补 seen 集合。
 *   2. 块正则硬要求 `</div></div>` 结尾，稍改结构就整块匹配不到；
 *      改为非贪婪匹配到下一个同级 result 块或列表结束。
 *   3. 标题正则会命中块内第一个 <a>（可能是图标链接）—— 优先取带 http 链接的 <a>。
 */
import type { SearchResultItem } from '../types.ts'
import { stripHtml, looksLikeBlockPage } from '../htmlUtils.ts'
import { BROWSER_HEADERS } from '../httpHeaders.ts'

const ENGINE = 'baidu'

export const name = 'baidu'
export const displayName = 'Baidu'
export const needsKey = false

export function isAvailable(): boolean {
  return true
}

/**
 * 百度结果的真实地址被包在 www.baidu.com/link?url=xxx 跳转里。
 * 这里通过 HEAD 请求读重定向的 Location，还原真实 URL；
 * 解析失败（超时/被拒）时保留原跳转链接，至少可用。
 */
async function resolveBaiduRedirect(link: string): Promise<string> {
  if (!/baidu\.com\/link\?url=/.test(link)) return link
  try {
    const resp = await fetch(link, {
      method: 'HEAD',
      headers: BROWSER_HEADERS,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    })
    const loc = resp.headers.get('location')
    if (loc && /^https?:\/\//.test(loc) && !/baidu\.com/.test(loc)) return loc
  } catch {
    /* 忽略：保留原链接 */
  }
  return link
}

/** 结果块：class 含 result，但不含 c-container 之外的干扰；用惰性匹配避免吞并 */
const BLOCK_RE = /<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*\bresult\b|<\/body>)/g
const TITLE_RE = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/
const DESC_RE =
  /<span[^>]*class="[^"]*content-right_[^"]*"[^>]*>([\s\S]*?)<\/span>|<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]*?)<\/div>/

/**
 * 非内容链接（百度自家的导航/登录/榜单等），这些会混进结果块里，
 * 不是真正的搜索结果，必须过滤。
 */
const NOISE_URL_RE =
  /(?:^https?:\/\/)?(?:passport|top|www)\.baidu\.com\/(?:v2|board|link\?url=http%3A%2F%2Fwww\.baidu\.com%2F?(?:$|&))|baidu\.com\/(?:s\?|home\/)|hao123\.com|c\.baidu\.com|\/source\/|\/search\?/i

/** 噪声标题（导航文案） */
const NOISE_TITLE_RE = /^(登录|登录登录.*|百度首页|新闻|hao123|地图|贴吧|视频|图片|网盘|更多|设置|首页)$/

export async function search(
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const results: SearchResultItem[] = []
  const seen = new Set<string>()

  try {
    const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&ie=utf-8`
    const resp = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Referer: 'https://www.baidu.com/' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await resp.text()

    if (looksLikeBlockPage(html)) {
      console.error('[WebSearch:Baidu] 命中反爬/验证页，返回空结果')
      return results
    }

    BLOCK_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = BLOCK_RE.exec(html)) !== null) {
      if (results.length >= limit) break
      const block = m[1]

      const titleMatch = block.match(TITLE_RE)
      if (!titleMatch) continue

      const linkUrl = titleMatch[1]
      if (seen.has(linkUrl)) continue
      if (NOISE_URL_RE.test(linkUrl)) continue
      const title = stripHtml(titleMatch[2])
      if (!title || NOISE_TITLE_RE.test(title)) continue

      const descMatch = block.match(DESC_RE)
      const description = descMatch ? stripHtml(descMatch[1] || descMatch[2] || '') : ''

      seen.add(linkUrl)
      results.push({ title, url: linkUrl, description, engine: ENGINE })
    }

    const top = results.slice(0, limit)
    // 并发还原跳转链接（失败则保留原链接）
    return Promise.all(
      top.map(async (r) => ({ ...r, url: await resolveBaiduRedirect(r.url) })),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WebSearch:Baidu] 搜索失败:', msg)
    return results
  }
}
