/**
 * engine/history/references.ts — 历史记录引用解析
 *
 * 吸收自 D:\src\history.ts 的引用解析能力。
 */

/** 引用类型 */
export type ReferenceType = 'file' | 'image' | 'paste' | 'url'

/** 文件范围引用 */
export interface FileReference {
  type: 'file'
  path: string
  startLine?: number
  endLine?: number
}

/** 图片引用 */
export interface ImageReference {
  type: 'image'
  path: string
  base64?: string
}

/** 粘贴文本引用 */
export interface PasteReference {
  type: 'paste'
  index: number
  content?: string
}

/** URL 引用 */
export interface UrlReference {
  type: 'url'
  url: string
}

export type Reference = FileReference | ImageReference | PasteReference | UrlReference

/**
 * 引用格式正则。
 *
 * ⚠️ 必须带 `g` 标志：`parseReferences` 用的是 `String.prototype.matchAll`，
 * 而它在正则缺少 `g` 时会**直接抛 TypeError**（"called with a non-global
 * RegExp argument"）—— 少了 `g` 等于整个解析函数一调用就崩。
 *
 * FILE_REF_RE 用负向先行断言排除特殊前缀（img/paste/url），否则
 * `@([^\s]+)` 的贪婪匹配会把 `@img/a.png` 也解析成一条 file 引用（重复且错误）。
 */
// path 部分必须排除 `:` —— 若用 `[^\s]+` 贪婪匹配，`@a.ts:10-20` 里的
// `:10-20` 会被整段吞进 path（行号永远解析不出来）。路径本身不应含冒号
// （此处是相对路径引用；冒号专用于分隔行号）。
const FILE_REF_RE = /@(?!img\/|paste\b|url\/)([^\s:]+)(?::(\d+)(?:-(\d+))?)?/g
const IMAGE_REF_RE = /@img\/([^\s]+)/g
const PASTE_REF_RE = /@paste(?:\[(\d+)\])?/g
const URL_REF_RE = /@url\/([^\s]+)/g

/**
 * 解析文本中的引用标记。
 *
 * 支持格式：
 * - @/path/to/file:10-20 — 文件范围引用
 * - @img/path/to/image.png — 图片引用
 * - @paste 或 @paste[3] — 粘贴文本引用
 * - @url/https://... — URL 引用
 */
export function parseReferences(text: string): Reference[] {
  const refs: Reference[] = []

  // 文件引用
  for (const m of text.matchAll(FILE_REF_RE)) {
    refs.push({
      type: 'file',
      path: m[1],
      startLine: m[2] ? parseInt(m[2]) : undefined,
      endLine: m[3] ? parseInt(m[3]) : undefined,
    })
  }

  // 图片引用
  for (const m of text.matchAll(IMAGE_REF_RE)) {
    refs.push({ type: 'image', path: m[1] })
  }

  // 粘贴引用
  for (const m of text.matchAll(PASTE_REF_RE)) {
    refs.push({ type: 'paste', index: m[1] ? parseInt(m[1]) : 0 })
  }

  // URL 引用
  for (const m of text.matchAll(URL_REF_RE)) {
    refs.push({ type: 'url', url: m[1] })
  }

  return refs
}

/** 格式化粘贴文本引用 */
export function formatPastedTextRef(index: number): string {
  return `@paste[${index}]`
}

/** 获取粘贴引用对应的行数（由外部填充 content 后计算） */
export function getPastedTextRefNumLines(ref: string): number {
  return ref.split('\n').length
}

/** 展开粘贴文本引用（替换为实际内容） */
export function expandPastedTextRefs(text: string, pastes: Map<number, string>): string {
  return text.replace(/@paste(?:\[(\d+)\])?/g, (_, idx) => {
    const key = idx ? parseInt(idx) : 0
    return pastes.get(key) || `[paste:${key}]`
  })
}

/** 格式化图片引用 */
export function formatImageRef(path: string): string {
  return `@img/${path}`
}
