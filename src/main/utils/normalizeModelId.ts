/**
 * Normalize model ID strings to canonical form.
 *
 * Handles common variations:
 *   "claude-sonnet-4-6"          -> "claude-sonnet-4-6"
 *   "anthropic/claude-sonnet-4-6" -> "claude-sonnet-4-6"
 *   "claude_sonnet_4_6"          -> "claude-sonnet-4-6"
 *   "claude sonnet 4.6"          -> "claude-sonnet-4-6"
 */

export function normalizeClaudeModelId(modelId: string | void): string {
  const normalized = (modelId || '').trim().toLowerCase()
  const unprefixed = normalized.startsWith('anthropic/')
    ? normalized.slice('anthropic/'.length)
    : normalized
  return unprefixed.replace(/[._\s]+/g, '-')
}

/**
 * 归一化模型 ID：去空白、转小写、去掉供应商前缀、分隔符统一为 `-`。
 * 例："anthropic/claude-sonnet-4-6" → "claude-sonnet-4-6"
 *     "claude_sonnet 4.6" → "claude-sonnet-4-6"
 *
 * 注意：以前这个函数只做小写/替换，**不去前缀**，与模块文档和单测不一致，
 * 导致 isSameModel('anthropic/x', 'x') 错误地返回 false。
 */
export function normalizeModelId(modelId: string | void): string {
  const normalized = (modelId || '').trim().toLowerCase()
  const unprefixed = normalized.startsWith('anthropic/')
    ? normalized.slice('anthropic/'.length)
    : normalized
  return unprefixed.replace(/[._\s]+/g, '-')
}

export function isSameModel(a: string | void, b: string | void): boolean {
  return normalizeModelId(a) === normalizeModelId(b)
}
