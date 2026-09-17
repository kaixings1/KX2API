/**
 * diff — KX2API 适配版
 *
 * 从 doge-desktop src/utils/diff.ts 移植。原实现依赖 npm 包 `diff`，
 * 但该包并未在 package.json 声明（也无 node_modules 实体），
 * 属移植漏装的悬空依赖（TS2307）。此处改为**零依赖内置实现**，
 * 保持原有三个导出的签名与语义不变，能力不缩水。
 *
 * 提供 diff 补丁调整、行数统计、unified diff 生成等核心能力。
 */

/** unified diff 的上下文行数 */
export const CONTEXT_LINES = 3
export const DIFF_TIMEOUT_MS = 5_000

/**
 * 单个 hunk（与 npm `diff` 包的 StructuredPatchHunk 形状兼容）
 */
export interface StructuredPatchHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  /** 每行带前缀：' ' 上下文、'-' 删除、'+' 新增 */
  lines: string[]
}

/** 内部：LCS 动态规划表，用于求最长公共子序列 */
function buildLcsTable(a: string[], b: string[]): ArrayLike<number>[] {
  const n = a.length
  const m = b.length
  // (n+1) x (m+1)；用 Int32Array 降低大文件的内存与时间开销
  const table: Int32Array[] = new Array(n + 1)
  for (let i = 0; i <= n; i++) table[i] = new Int32Array(m + 1)

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  return table
}

type Op = { type: ' ' | '-' | '+'; line: string }

/** 内部：把两段文本逐行对比成操作序列 */
function diffLines(oldText: string, newText: string): Op[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const table = buildLcsTable(a, b)

  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: ' ', line: a[i] })
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ type: '-', line: a[i] })
      i++
    } else {
      ops.push({ type: '+', line: b[j] })
      j++
    }
  }
  while (i < a.length) ops.push({ type: '-', line: a[i++] })
  while (j < b.length) ops.push({ type: '+', line: b[j++] })
  return ops
}

/** 内部：把操作序列按 context 行数切分成 hunk */
function groupIntoHunks(ops: Op[], context: number): StructuredPatchHunk[] {
  const hunks: StructuredPatchHunk[] = []

  // 找出需要展示的区间：所有变更行前后各扩 context 行
  let idx = 0
  while (idx < ops.length) {
    if (ops[idx].type === ' ') {
      idx++
      continue
    }

    let start = Math.max(0, idx - context)
    let end = idx
    // 向后扩展：直到变更簇后连续超过 2*context 行上下文为止
    let gap = 0
    let k = idx
    while (k < ops.length) {
      if (ops[k].type === ' ') {
        gap++
        if (gap > context * 2) break
      } else {
        gap = 0
        end = k
      }
      k++
    }
    const stop = Math.min(ops.length, Math.max(end + 1 + context, idx + 1))

    const slice = ops.slice(start, stop)
    let oldStart = 1
    for (let t = 0; t < start; t++) if (ops[t].type !== '+') oldStart++
    let newStart = 1
    for (let t = 0; t < start; t++) if (ops[t].type !== '-') newStart++

    hunks.push({
      oldStart,
      oldLines: slice.filter(o => o.type !== '+').length,
      newStart,
      newLines: slice.filter(o => o.type !== '-').length,
      lines: slice.map(o => o.type + o.line),
    })

    idx = stop
  }

  return hunks
}

/**
 * 生成 structured patch（对齐 npm `diff` 包 structuredPatch 的返回形状）
 */
export function structuredPatch(
  oldFilename: string,
  newFilename: string,
  oldText: string,
  newText: string,
  _oldHeader?: string,
  _newHeader?: string,
  options?: { context?: number },
): StructuredPatchHunk[] {
  const context = options?.context ?? CONTEXT_LINES
  const ops = diffLines(oldText, newText)
  const hunks = groupIntoHunks(ops, context)

  // 文件名信息保留在 hunk 上（hunk 本身不携带，故挂到非枚举属性，
  // 避免污染 structuredPatch 的既有形状）
  Object.defineProperty(hunks, '__filenames', {
    value: { oldFilename, newFilename },
    enumerable: false,
  })

  return hunks
}

/**
 * 偏移 hunk 行号（用于切片场景）
 */
export function adjustHunkLineNumbers(
  hunks: StructuredPatchHunk[],
  offset: number,
): StructuredPatchHunk[] {
  if (offset === 0) return hunks
  return hunks.map(h => ({
    ...h,
    oldStart: h.oldStart + offset,
    newStart: h.newStart + offset,
  }))
}

/**
 * 计算补丁变更行数
 */
export function countLinesChanged(
  patch: StructuredPatchHunk[],
  newFileContent?: string,
): { added: number; removed: number } {
  let added = 0
  let removed = 0

  for (const hunk of patch) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        added++
      } else if (line.startsWith('-')) {
        removed++
      }
    }
  }

  // 对于新文件，额外计算总行数
  if (newFileContent) {
    added += newFileContent.split('\n').length
  }

  return { added, removed }
}

/** 内部：单个 hunk 的 unified diff 文本 */
function hunkToText(hunk: StructuredPatchHunk): string {
  const header =
    `@@ -${hunk.oldStart},${hunk.oldLines} ` +
    `+${hunk.newStart},${hunk.newLines} @@\n`
  return header + hunk.lines.map(l => l + '\n').join('')
}

/**
 * 生成 unified diff
 *
 * 注意：原实现取 `hunk.text` —— npm `diff` 包的 StructuredPatchHunk
 * 并没有 `text` 字段（只有 oldStart/oldLines/newStart/newLines/lines），
 * 因此原写法恒得到空字符串。这里由 lines 自行拼出正确文本。
 */
export function generateUnifiedDiff(
  oldText: string,
  newText: string,
  oldFilename = 'original',
  newFilename = 'modified',
): string {
  const patch = structuredPatch(
    oldFilename,
    newFilename,
    oldText,
    newText,
    '',
    '',
    { context: CONTEXT_LINES },
  )
  if (patch.length === 0) return ''
  const head =
    `--- ${oldFilename}\n` +
    `+++ ${newFilename}\n`
  return head + patch.map(hunkToText).join('')
}
