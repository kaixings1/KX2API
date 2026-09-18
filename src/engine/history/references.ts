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

/** 引用格式正则 */
const FILE_REF_RE = /@([^\s]+)(?::(\d+)(?:-(\d+))?)?/
const IMAGE_REF_RE = /@img\/([^\s]+)/
const PASTE_REF_RE = /@paste(?:\[(\d+)\])?/
const URL_REF_RE = /@url\/([^\s]+)/

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
