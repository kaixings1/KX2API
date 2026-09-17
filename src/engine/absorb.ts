/**
 * engine/absorb.ts — 吸收式文本压缩
 *
 * 移植自 D:\src\utils\absorb.ts（上游 760 行，零外部依赖）。
 * 用途：同一段内容在上下文里重复出现时（重复的工具定义、同一文件被读两次、
 * 模型重复输出的模板片段），只保留一份，省下的是每轮都要付的 token 成本。
 *
 * 三段处理，逐段作用于上一步的输出：
 *   Pass 1 行级吸收   —— 相邻完全相同的行，保留 1 份
 *   Pass 2 连续块吸收 —— 以空行分块，相邻完全相同的块保留 1 份
 *   Pass 3 结构化去重 —— 代码围栏/XML/JSON/段落各自成块，块间去重
 *
 * ─────────────────────────────────────────────────────────────
 * 移植时修复的上游 4 个缺陷（都是会造成**内容丢失**的）
 * ─────────────────────────────────────────────────────────────
 *
 * ① 缓存写入早于相似判定
 *    上游在相似度比较**之前**就 `cache.set(fingerprint, text)`。于是被判为
 *    「相似重复」而丢弃的块，其指纹已经进了持久缓存；下一次调用遇到它的孪生块时，
 *    精确匹配立即命中 → 该块被删除。若这段恰好是唯一内容，函数返回**空字符串**。
 *    修复：先完成「保留/丢弃」判定，只缓存**最终保留**的块。
 *
 * ② 重建文本用 `join('\n\n')` 丢格式
 *    上游把保留的段落用双换行重新拼接。而空行本身不产生段落，因此原文的
 *    空行信息在重建时全部丢失、段间被统一塞入一个空行 —— Markdown 列表被拆散、
 *    表格被破坏、缩进层级错乱。
 *    修复：每个段落记录在原文中的 [start, end) 偏移，重建时按偏移取原文切片，
 *    只跳过被丢弃段落的那一段，其余字节原样保留。
 *
 * ③ Pass 顺序导致前一步成果被覆盖
 *    上游 `compressWithStats` 里：Pass 2 从 Pass 1 的输出提取 segments，
 *    Pass 3 修改 result，Pass 4 却拿 **Pass 2 的旧 segments** 重建并覆盖 result
 *    —— Pass 3 的成果被完全丢弃（`dedupSegments` 的 `originalText` 形参从未被使用）。
 *    修复：三段严格串行，每段都作用于上一段的输出。
 *
 * ④ 缺长度闸
 *    上游只有无状态的 `absorbText` 有 `MAX_INPUT_LENGTH` 保护，`SessionCompressor`
 *    路径没有 —— 超大文本会全量跑完所有 pass（相似度比较是 O(n·m) 级）。
 *    修复：所有入口统一在开头做长度闸，超限直接原样返回。
 *
 * 另加**安全兜底**：任何 pass 之后若结果变空而输入非空，则回退到上一步结果。
 * 压缩是优化，永远不该以"内容消失"为代价。
 */

// ─────────────────────────────── 类型 ───────────────────────────────

export interface AbsorbOptions {
  /** 连续块最小重复次数（>=2 才触发），默认 2 */
  minRepeat: number
  /** 连续行最小重复次数，默认 3 */
  minRepeatLines: number
  /** 参与去重的最小字符数，默认 30 —— 太短的块（`}`, `);`）删了会破坏语法 */
  minBlockSize: number
  /** 相似度阈值 0~1，超过视为重复，默认 0.88 */
  similarityThreshold: number
  /** 行级吸收，默认 true */
  lines: boolean
  /** 连续块吸收，默认 true */
  consecutive: boolean
  /** 结构化去重（单次内），默认 true */
  structural: boolean
  /** 输入字符数上限，超过直接跳过，默认 500_000 */
  maxInputLength: number
  /** 相似度比较的次数上限，防 O(n²)，默认 200 */
  maxSimilarityComparisons: number
}

export const DEFAULT_ABSORB_OPTIONS: AbsorbOptions = {
  minRepeat: 2,
  minRepeatLines: 3,
  minBlockSize: 30,
  similarityThreshold: 0.88,
  lines: true,
  consecutive: true,
  structural: true,
  maxInputLength: 500_000,
  maxSimilarityComparisons: 200,
}

export interface AbsorbStats {
  /** 行级吸收掉的条数 */
  lines: number
  /** 连续块吸收掉的块数 */
  consecutive: number
  /** 结构化去重掉的块数 */
  structural: number
  /** 跨调用去重命中的块数（仅在启用 session 时有值） */
  crossCall: number
}

export interface AbsorbResult {
  text: string
  originalSize: number
  compressedSize: number
  saved: number
  /** 压缩率 0~1 */
  ratio: number
  /** 是否被跳过（超长输入） */
  skipped: boolean
  stats: AbsorbStats
}

/**
 * 跨调用去重状态。
 *
 * ⚠️ 这个能力有内容丢失风险：它按"这段内容此前出现过"直接删除，
 * 不区分"重复的模板"与"用户又贴了一遍同样的东西"。因此**默认不启用**，
 * 必须由调用方显式传入并在意这个语义。键用归一化文本本身而非哈希 ——
 * 哈希碰撞会导致静默删错块，而这类错误极难排查。
 */
export interface AbsorbSession {
  seen: Map<string, string>
  /** 会话级缓存条目上限 */
  maxEntries: number
}

export function createAbsorbSession(maxEntries = 2000): AbsorbSession {
  return { seen: new Map(), maxEntries }
}

// ─────────────────────────────── 文本原语 ───────────────────────────────

/** 归一化用于「比较」：折行、去空白、压空行 */
function normalize(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
}

/** 用于查重的归一化：更激进，去掉所有空白只留内容字符 */
function normForCompare(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

// ─────────────────────────────── 相似度 ───────────────────────────────

/** 超过此长度不做相似度比较（O(n·m) 不可接受） */
const SIM_MAX_LEN = 50_000

/**
 * 快速相似度。
 * - 短文本（<=300 字符）走精确 LCS —— 能抓住"同一段代码改了一行"
 * - 长文本走 16 点等距采样 + 5-gram Jaccard —— 全量 LCS 在万字符级是 O(10^8)
 *
 * 代价：长文本的采样点一旦错位（前面插了一段），后续窗口全部偏移，
 * 相似度会骤降。这是刻意的取舍 —— 宁可漏判，不可卡死。
 */
function quickSim(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  if (a.length > SIM_MAX_LEN || b.length > SIM_MAX_LEN) return 0

  if (a.length <= 300 && b.length <= 300) return lcsSim(a, b)

  const samples = 16
  const segLen = Math.min(200, Math.floor(a.length / samples), Math.floor(b.length / samples))
  if (segLen <= 0) return 0

  let score = 0
  for (let i = 0; i < samples; i++) {
    const pA = Math.floor((a.length / samples) * i)
    const pB = Math.floor((b.length / samples) * i)
    score += jaccardShingles(a.substring(pA, pA + segLen), b.substring(pB, pB + segLen), 5)
  }
  return score / samples
}

/** 最长公共子序列的 Dice 归一化（一维数组模拟，省内存） */
function lcsSim(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0 || n === 0) return 0
  const rows = m + 1

  let prev = new Uint16Array(rows)
  let curr = new Uint16Array(rows)

  for (let i = 1; i <= n; i++) {
    for (let j = 0; j < rows; j++) {
      if (j === 0) {
        curr[0] = 0
        continue
      }
      if (b[i - 1] === a[j - 1]) curr[j] = prev[j - 1] + 1
      else curr[j] = Math.max(prev[j], curr[j - 1])
    }
    ;[prev, curr] = [curr, prev]
  }
  return (2 * prev[m]) / (m + n)
}

/** k-gram 的 Dice 系数 */
function jaccardShingles(a: string, b: string, k: number): number {
  if (a.length < k || b.length < k) return a === b ? 1 : 0
  const setA = new Set<string>()
  const setB = new Set<string>()
  for (let i = 0; i <= a.length - k; i++) setA.add(a.substring(i, i + k))
  for (let i = 0; i <= b.length - k; i++) setB.add(b.substring(i, i + k))
  let inter = 0
  for (const s of setA) if (setB.has(s)) inter++
  const total = setA.size + setB.size
  return total === 0 ? 0 : (2 * inter) / total
}

// ─────────────────────────────── 结构化分段 ───────────────────────────────

export type SegmentType = 'codeblock' | 'xml' | 'json' | 'paragraph'

export interface Segment {
  type: SegmentType
  text: string
  /** 在原文中的起始偏移（含） */
  start: number
  /** 在原文中的结束偏移（不含） */
  end: number
  normalized: string
}

/** 预计算每行在原文中的起始偏移（\n 计 1 个字符） */
function lineOffsets(text: string): number[] {
  const offsets: number[] = []
  let off = 0
  for (const line of text.split('\n')) {
    offsets.push(off)
    off += line.length + 1
  }
  return offsets
}

/** 单次结构化扫描的最大行数，防病态输入 */
const MAX_BLOCK_SCAN_LINES = 200

/**
 * 提取结构化段落，并记录每段在原文中的偏移。
 *
 * 偏移是修复「重建丢格式」的关键 —— 有了它就能按原文切片重建，
 * 而不是把段落重新拼接（后者会丢掉空行与段间空白）。
 */
export function extractSegments(text: string): Segment[] {
  const segments: Segment[] = []
  const lines = text.split('\n')
  const offsets = lineOffsets(text)
  let i = 0

  const push = (type: SegmentType, startLine: number, endLineExclusive: number) => {
    const start = offsets[startLine]
    const lastLine = endLineExclusive - 1
    const end = offsets[lastLine] + lines[lastLine].length
    const slice = text.slice(start, end)
    segments.push({ type, text: slice, start, end, normalized: normForCompare(slice) })
  }

  while (i < lines.length) {
    const line = lines[i]

    // 1) 代码围栏：``` 或 ~~~ 开头，找同前缀的结束行
    const fence = line.match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      const mark = fence[1]
      const markChar = mark[0]
      const minLen = mark.length
      let end = i + 1
      while (end < lines.length && end - i <= MAX_BLOCK_SCAN_LINES) {
        const m = lines[end].match(/^\s*(`{3,}|~{3,})\s*$/)
        if (m && m[1][0] === markChar && m[1].length >= minLen) break
        end++
      }
      push('codeblock', i, Math.min(end + 1, lines.length))
      i = end + 1
      continue
    }

    // 2) XML 元素：<tag ...> ... </tag>
    const xmlOpen = line.match(/^\s*<([A-Za-z_][\w:.-]*)\b[^>]*>/)
    if (xmlOpen) {
      const closeTag = `</${xmlOpen[1]}>`
      let end = i + 1
      while (end < lines.length && end - i <= MAX_BLOCK_SCAN_LINES) {
        if (lines[end].includes(closeTag)) break
        end++
      }
      if (end < lines.length) {
        push('xml', i, end + 1)
        i = end + 1
        continue
      }
      // 找不到闭合标签 → 当普通段落处理
    }

    // 3) JSON / 对象块：以 { 或 [ 开头，统计括号配平
    const trimmed = line.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      let depth = 0
      let began = false
      let end = i
      while (end < lines.length && end - i <= MAX_BLOCK_SCAN_LINES) {
        const t = lines[end]
        if (!began && t.trim().length > 0) began = true
        if (began) {
          depth += (t.match(/[[{]/g) || []).length - (t.match(/[\]}]/g) || []).length
          if (depth <= 0 && end > i) break
        }
        end++
      }
      if (end < lines.length && depth <= 0) {
        push('json', i, end + 1)
        i = end + 1
        continue
      }
    }

    // 4) 普通段落：连续非空行
    let end = i
    while (end < lines.length && lines[end].trim() !== '') end++
    if (end > i) {
      push('paragraph', i, end)
      i = end
    } else {
      i++
    }
  }

  return segments
}

// ─────────────────────────────── Pass 1：行级 ───────────────────────────────

/**
 * 相邻完全相同的行保留 1 份。
 *
 * 注意保留份数语义：`minRepeatLines = 3` 表示「3 行相同才动手，且只留 1 行」。
 * 上游此处是 off-by-one（留 2 删 1），与 Pass 2 的「只留 1 份」不一致 ——
 * 这里统一为「只留 1 份」，并对齐语义。
 */
function absorbConsecutiveLines(
  text: string,
  minRepeat: number,
  stats: AbsorbStats,
): string {
  const lines = text.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const cur = lines[i]
    let j = i + 1
    // 空行不参与吸收：连续空行是格式的一部分
    if (cur.trim() !== '') {
      while (j < lines.length && lines[j] === cur) j++
    }
    const run = j - i
    if (cur.trim() !== '' && run >= minRepeat) {
      out.push(cur)
      stats.lines += run - 1
    } else {
      for (let k = i; k < j; k++) out.push(lines[k])
    }
    i = j
  }
  return out.join('\n')
}

// ─────────────────────────────── Pass 2：连续块 ───────────────────────────────

interface Block {
  text: string
  start: number
  end: number
}

/** 以「一个及以上空行」为界切块，同时记录每块在原文中的偏移 */
function splitBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.split('\n')
  const offsets = lineOffsets(text)
  let i = 0
  while (i < lines.length) {
    // 跳过空行
    if (lines[i].trim() === '') {
      i++
      continue
    }
    let j = i
    while (j < lines.length && lines[j].trim() !== '') j++
    const lastLine = j - 1
    blocks.push({
      text: text.slice(offsets[i], offsets[lastLine] + lines[lastLine].length),
      start: offsets[i],
      end: offsets[lastLine] + lines[lastLine].length,
    })
    i = j
  }
  return blocks
}

/**
 * 相邻完全相同的块保留 1 份。
 *
 * 重建时按原文偏移切片（不重新 join），因此块之间的空行、缩进全部原样保留 ——
 * 这正是上游 `join('\n\n')` 丢掉的信息。
 */
function absorbConsecutiveBlocks(
  text: string,
  minRepeat: number,
  stats: AbsorbStats,
): string {
  const blocks = splitBlocks(text)
  if (blocks.length <= 1) return text

  const out: string[] = []
  let cursor = 0
  let i = 0
  while (i < blocks.length) {
    const norm = normForCompare(blocks[i].text)
    let j = i + 1
    while (j < blocks.length && normForCompare(blocks[j].text) === norm) j++
    const run = j - i

    if (run >= minRepeat) {
      // 保留第一块：连同它之前的间隙（含空行）一起原样带出，
      // 然后跳到最后一块的末尾 —— 中间那几份重复内容整体丢弃。
      out.push(text.slice(cursor, blocks[i].end))
      cursor = blocks[j - 1].end
      stats.consecutive += run - 1
    }
    i = j
  }
  // 尾部剩余内容
  out.push(text.slice(cursor))
  return out.join('')
}

// ─────────────────────────────── Pass 3：结构化去重 ───────────────────────────────

/**
 * 块级去重。
 *
 * 修复点：
 * - **只缓存最终保留的块**（上游先缓存后判定，导致被丢弃块的指纹污染缓存，
 *   下次调用遇到其孪生块时会误删）
 * - **按原文偏移重建**，不重新拼接（保留全部格式）
 * - 若全部块都被删除导致结果为空 → 回退保留原文（压缩不应导致内容消失）
 */
function dedupSegments(
  text: string,
  opts: AbsorbOptions,
  session: AbsorbSession | null,
  stats: AbsorbStats,
): string {
  const segments = extractSegments(text)
  if (segments.length <= 1) return text

  const minSize = opts.minBlockSize
  const threshold = opts.similarityThreshold
  /** normalized → 首次出现的块（用于相似度比较） */
  const seenNorm = new Map<string, string>()
  /** 本次已保留的归一化文本（精确去重） */
  const keptNorm = new Set<string>()
  const dropped = new Set<Segment>()

  for (const seg of segments) {
    // 太短的块不参与去重：`}`, `);`, `  },` 这类删掉必然破坏语法
    if (seg.text.length < minSize) continue

    // 跨调用命中：此前已经出现过（仅在显式启用 session 时生效）
    if (session && session.seen.has(seg.normalized)) {
      dropped.add(seg)
      stats.crossCall++
      continue
    }

    // 本次内精确重复
    if (keptNorm.has(seg.normalized)) {
      dropped.add(seg)
      stats.structural++
      continue
    }

    // 相似度判定（只对较大的块做）
    let similar = false
    if (seg.text.length >= minSize * 3) {
      let comparisons = 0
      for (const [norm] of seenNorm) {
        if (++comparisons > opts.maxSimilarityComparisons) break
        if (quickSim(seg.normalized, norm) >= threshold) {
          similar = true
          break
        }
      }
    }

    if (similar) {
      dropped.add(seg)
      stats.structural++
      continue
    }

    // ✅ 到这里才确认「保留」—— 此时才写入缓存与索引（修复点 ①）
    keptNorm.add(seg.normalized)
    if (seg.text.length >= minSize * 3) seenNorm.set(seg.normalized, seg.text)
    if (session) {
      if (session.seen.size >= session.maxEntries) {
        const oldest = session.seen.keys().next()
        if (!oldest.done) session.seen.delete(oldest.value)
      }
      session.seen.set(seg.normalized, seg.text)
    }
  }

  if (dropped.size === 0) return text

  // 按原文偏移重建：只跳过被丢弃段的 [start, end)，其余字节原样保留（修复点 ②）
  const out: string[] = []
  let cursor = 0
  for (const seg of segments) {
    if (dropped.has(seg)) {
      out.push(text.slice(cursor, seg.start))
      cursor = seg.end
    }
  }
  out.push(text.slice(cursor))
  const result = out.join('')

  // 安全兜底：整体被删空时不接受这个结果
  if (!result.trim()) return text
  return result
}

// ─────────────────────────────── 主入口 ───────────────────────────────

function emptyStats(): AbsorbStats {
  return { lines: 0, consecutive: 0, structural: 0, crossCall: 0 }
}

/**
 * 压缩文本。
 *
 * 三段严格串行，每段作用于上一段的输出（修复点 ③：上游会让 Pass 3 的成果
 * 被 Pass 4 用旧数据覆盖）。
 *
 * @param session 传入时会启用跨调用去重；不传则去重只在本次调用内生效（推荐）
 */
export function absorb(
  text: string,
  options: Partial<AbsorbOptions> = {},
  session: AbsorbSession | null = null,
): AbsorbResult {
  const opts: AbsorbOptions = { ...DEFAULT_ABSORB_OPTIONS, ...options }
  const originalSize = text.length

  // 长度闸：超大文本直接跳过（修复点 ④）
  if (text.length > opts.maxInputLength) {
    return {
      text,
      originalSize,
      compressedSize: originalSize,
      saved: 0,
      ratio: 0,
      skipped: true,
      stats: emptyStats(),
    }
  }

  // 空输入不是「跳过」，是没什么可压 —— 两者语义不同，分开处理
  if (originalSize === 0) {
    return {
      text,
      originalSize: 0,
      compressedSize: 0,
      saved: 0,
      ratio: 0,
      skipped: false,
      stats: emptyStats(),
    }
  }

  const stats = emptyStats()
  let result = text

  // Pass 1
  if (opts.lines) {
    const next = absorbConsecutiveLines(result, opts.minRepeatLines, stats)
    if (next.trim()) result = next
  }

  // Pass 2
  if (opts.consecutive) {
    const next = absorbConsecutiveBlocks(result, opts.minRepeat, stats)
    if (next.trim()) result = next
  }

  // Pass 3（作用于 Pass 2 的输出，不是 Pass 1 的 —— 修复点 ③）
  if (opts.structural || session) {
    const next = dedupSegments(result, opts, session, stats)
    if (next.trim()) result = next
  }

  // 最终兜底：任何情况下都不允许把非空输入压成空
  if (!result.trim() && text.trim()) result = text

  const compressedSize = result.length
  const saved = originalSize - compressedSize
  return {
    text: result,
    originalSize,
    compressedSize,
    saved,
    ratio: originalSize > 0 ? saved / originalSize : 0,
    skipped: false,
    stats,
  }
}

/** 只要压缩后的文本 */
export function absorbText(text: string, options: Partial<AbsorbOptions> = {}): string {
  return absorb(text, options).text
}

/**
 * 便捷判断：压缩是否值得（省下的比例超过阈值才用压缩结果）。
 *
 * 压缩本身有 CPU 成本，且可能改变格式；只有收益明显时才替换原文。
 */
export function absorbIfWorthwhile(
  text: string,
  minSavingRatio = 0.1,
  options: Partial<AbsorbOptions> = {},
): string {
  const r = absorb(text, options)
  if (r.skipped) return text
  return r.ratio >= minSavingRatio ? r.text : text
}
