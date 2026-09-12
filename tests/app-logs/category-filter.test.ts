/**
 * categoryFilter.ts — pure function unit tests
 *
 * Tests the category + level filter logic that powers LogManager's
 * per-category logging.  Zero Electron dependency.
 *
 * Coverage:
 *   A. shouldLog()             — enable/disable + level threshold + missing key
 *   B. filterLogsByCategory()  — array-level filtering
 *   C. mergeCategoryConfigs()  — default merge + partial overrides
 *   D. isAllCategoriesDisabled()
 *   E. setCategoryEnabled()    — toggle + unknown category creation
 *   F. setCategoryLevel()      — change level + unknown category creation
 *   G. DEFAULT_LOG_CATEGORIES integrity
 *   H. Boundary: empty configs, all disabled, all debug, missing keys
 *   I. Combined realistic scenario
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  shouldLog,
  filterLogsByCategory,
  mergeCategoryConfigs,
  isAllCategoriesDisabled,
  setCategoryEnabled,
  setCategoryLevel,
  DEFAULT_LOG_CATEGORIES,
} from '../../src/main/logger/categoryFilter.ts'

// ---------------------------------------------------------------------------
// Types (mirroring shared/types — no electron, no path-alias import)
// ---------------------------------------------------------------------------
type LogCategory =
  | 'app' | 'proxy' | 'engine' | 'oauth' | 'cookie' | 'ipc'
  | 'api' | 'forward' | 'tool' | 'session' | 'config' | 'ui' | 'general'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const ALL_CATEGORIES: LogCategory[] = [
  'app', 'proxy', 'engine', 'oauth', 'cookie', 'ipc',
  'api', 'forward', 'tool', 'session', 'config', 'ui', 'general',
]

// ===========================================================================
// A. shouldLog()
// ===========================================================================

test('shouldLog: enabled + sufficient level → passes', () => {
  const r = shouldLog('app', 'warn', { app: { level: 'info', enabled: true } })
  assert.ok(r.passed !== null)
  assert.strictEqual(r.reason, undefined)
})

test('shouldLog: disabled category → blocked (reason: disabled)', () => {
  const r = shouldLog('proxy', 'info', { proxy: { level: 'info', enabled: false } })
  assert.strictEqual(r.passed, null)
  assert.strictEqual(r.reason, 'disabled')
})

test('shouldLog: level too low → blocked (reason: level)', () => {
  const r = shouldLog('cookie', 'debug', { cookie: { level: 'info', enabled: true } })
  assert.strictEqual(r.passed, null)
  assert.strictEqual(r.reason, 'level')
})

test('shouldLog: missing category key → blocked (disabled)', () => {
  const r = shouldLog('nonexistent', 'info', {})
  assert.strictEqual(r.passed, null)
  assert.strictEqual(r.reason, 'disabled')
})

// Level threshold matrix
test('shouldLog: threshold=info allows info/warn/error, blocks debug', () => {
  const c = { x: { level: 'info' as LogLevel, enabled: true } }
  assert.strictEqual(shouldLog('x', 'debug', c).passed, null)
  assert.ok(shouldLog('x', 'info', c).passed !== null)
  assert.ok(shouldLog('x', 'warn', c).passed !== null)
  assert.ok(shouldLog('x', 'error', c).passed !== null)
})

test('shouldLog: threshold=warn allows warn/error, blocks debug/info', () => {
  const c = { x: { level: 'warn' as LogLevel, enabled: true } }
  assert.strictEqual(shouldLog('x', 'debug', c).passed, null)
  assert.strictEqual(shouldLog('x', 'info', c).passed, null)
  assert.ok(shouldLog('x', 'warn', c).passed !== null)
  assert.ok(shouldLog('x', 'error', c).passed !== null)
})

test('shouldLog: threshold=error allows error only', () => {
  const c = { x: { level: 'error' as LogLevel, enabled: true } }
  assert.strictEqual(shouldLog('x', 'debug', c).passed, null)
  assert.strictEqual(shouldLog('x', 'info', c).passed, null)
  assert.strictEqual(shouldLog('x', 'warn', c).passed, null)
  assert.ok(shouldLog('x', 'error', c).passed !== null)
})

test('shouldLog: threshold=debug allows all levels', () => {
  const c = { x: { level: 'debug' as LogLevel, enabled: true } }
  assert.ok(shouldLog('x', 'debug', c).passed !== null)
  assert.ok(shouldLog('x', 'info', c).passed !== null)
  assert.ok(shouldLog('x', 'warn', c).passed !== null)
  assert.ok(shouldLog('x', 'error', c).passed !== null)
})

test('shouldLog: disabled takes precedence over permissive level', () => {
  const r = shouldLog('x', 'error', { x: { level: 'debug', enabled: false } })
  assert.strictEqual(r.passed, null)
  assert.strictEqual(r.reason, 'disabled')
})

// ===========================================================================
// B. filterLogsByCategory()
// ===========================================================================

test('filterLogsByCategory: keeps enabled+sufficient-level entries', () => {
  const entries = [
    { category: 'app', level: 'info' as LogLevel },
    { category: 'proxy', level: 'warn' as LogLevel },
    { category: 'cookie', level: 'debug' as LogLevel },
  ]
  const configs = {
    app: { level: 'info', enabled: true },
    proxy: { level: 'info', enabled: true },
    cookie: { level: 'info', enabled: true },
  }
  const filtered = filterLogsByCategory(entries, configs)
  assert.strictEqual(filtered.length, 2)
  assert.ok(filtered.every(e => e.category !== 'cookie'))
})

test('filterLogsByCategory: empty input → empty output', () => {
  assert.deepEqual(filterLogsByCategory([], {}), [])
})

test('filterLogsByCategory: all disabled → empty', () => {
  const entries = [
    { category: 'app', level: 'info' as LogLevel },
    { category: 'proxy', level: 'warn' as LogLevel },
  ]
  const configs = {
    app: { level: 'info', enabled: false },
    proxy: { level: 'info', enabled: false },
  }
  assert.strictEqual(filterLogsByCategory(entries, configs).length, 0)
})

test('filterLogsByCategory: unknown category in entries is dropped', () => {
  const entries = [
    { category: 'known', level: 'info' as LogLevel },
    { category: 'unknown', level: 'info' as LogLevel },
  ]
  const configs = { known: { level: 'info', enabled: true } }
  const filtered = filterLogsByCategory(entries, configs)
  assert.strictEqual(filtered.length, 1)
  assert.strictEqual(filtered[0].category, 'known')
})

test('filterLogsByCategory: preserves original entry objects', () => {
  const entries = [
    { category: 'app', level: 'info' as LogLevel, msg: 'hello' },
  ]
  const configs = { app: { level: 'info', enabled: true } }
  const filtered = filterLogsByCategory(entries, configs)
  assert.strictEqual(filtered[0].msg, 'hello')
})

test('filterLogsByCategory: preserves input order', () => {
  const entries = [
    { category: 'app', level: 'info' as LogLevel },
    { category: 'proxy', level: 'info' as LogLevel },
    { category: 'engine', level: 'info' as LogLevel },
  ]
  const configs = {
    app: { level: 'info', enabled: true },
    proxy: { level: 'info', enabled: true },
    engine: { level: 'info', enabled: true },
  }
  const filtered = filterLogsByCategory(entries, configs)
  assert.deepEqual(filtered.map(e => e.category), ['app', 'proxy', 'engine'])
})

// ===========================================================================
// C. mergeCategoryConfigs()
// ===========================================================================

test('mergeCategoryConfigs: no overrides → full defaults', () => {
  const merged = mergeCategoryConfigs()
  assert.strictEqual(Object.keys(merged).length, 13)
  assert.strictEqual(merged['app'].level, 'info')
  assert.strictEqual(merged['cookie'].level, 'debug')
})

test('mergeCategoryConfigs: partial overrides replace matching keys', () => {
  const merged = mergeCategoryConfigs({
    app: { level: 'error', enabled: false },
    cookie: { level: 'warn', enabled: true },
  })
  assert.strictEqual(merged['app'].level, 'error')
  assert.strictEqual(merged['app'].enabled, false)
  assert.strictEqual(merged['cookie'].level, 'warn')
  assert.strictEqual(merged['proxy'].level, 'info') // unchanged
})

test('mergeCategoryConfigs: undefined overrides safe', () => {
  const merged = mergeCategoryConfigs(undefined)
  assert.strictEqual(Object.keys(merged).length, 13)
})

test('mergeCategoryConfigs: empty overrides object safe', () => {
  const merged = mergeCategoryConfigs({})
  assert.strictEqual(Object.keys(merged).length, 13)
})

// ===========================================================================
// D. isAllCategoriesDisabled()
// ===========================================================================

test('isAllCategoriesDisabled: true when all disabled', () => {
  const configs: Record<string, { level: string; enabled: boolean }> = {}
  for (const cat of ALL_CATEGORIES) configs[cat] = { level: 'info', enabled: false }
  assert.strictEqual(isAllCategoriesDisabled(configs), true)
})

test('isAllCategoriesDisabled: false when at least one enabled', () => {
  const configs: Record<string, { level: string; enabled: boolean }> = {}
  for (const cat of ALL_CATEGORIES) configs[cat] = { level: 'info', enabled: false }
  configs['app'].enabled = true
  assert.strictEqual(isAllCategoriesDisabled(configs), false)
})

test('isAllCategoriesDisabled: empty object → true (vacuous truth)', () => {
  assert.strictEqual(isAllCategoriesDisabled({}), true)
})

test('isAllCategoriesDisabled: single disabled → true', () => {
  assert.strictEqual(isAllCategoriesDisabled({ x: { level: 'info', enabled: false } }), true)
})

// ===========================================================================
// E. setCategoryEnabled()
// ===========================================================================

test('setCategoryEnabled: disables an enabled category', () => {
  const configs = { app: { level: 'info', enabled: true } }
  const updated = setCategoryEnabled(configs, 'app', false)
  assert.strictEqual(updated['app'].enabled, false)
  assert.strictEqual(configs['app'].enabled, true) // original unchanged
})

test('setCategoryEnabled: enables a disabled category, preserves level', () => {
  const configs = { proxy: { level: 'warn', enabled: false } }
  const updated = setCategoryEnabled(configs, 'proxy', true)
  assert.strictEqual(updated['proxy'].enabled, true)
  assert.strictEqual(updated['proxy'].level, 'warn')
})

test('setCategoryEnabled: creates entry for unknown category with default level', () => {
  const configs: Record<string, { level: string; enabled: boolean }> = {}
  const updated = setCategoryEnabled(configs, 'newcat', true)
  assert.ok('newcat' in updated)
  assert.strictEqual(updated['newcat'].enabled, true)
  assert.strictEqual(updated['newcat'].level, 'info')
})

// ===========================================================================
// F. setCategoryLevel()
// ===========================================================================

test('setCategoryLevel: updates level for existing category', () => {
  const configs = { app: { level: 'info', enabled: true } }
  const updated = setCategoryLevel(configs, 'app', 'error')
  assert.strictEqual(updated['app'].level, 'error')
  assert.strictEqual(updated['app'].enabled, true)
  assert.strictEqual(configs['app'].level, 'info') // original unchanged
})

test('setCategoryLevel: creates entry for unknown category with default enabled', () => {
  const configs: Record<string, { level: string; enabled: boolean }> = {}
  const updated = setCategoryLevel(configs, 'newcat', 'debug')
  assert.ok('newcat' in updated)
  assert.strictEqual(updated['newcat'].level, 'debug')
  assert.strictEqual(updated['newcat'].enabled, true)
})

// ===========================================================================
// G. DEFAULT_LOG_CATEGORIES integrity
// ===========================================================================

test('DEFAULT_LOG_CATEGORIES has exactly 13 entries', () => {
  assert.strictEqual(Object.keys(DEFAULT_LOG_CATEGORIES).length, 13)
})

test('DEFAULT_LOG_CATEGORIES: all 13 known categories present', () => {
  for (const cat of ALL_CATEGORIES) {
    assert.ok(cat in DEFAULT_LOG_CATEGORIES, `missing category: ${cat}`)
  }
})

test('DEFAULT_LOG_CATEGORIES: no unexpected keys', () => {
  for (const key of Object.keys(DEFAULT_LOG_CATEGORIES)) {
    assert.ok(ALL_CATEGORIES.includes(key as LogCategory), `unexpected: ${key}`)
  }
})

test('DEFAULT_LOG_CATEGORIES: all levels are valid LogLevel values', () => {
  const valid: LogLevel[] = ['debug', 'info', 'warn', 'error']
  for (const [cat, cfg] of Object.entries(DEFAULT_LOG_CATEGORIES)) {
    assert.ok(valid.includes(cfg.level), `invalid level for ${cat}: ${cfg.level}`)
  }
})

test('DEFAULT_LOG_CATEGORIES: all enabled=true', () => {
  for (const [cat, cfg] of Object.entries(DEFAULT_LOG_CATEGORIES)) {
    assert.strictEqual(cfg.enabled, true, `${cat} should be enabled`)
  }
})

test('DEFAULT_LOG_CATEGORIES: cookie=debug, ui=warn, others=info', () => {
  assert.strictEqual(DEFAULT_LOG_CATEGORIES['cookie'].level, 'debug')
  assert.strictEqual(DEFAULT_LOG_CATEGORIES['ui'].level, 'warn')
  for (const cat of ALL_CATEGORIES) {
    if (cat !== 'cookie' && cat !== 'ui') {
      assert.strictEqual(DEFAULT_LOG_CATEGORIES[cat].level, 'info', `${cat} default`)
    }
  }
})

// ===========================================================================
// H. Boundary edge cases
// ===========================================================================

test('shouldLog: all 13 categories pass at default configs for info', () => {
  for (const cat of ALL_CATEGORIES) {
    const cfg = DEFAULT_LOG_CATEGORIES[cat]
    const r = shouldLog(cat, 'info', DEFAULT_LOG_CATEGORIES)
    if (cfg.enabled && (cfg.level === 'debug' || cfg.level === 'info')) {
      assert.ok(r.passed !== null, `${cat} should allow info at level ${cfg.level}`)
    }
  }
})

test('shouldLog: cookie at warn threshold blocks info/debug', () => {
  const configs = { cookie: { level: 'warn' as LogLevel, enabled: true } }
  assert.strictEqual(shouldLog('cookie', 'debug', configs).passed, null)
  assert.strictEqual(shouldLog('cookie', 'info', configs).passed, null)
  assert.ok(shouldLog('cookie', 'warn', configs).passed !== null)
})

test('filterLogsByCategory: large mixed batch (50 entries)', () => {
  const entries = Array.from({ length: 50 }, (_, i) => ({
    category: ALL_CATEGORIES[i % 13],
    level: ['debug', 'info', 'warn', 'error'][i % 4] as LogLevel,
  }))
  const configs = { ...DEFAULT_LOG_CATEGORIES }
  ;(configs as Record<string, { level: string; enabled: boolean }>)['cookie'].level = 'warn'
  ;(configs as Record<string, { level: string; enabled: boolean }>)['ui'].enabled = false

  const filtered = filterLogsByCategory(entries, configs)
  // cookie entries at debug/info should be dropped; ui entries all dropped
  assert.ok(filtered.length < 50)
  assert.ok(filtered.every(e => e.category !== 'ui'))
  assert.ok(filtered.every(e => !(e.category === 'cookie' && (e.level === 'debug' || e.level === 'info'))))
})

test('isAllCategoriesDisabled: single category enabled → false', () => {
  const configs: Record<string, { level: string; enabled: boolean }> = { only: { level: 'info', enabled: true } }
  assert.strictEqual(isAllCategoriesDisabled(configs), false)
})

// ===========================================================================
// I. Combined realistic scenario
// ===========================================================================

test('combined: multi-category stream with mixed levels and thresholds', () => {
  const configs = {
    app: { level: 'info', enabled: true },
    proxy: { level: 'warn', enabled: true },
    cookie: { level: 'debug', enabled: true },
    ui: { level: 'warn', enabled: true },
  }

  const entries = [
    { category: 'app', level: 'debug' as LogLevel },   // blocked (app=info)
    { category: 'app', level: 'info' as LogLevel },     // passes
    { category: 'app', level: 'warn' as LogLevel },     // passes
    { category: 'proxy', level: 'info' as LogLevel },   // blocked (proxy=warn)
    { category: 'proxy', level: 'warn' as LogLevel },   // passes
    { category: 'cookie', level: 'debug' as LogLevel },  // passes (cookie=debug)
    { category: 'cookie', level: 'info' as LogLevel },   // passes
    { category: 'ui', level: 'info' as LogLevel },       // blocked (ui=warn)
    { category: 'ui', level: 'warn' as LogLevel },       // passes
  ]

  const filtered = filterLogsByCategory(entries, configs)
  assert.strictEqual(filtered.length, 6)

  const counts: Record<string, number> = {}
  for (const e of filtered) counts[e.category] = (counts[e.category] || 0) + 1
  assert.strictEqual(counts['app'], 2)
  assert.strictEqual(counts['proxy'], 1)
  assert.strictEqual(counts['cookie'], 2)
  assert.strictEqual(counts['ui'], 1)
})

test('combined: disable + threshold together drops all logs', () => {
  const configs = { engine: { level: 'debug', enabled: false } }
  const entries = [
    { category: 'engine', level: 'debug' as LogLevel },
    { category: 'engine', level: 'error' as LogLevel },
  ]
  assert.strictEqual(filterLogsByCategory(entries, configs).length, 0)
})

test('combined: setCategoryEnabled + setCategoryLevel pipeline', () => {
  let configs = { ...DEFAULT_LOG_CATEGORIES }
  configs = setCategoryEnabled(configs, 'oauth', false)
  configs = setCategoryLevel(configs, 'cookie', 'warn')
  configs = setCategoryEnabled(configs, 'cookie', true)

  assert.strictEqual(configs['oauth'].enabled, false)
  assert.strictEqual(configs['cookie'].level, 'warn')
  assert.strictEqual(configs['cookie'].enabled, true)

  // Verify filter behavior
  assert.strictEqual(shouldLog('oauth', 'error', configs).passed, null)
  assert.strictEqual(shouldLog('cookie', 'info', configs).passed, null) // blocked by warn threshold
  assert.ok(shouldLog('cookie', 'warn', configs).passed !== null)
})
