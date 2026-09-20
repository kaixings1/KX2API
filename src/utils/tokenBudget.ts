/**
 * utils/tokenBudget.ts — 从自然语言解析 token 预算（自 D:\src\utils\tokenBudget.ts 移植）
 *
 * 支持：
 *  - 前缀缩写 "+500k" / "+2M" / "+1.5m"
 *  - 行尾缩写 "预算 +500k"
 *  - 自然语言 "use 2M tokens" / "spend 300k tokens"
 * 纯函数零依赖。
 */

// 前缀写法（锚定开头避免自然语言误判）
const SHORTHAND_START_RE = /^\s*\+(\d+(?:\.\d+)?)\s*(k|m|b)\b/i
// 行尾写法（捕获前导空白，调用方在需要偏移时 +1）
const SHORTHAND_END_RE = /\s\+(\d+(?:\.\d+)?)\s*(k|m|b)\s*[.!?]?\s*$/i
// 自然语言写法
const VERBOSE_RE = /\b(?:use|spend)\s+(\d+(?:\.\d+)?)\s*(k|m|b)\s*tokens?\b/i
const VERBOSE_RE_G = new RegExp(VERBOSE_RE.source, 'gi')

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
}

function parseBudgetMatch(value: string, suffix: string): number {
  return parseFloat(value) * MULTIPLIERS[suffix.toLowerCase()]!
}

/**
 * 从一段文本中解析 token 预算值（绝对 token 数）。
 * 找不到匹配时返回 null。
 * @example parseTokenBudget("预算 +500k") → 500_000
 */
export function parseTokenBudget(text: string): number | null {
  const startMatch = text.match(SHORTHAND_START_RE)
  if (startMatch) return parseBudgetMatch(startMatch[1]!, startMatch[2]!)
  const endMatch = text.match(SHORTHAND_END_RE)
  if (endMatch) return parseBudgetMatch(endMatch[1]!, endMatch[2]!)
  const verboseMatch = text.match(VERBOSE_RE)
  if (verboseMatch) return parseBudgetMatch(verboseMatch[1]!, verboseMatch[2]!)
  return null
}

/**
 * 找出文本中所有预算表达的位置（供高亮/替换用）。
 */
export function findTokenBudgetPositions(
  text: string,
): Array<{ start: number; end: number }> {
  const positions: Array<{ start: number; end: number }> = []
  const startMatch = text.match(SHORTHAND_START_RE)
  if (startMatch) {
    const offset =
      startMatch.index! + startMatch[0].length - startMatch[0].trimStart().length
    positions.push({ start: offset, end: startMatch.index! + startMatch[0].length })
  }
  const endMatch = text.match(SHORTHAND_END_RE)
  if (endMatch) {
    // 避免 "+500k" 纯输入被重复计数
    const endStart = endMatch.index! + 1 // +1：正则包含前导空白
    const alreadyCovered = positions.some(p => endStart >= p.start && endStart < p.end)
    if (!alreadyCovered) {
      positions.push({ start: endStart, end: endMatch.index! + endMatch[0].length })
    }
  }
  for (const match of text.matchAll(VERBOSE_RE_G)) {
    positions.push({ start: match.index, end: match.index + match[0].length })
  }
  return positions
}

/**
 * 生成达到预算阈值时的续作提示消息。
 */
export function getBudgetContinuationMessage(
  pct: number,
  turnTokens: number,
  budget: number,
): string {
  const fmt = (n: number): string => new Intl.NumberFormat('en-US').format(n)
  return `Stopped at ${pct}% of token target (${fmt(turnTokens)} / ${fmt(budget)}). Keep working \u2014 do not summarize.`
}