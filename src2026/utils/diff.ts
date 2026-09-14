/**
 * diff — KX2API 适配版
 *
 * 从 doge-desktop src/utils/diff.ts 精简移植
 * 提供 diff 补丁调整、行数统计等核心能力（移除对外部服务的依赖）
 */

import { type StructuredPatchHunk, structuredPatch } from 'diff'

export const CONTEXT_LINES = 3
export const DIFF_TIMEOUT_MS = 5_000

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

/**
 * 生成 unified diff
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
  return patch.map(hunk => hunk.text).join('')
}
