/**
 * 搜索结果 HTML 清洗工具
 *
 * 三个引擎（duckduckgo/baidu/bing）原本各自复制了一份 decodeHtmlEntities/stripHtml，
 * 且实体表不全（缺 &#39; &nbsp; 数字实体等）。这里合并为一份，并补齐常见实体。
 */

/** 常见命名实体表 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  middot: '·',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  times: '×',
  divide: '÷',
  bull: '•',
  deg: '°',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
}

/**
 * 解码 HTML 实体。
 * 支持命名实体与十进制/十六进制数字实体（如 &#x27; &#39; &#160;）。
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    const named = NAMED_ENTITIES[body.toLowerCase()]
    return named ?? whole
  })
}

/** 去除标签并解码实体（顺序敏感：先剥标签，再解实体，避免解码出的 < 被当标签） */
export function stripHtml(text: string): string {
  return decodeHtmlEntities(text.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

/**
 * 反爬/拦截页特征。
 *
 * 搜索引擎在检测到脚本化请求时会返回验证页、跳转页或极短页面，
 * 而不是搜索结果。若不识别，解析器会把登录框、热门榜之类的
 * 噪声当成结果返回（实测百度会返回"百度安全验证"页）。
 */
const BLOCK_PAGE_MARKERS = [
  '百度安全验证',
  '网络不给力，请稍后重试',
  '安全验证',
  '请开启JavaScript',
  'enable JavaScript',
  'unusual traffic',
  'detected unusual traffic',
  'verify you are human',
  'cf-browser-verification',
  'Just a moment',
]

/** 页面是否像反爬/验证/错误页 */
export function looksLikeBlockPage(html: string): boolean {
  // 极短页面（<2KB）几乎不可能是真实结果页
  if (html.length < 2048) return true
  const head = html.slice(0, 4096)
  return BLOCK_PAGE_MARKERS.some((m) => head.includes(m))
}

/**
 * 从 HTML 中按「结果块正则」批量抽取条目。
 * 抽成公共函数是因为三个引擎的循环结构完全一致（限流 + 去重 + 字段提取）。
 */
export function extractBlocks(
  html: string,
  blockRegex: RegExp,
  limit: number,
): string[] {
  const blocks: string[] = []
  let m: RegExpExecArray | null
  while ((m = blockRegex.exec(html)) !== null) {
    blocks.push(m[1])
    if (blocks.length >= limit * 3) break // 多取一些，非结果块会被后续过滤
  }
  return blocks
}
