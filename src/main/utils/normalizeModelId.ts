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

export function normalizeModelId(modelId: string | void): string {
  return (modelId || '').trim().toLowerCase().replace(/[._\s]+/g, '-')
}

export function isSameModel(a: string | void, b: string | void): boolean {
  return normalizeModelId(a) === normalizeModelId(b)
}
