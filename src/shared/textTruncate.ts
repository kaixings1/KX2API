/**
 * shared/textTruncate.ts — 按显示宽度截断/折行
 *
 * 移植自 D:\src\utils\truncate.ts（上游依赖 ink/stringWidth，此处自实现，
 * 因此零依赖、主进程与渲染层都能用）。
 *
 * 为什么不能按 `str.length` 截断：
 * - 中文/日文/韩文是**双列宽**，按字符数切会让实际显示宽度翻倍
 * - emoji 与代理对（surrogate pair）按 code unit 切会劈出半个字符，显示为乱码
 * - 组合字符（如 e + ́ 变音符）按 code point 切会拆散字形
 *
 * 因此统一按「字素簇（grapheme cluster）」迭代 + 按**显示列宽**计量。
 */

/**
 * 单个码点的显示列宽。
 *
 * 依据 Unicode East Asian Width 的主要区间实现（Node 未内置该属性）。
 * 覆盖：控制字符 0、组合字符 0、CJK/全角 2、emoji 2、其余 1。
 */
export function codePointWidth(cp: number): number {
  // 空字符与 C0 控制字符
  if (cp === 0) return 0
  if (cp < 32) return 0
  // DEL 与 C1 控制字符
  if (cp >= 0x7f && cp < 0xa0) return 0
  // 组合用标记（Combining Diacritical Marks 等）
  if (cp >= 0x0300 && cp <= 0x036f) return 0
  if (cp >= 0x1ab0 && cp <= 0x1aff) return 0
  if (cp >= 0x20d0 && cp <= 0x20ff) return 0
  if (cp >= 0xfe00 && cp <= 0xfe0f) return 0 // 变体选择符
  // 零宽字符
  if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff) return 0
  // 软连字符
  if (cp === 0x00ad) return 0

  // East Asian Wide / Fullwidth
  if (
    (cp >= 0x1100 && cp <= 0x115f) || // 韩文字母
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK 部首、康熙部首、CJK 标点
    (cp >= 0x3041 && cp <= 0x33ff) || // 平假名/片假名/注音/CJK 兼容
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK 扩展 A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK 统一表意
    (cp >= 0xa000 && cp <= 0xa4cf) || // 彝文
    (cp >= 0xa960 && cp <= 0xa97f) || // 韩文字母扩展 A
    (cp >= 0xac00 && cp <= 0xd7a3) || // 韩文音节
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK 兼容表意
    (cp >= 0xfe10 && cp <= 0xfe19) || // 竖排标点
    (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK 兼容形式
    (cp >= 0xff00 && cp <= 0xff60) || // 全角形式
    (cp >= 0xffe0 && cp <= 0xffe6) || // 全角符号
    (cp >= 0x1f300 && cp <= 0x1f64f) || // emoji 主体
    (cp >= 0x1f900 && cp <= 0x1f9ff) || // emoji 补充
    (cp >= 0x1f680 && cp <= 0x1f6ff) || // 交通符号
    (cp >= 0x20000 && cp <= 0x2fffd) || // CJK 扩展 B~
    (cp >= 0x30000 && cp <= 0x3fffd)
  ) {
    return 2
  }
  return 1
}

/** 字符串的显示列宽（非字符数） */
export function stringWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    width += codePointWidth(ch.codePointAt(0)!)
  }
  return width
}

/**
 * 字素簇切分。
 *
 * `Intl.Segmenter` 在所有支持的 Node/Chromium 版本都可用；
 * 环境缺失时降级为按码点切（比按 code unit 安全，只是无法合并组合字符）。
 */
export function segmentGraphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (locale?: string, opts?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter
  if (Seg) {
    try {
      const seg = new Seg(undefined, { granularity: 'grapheme' })
      const out: string[] = []
      for (const s of seg.segment(text)) out.push(s.segment)
      return out
    } catch {
      /* 落到下面的降级实现 */
    }
  }
  return [...text]
}

/** 按列宽截断，尾部加省略号 */
export function truncateToWidth(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) return text
  if (maxWidth <= 1) return '…'
  let width = 0
  let result = ''
  for (const seg of segmentGraphemes(text)) {
    const w = stringWidth(seg)
    // -1 留给省略号
    if (width + w > maxWidth - 1) break
    result += seg
    width += w
  }
  return `${result}…`
}

/** 按列宽从**开头**截断（保留尾部），头部加省略号 */
export function truncateStartToWidth(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) return text
  if (maxWidth <= 1) return '…'
  const segments = segmentGraphemes(text)
  let width = 0
  let startIdx = segments.length
  for (let i = segments.length - 1; i >= 0; i--) {
    const w = stringWidth(segments[i])
    if (width + w > maxWidth - 1) break
    width += w
    startIdx = i
  }
  return `…${segments.slice(startIdx).join('')}`
}

/** 按列宽截断，**不加**省略号（调用方自己加分隔符时用） */
export function truncateToWidthNoEllipsis(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) return text
  if (maxWidth <= 0) return ''
  let width = 0
  let result = ''
  for (const seg of segmentGraphemes(text)) {
    const w = stringWidth(seg)
    if (width + w > maxWidth) break
    result += seg
    width += w
  }
  return result
}

/**
 * 路径**中段**截断：保留目录头与文件名尾，中间用 … 代替。
 *
 * `src/components/deeply/nested/MyComponent.tsx` + 30
 *   → `src/components/…/MyComponent.tsx`
 *
 * 文件名优先于目录 —— 文件名信息量更高，空间不足时先牺牲目录。
 */
export function truncatePathMiddle(path: string, maxWidth: number): string {
  if (stringWidth(path) <= maxWidth) return path
  if (maxWidth <= 0) return '…'
  // 空间太小，退化为普通截断
  if (maxWidth < 5) return truncateToWidth(path, maxWidth)

  // 统一按 / 切分（Windows 路径先归一化，避免 \ 与 / 混用导致取不到文件名）
  const normalized = path.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  const filename = lastSlash >= 0 ? normalized.slice(lastSlash) : normalized
  const directory = lastSlash >= 0 ? normalized.slice(0, lastSlash) : ''
  const filenameWidth = stringWidth(filename)

  // 文件名本身就超宽 → 改为保留尾部（文件名末尾通常更有辨识度）
  if (filenameWidth >= maxWidth - 1) {
    return truncateStartToWidth(normalized, maxWidth)
  }

  const availableForDir = maxWidth - 1 - filenameWidth
  if (availableForDir <= 0) {
    return truncateStartToWidth(filename, maxWidth)
  }
  return truncateToWidthNoEllipsis(directory, availableForDir) + '…' + filename
}

/**
 * 通用截断。
 * @param singleLine true 时同时截断到首个换行（用于单行展示场景）
 */
export function truncate(text: string, maxWidth: number, singleLine = false): string {
  let result = text
  if (singleLine) {
    const firstNewline = text.indexOf('\n')
    if (firstNewline !== -1) {
      result = text.slice(0, firstNewline)
      // 需要给省略号留位
      if (stringWidth(result) + 1 > maxWidth) return truncateToWidth(result, maxWidth)
      return `${result}…`
    }
  }
  if (stringWidth(result) <= maxWidth) return result
  return truncateToWidth(result, maxWidth)
}

/** 按显示宽度折行 */
export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text]
  const lines: string[] = []
  let current = ''
  let currentWidth = 0

  for (const seg of segmentGraphemes(text)) {
    const w = stringWidth(seg)
    if (currentWidth + w <= width) {
      current += seg
      currentWidth += w
    } else {
      if (current) lines.push(current)
      current = seg
      currentWidth = w
    }
  }
  if (current) lines.push(current)
  return lines
}
