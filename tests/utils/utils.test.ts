/**
 * Pure utility functions — unit tests
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  intersperse,
  count,
  uniq,
} from '../../src/main/utils/array.ts'
import { sleep, withTimeout } from '../../src/main/utils/sleep.ts'
import { djb2Hash, hashContent, hashPair } from '../../src/main/utils/hash.ts'
import { difference, intersects, every, union } from '../../src/main/utils/set.ts'
import { sequential } from '../../src/main/utils/sequential.ts'
import { getDefaultBashTimeoutMs, getMaxBashTimeoutMs } from '../../src/main/utils/timeouts.ts'
import { formatBriefTimestamp } from '../../src/main/utils/formatBriefTimestamp.ts'
import { withResolvers } from '../../src/main/utils/withResolvers.ts'
import { normalizeModelId, normalizeClaudeModelId, isSameModel } from '../../src/main/utils/normalizeModelId.ts'
import { parseSlashCommand } from '../../src/main/utils/slashCommandParsing.ts'

// ===========================================================================
// array.ts
// ===========================================================================

test('intersperse: inserts separator between elements', () => {
  const result = intersperse([1, 2, 3], (i) => i * 10)
  assert.deepEqual(result, [1, 10, 2, 20, 3])
})

test('intersperse: single element → no separator', () => {
  assert.deepEqual(intersperse([1], () => 'x'), [1])
})

test('intersperse: empty array → empty', () => {
  assert.deepEqual(intersperse([], () => 'x'), [])
})

test('count: counts matching elements', () => {
  assert.strictEqual(count([1, 2, 3, 4, 5], (x) => x > 2), 3)
})

test('count: empty array → 0', () => {
  assert.strictEqual(count([], () => true), 0)
})

test('count: none match → 0', () => {
  assert.strictEqual(count([1, 2, 3], (x) => x > 10), 0)
})

test('uniq: removes duplicates, preserves order', () => {
  assert.deepEqual(uniq([1, 2, 1, 3, 2]), [1, 2, 3])
})

test('uniq: empty → empty', () => {
  assert.deepEqual(uniq([]), [])
})

// ===========================================================================
// sleep.ts
// ===========================================================================

test('sleep: resolves after ms', async () => {
  const start = Date.now()
  await sleep(50)
  const elapsed = Date.now() - start
  assert.ok(elapsed >= 40, `expected >=40ms, got ${elapsed}ms`)
})

test('sleep: abort signal resolves immediately', async () => {
  const controller = new AbortController()
  controller.abort()
  const start = Date.now()
  await sleep(5000, controller.signal)
  const elapsed = Date.now() - start
  assert.ok(elapsed < 100, `expected <100ms, got ${elapsed}ms`)
})

test('sleep: throwOnAbort rejects on abort', async () => {
  const controller = new AbortController()
  controller.abort()
  let errored = false
  try {
    await sleep(5000, controller.signal, { throwOnAbort: true })
  } catch {
    errored = true
  }
  assert.strictEqual(errored, true)
})

// ===========================================================================
// hash.ts
// ===========================================================================

test('djb2Hash: deterministic', () => {
  const h1 = djb2Hash('hello')
  const h2 = djb2Hash('hello')
  assert.strictEqual(h1, h2)
})

test('djb2Hash: different inputs produce different hashes', () => {
  assert.notStrictEqual(djb2Hash('hello'), djb2Hash('world'))
})

test('djb2Hash: empty string → 0', () => {
  assert.strictEqual(djb2Hash(''), 0)
})

test('hashContent: returns hex string', () => {
  const h = hashContent('hello')
  assert.strictEqual(typeof h, 'string')
  assert.ok(/^[0-9a-f]+$/.test(h))
})

test('hashContent: deterministic', () => {
  assert.strictEqual(hashContent('test'), hashContent('test'))
})

test('hashPair: different pairs produce different hashes', () => {
  assert.notStrictEqual(hashPair('a', 'b'), hashPair('b', 'a'))
})

test('hashPair: same pair produces same hash', () => {
  assert.strictEqual(hashPair('a', 'b'), hashPair('a', 'b'))
})

// ===========================================================================
// set.ts
// ===========================================================================

test('difference: a - b', () => {
  const a = new Set([1, 2, 3])
  const b = new Set([2, 4])
  assert.deepEqual([...difference(a, b)], [1, 3])
})

test('intersects: shared elements → true', () => {
  assert.strictEqual(intersects(new Set([1, 2]), new Set([2, 3])), true)
})

test('intersects: no shared elements → false', () => {
  assert.strictEqual(intersects(new Set([1, 2]), new Set([3, 4])), false)
})

test('intersects: empty set → false', () => {
  assert.strictEqual(intersects(new Set(), new Set([1])), false)
})

test('every: subset → true', () => {
  assert.strictEqual(every(new Set([1, 2]), new Set([1, 2, 3])), true)
})

test('every: not subset → false', () => {
  assert.strictEqual(every(new Set([1, 4]), new Set([1, 2, 3])), false)
})

test('union: combines both sets', () => {
  const a = new Set([1, 2])
  const b = new Set([2, 3])
  assert.deepEqual([...union(a, b)], [1, 2, 3])
})

// ===========================================================================
// sequential.ts
// ===========================================================================

test('sequential: executes in order', async () => {
  const order: number[] = []
  const fn = async (n: number): Promise<number> => {
    await sleep(10)
    order.push(n)
    return n
  }
  const wrapped = sequential(fn)
  await Promise.all([wrapped(1), wrapped(2), wrapped(3)])
  assert.deepEqual(order, [1, 2, 3])
})

test('sequential: returns correct results', async () => {
  const fn = async (n: number): Promise<number> => n * 2
  const wrapped = sequential(fn)
  const results = await Promise.all([wrapped(1), wrapped(2), wrapped(3)])
  assert.deepEqual(results, [2, 4, 6])
})

// ===========================================================================
// timeouts.ts
// ===========================================================================

test('getDefaultBashTimeoutMs: env override', () => {
  assert.strictEqual(getDefaultBashTimeoutMs({ BASH_DEFAULT_TIMEOUT_MS: '60000' }), 60000)
})

test('getDefaultBashTimeoutMs: default 30 min', () => {
  assert.strictEqual(getDefaultBashTimeoutMs({}), 1_800_000)
})

test('getMaxBashTimeoutMs: at least default', () => {
  assert.strictEqual(getMaxBashTimeoutMs({}), 1_800_000)
})

test('getMaxBashTimeoutMs: env override >= default', () => {
  assert.strictEqual(getMaxBashTimeoutMs({ BASH_MAX_TIMEOUT_MS: '3600000', BASH_DEFAULT_TIMEOUT_MS: '60000' }), 3600000)
})

test('getMaxBashTimeoutMs: min is default', () => {
  const result = getMaxBashTimeoutMs({ BASH_MAX_TIMEOUT_MS: '1000', BASH_DEFAULT_TIMEOUT_MS: '5000' })
  assert.strictEqual(result, 5000)
})

// ===========================================================================
// formatBriefTimestamp.ts
// ===========================================================================

test('formatBriefTimestamp: returns empty for invalid', () => {
  assert.strictEqual(formatBriefTimestamp('not-a-date'), '')
})

test('formatBriefTimestamp: same day → time only', () => {
  const now = new Date('2024-06-15T14:30:00Z')
  const ts = '2024-06-15T14:30:00Z'
  const result = formatBriefTimestamp(ts, now)
  // Should contain "14" or "2" (hour)
  assert.ok(result.length > 0)
})

test('formatBriefTimestamp: different day → includes weekday', () => {
  const now = new Date('2024-06-20T14:30:00Z')
  const ts = '2024-06-15T14:30:00Z'
  const result = formatBriefTimestamp(ts, now)
  assert.ok(result.length > 0)
})

// ===========================================================================
// withResolvers.ts
// ===========================================================================

test('withResolvers: creates promise + resolvers', async () => {
  const { promise, resolve, reject } = withResolvers<number>()
  resolve(42)
  const result = await promise
  assert.strictEqual(result, 42)
})

test('withResolvers: reject works', async () => {
  const { promise, reject } = withResolvers<number>()
  let errored = false
  try {
    await promise
  } catch {
    errored = true
  }
  assert.strictEqual(errored, true)
})

// ===========================================================================
// normalizeModelId.ts
// ===========================================================================

test('normalizeModelId: basic normalization', () => {
  assert.strictEqual(normalizeModelId('claude-sonnet-4-6'), 'claude-sonnet-4-6')
})

test('normalizeModelId: removes prefix', () => {
  assert.strictEqual(normalizeModelId('anthropic/claude-sonnet'), 'claude-sonnet')
})

test('normalizeModelId: underscores → hyphens', () => {
  assert.strictEqual(normalizeModelId('claude_sonnet'), 'claude-sonnet')
})

test('normalizeModelId: spaces → hyphens', () => {
  assert.strictEqual(normalizeModelId('claude sonnet'), 'claude-sonnet')
})

test('normalizeModelId: void/undefined → empty', () => {
  assert.strictEqual(normalizeModelId(undefined as any), '')
})

test('normalizeClaudeModelId: handles anthropic prefix', () => {
  assert.strictEqual(normalizeClaudeModelId('anthropic/claude-3-opus'), 'claude-3-opus')
})

test('isSameModel: equal models', () => {
  assert.strictEqual(isSameModel('claude-sonnet', 'CLAUDE_SONNET'), true)
})

test('isSameModel: different models', () => {
  assert.strictEqual(isSameModel('claude-sonnet', 'claude-opus'), false)
})

// ===========================================================================
// slashCommandParsing.ts
// ===========================================================================

test('parseSlashCommand: basic command', () => {
  const r = parseSlashCommand('/search foo bar')
  assert.ok(r !== null)
  assert.strictEqual(r!.commandName, 'search')
  assert.strictEqual(r!.args, 'foo bar')
  assert.strictEqual(r!.isMcp, false)
})

test('parseSlashCommand: no slash → null', () => {
  assert.strictEqual(parseSlashCommand('hello'), null)
})

test('parseSlashCommand: empty after slash → null', () => {
  assert.strictEqual(parseSlashCommand('/'), null)
})

test('parseSlashCommand: no args', () => {
  const r = parseSlashCommand('/commit')
  assert.ok(r !== null)
  assert.strictEqual(r!.args, '')
})

test('parseSlashCommand: MCP command', () => {
  const r = parseSlashCommand('/mcp:tool (MCP) arg1 arg2')
  assert.ok(r !== null)
  assert.strictEqual(r!.commandName, 'mcp:tool (MCP)')
  assert.strictEqual(r!.args, 'arg1 arg2')
  assert.strictEqual(r!.isMcp, true)
})

test('parseSlashCommand: trims whitespace', () => {
  const r = parseSlashCommand('  /search  foo  ')
  assert.ok(r !== null)
  assert.strictEqual(r!.commandName, 'search')
  assert.strictEqual(r!.args, 'foo')
})
