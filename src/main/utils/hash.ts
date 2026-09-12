/**
 * Hashing utilities
 */

import * as crypto from 'crypto'

/**
 * djb2 string hash — fast non-cryptographic hash returning a signed 32-bit int.
 * Deterministic across runtimes. Use as a fallback when Bun.hash isn't available,
 * or when you need on-disk-stable output (e.g. cache directory names).
 */
export function djb2Hash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

/**
 * Hash content for change detection. Uses SHA-256 for cross-runtime stability.
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Hash two strings without allocating a concatenated temp string.
 * Uses SHA-256 with a null separator to disambiguate pairs.
 */
export function hashPair(a: string, b: string): string {
  return crypto
    .createHash('sha256')
    .update(a)
    .update('\0')
    .update(b)
    .digest('hex')
}
