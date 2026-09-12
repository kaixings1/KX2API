/**
 * LogManager category filtering — unit tests
 *
 * Tests the pure category-filter logic extracted into categoryFilter.ts,
 * covering:
 *   - shouldLog: enable/disable + level threshold
 *   - filterLogsByCategory: array-level filtering
 *   - mergeCategoryConfigs: default merge behavior
 *   - isAllCategoriesDisabled
 *   - setCategoryEnabled / setCategoryLevel
 *   - Boundary conditions: all disabled, all debug, empty configs, etc.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  shouldLog,
  filterLogsByCategory,
  mergeCategoryConfigs,
  isAllCategoriesDisabled,
  setCategoryEnabled,
  setCategoryLevel,
  DEFAULT_LOG_CATEGORIES,
} from '../../src/main/logger/categoryFilter.ts'

import { LogManager } from '../../src/main/logger/manager.ts'

// ---------------------------------------------------------------------------
// Types (mirroring shared/types — no electron import needed)
// ---------------------------------------------------------------------------
type LogCategory =
  | 'app' | 'proxy' | 'engine' | 'oauth' | 'cookie' | 'ipc'
  | 'api' | 'forward' | 'tool' | 'session' | 'config' | 'ui' | 'general'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const ALL_CATEGORIES: LogCategory[] = [
  'app', 'proxy', 'engine', 'oauth', 'cookie', 'ipc',
  'api', 'forward', 'tool', 'session', 'config', 'ui', 'general',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), 'log-cat-test-'))
}

function destroyRoot(root: string): void {
  rmSync(root, { recursive: true, force: true })
}

function makeManager(logFile: string): LogManager {
  const mgr = new LogManager()
  ;(mgr as unknown as Record<string, unknown>).logFile = logFile
  ;(mgr as unknown as Record<string, unknown>).logs = []
  return mgr
}

function log(mgr: LogManager, msg: string, level: LogLevel = 'info', cat: LogCategory = 'general') {
  return mgr.log(level, msg, { category: cat })
}

// ===========================================================================
// A. shouldLog() — unit tests
// ===========================================================================

test('shouldLog: enabled category at matching level passes', () => {
  const result = shouldLog('app', 'warn', { app: { level: 'info', enabled: true } })
  assert.ok(result.passed !== null)
  assert.strictEqual(result.reason, undefined)
})

test('shouldLog: disabled category is blocked', () => {
  const result = shouldLog('proxy', 'info', { proxy: { level: 'info', enabled: false } })
  assert.strictEqual(result.passed, null)
  assert.strictEqual(result.reason, 'disabled')
})

test('shouldLog: debug blocked when threshold is info', () => {
  const result = shouldLog('cookie', 'debug', { cookie: { level: 'info', enabled: true } })
  assert.strictEqual(result.passed, null)
  assert.strictEqual(result.reason, 'level')
})

test('shouldLog: info blocked when threshold is warn', () => {
  const result = shouldLog('engine', 'info', { engine: { level: 'warn', enabled: true } })
  assert.strictEqual(result.passed, null)
  assert.strictEqual(result.reason, 'level')
})

test('shouldLog: missing category defaults to blocked', () => {
  const result = shouldLog('nonexistent', 'info', {})
  assert.strictEqual(result.passed, null)
  assert.strictEqual(result.reason, 'disabled')
})

test('shouldLog: level threshold matrix — info(1) allows info/warn/error', () => {
  const configs = { x: { level: 'info' as LogLevel, enabled: true } }
  assert.strictEqual(shouldLog('x', 'debug', configs).passed, null)
  assert.ok(shouldLog('x', 'info', configs).passed !== null)
  assert.ok(shouldLog('x', 'warn', configs).passed !== null)
  assert.ok(shouldLog('x', 'error', configs).passed !== null)
})

test('shouldLog: level threshold matrix — warn(2) allows warn/error only', () => {
  const configs = { x: { level: 'warn' as LogLevel, enabled: true } }
  assert.strictEqual(shouldLog('x', 'debug', configs).passed, null)
  assert.strictEqual(shouldLog('x', 'info', configs).passed, null)
  assert.ok(shouldLog('x', 'warn', configs).passed !== null)
  assert.ok(shouldLog('x', 'error', configs).passed !== null)
})

test('shouldLog: level threshold matrix — error(3) allows error only', () => {
  const configs = { x: { level: 'error' as LogLevel, enabled: true } }
  assert.strictEqual(shouldLog('x', 'debug', configs).passed, null)
  assert.strictEqual(shouldLog('x', 'info', configs).passed, null)
  assert.strictEqual(shouldLog('x', 'warn', configs).passed, null)
  assert.ok(shouldLog('x', 'error', configs).passed !== null)
})

test('shouldLog: debug threshold allows all levels', () => {
  const configs = { x: { level: 'debug' as LogLevel, enabled: true } }
  assert.ok(shouldLog('x', 'debug', configs).passed !== null)
  assert.ok(shouldLog('x', 'info', configs).passed !== null)
  assert.ok(shouldLog('x', 'warn', configs).passed !== null)
  assert.ok(shouldLog('x', 'error', configs).passed !== null)
})

// ===========================================================================
// B. filterLogsByCategory() — unit tests
// ===========================================================================

test('filterLogsByCategory: keeps entries from enabled categories at sufficient level', () => {
  const entries = [
    { category: 'app', level: 'info' as LogLevel },
    { category: 'proxy', level: 'warn' as LogLevel },
    { category: 'cookie', level: 'debug' as LogLevel },
  ]
  const configs = {
    app: { level: 'info', enabled: true },
    proxy: { level: 'info', enabled: true },
    cookie: { level: 'info', enabled: true }, // debug should be blocked
  }
  const filtered = filterLogsByCategory(entries, configs)
  assert.strictEqual(filtered.length, 2)
  assert.ok(filtered.every(e => e.category !== 'cookie'))
})

test('filterLogsByCategory: empty array returns empty', () => {
  assert.deepEqual(filterLogsByCategory([], {}), [])
})

test('filterLogsByCategory: all disabled returns empty', () => {
  const entries = [
    { category: 'app', level: 'info' as LogLevel },
    { category: 'proxy', level: 'warn' as LogLevel },
  ]
  const configs = { app: { level: 'info', enabled: false }, proxy: { level: 'info', enabled: false } }
  assert.strictEqual(filterLogsByCategory(entries, configs).length, 0)
})

test('filterLogsByCategory: missing category in configs is dropped', () => {
  const entries = [
    { category: 'known', level: 'info' as LogLevel },
    { category: 'unknown', level: 'info' as LogLevel },
  ]
  const configs = { known: { level: 'info', enabled: true } }
  const filtered = filterLogsByCategory(entries, configs)
  assert.strictEqual(filtered.length, 1)
  assert.strictEqual(filtered[0].category, 'known')
})

// ===========================================================================
// C. mergeCategoryConfigs()
// ===========================================================================

test('mergeCategoryConfigs: empty overrides returns full defaults', () => {
  const merged = mergeCategoryConfigs()
  assert.strictEqual(Object.keys(merged).length, 13)
  assert.strictEqual(merged['app'].level, 'info')
  assert.strictEqual(merged['cookie'].level, 'debug')
})

test('mergeCategoryConfigs: partial overrides replace matching keys', () => {
  const merged = mergeCategoryConfigs({ app: { level: 'error', enabled: false }, cookie: { level: 'warn', enabled: true } })
  assert.strictEqual(merged['app'].level, 'error')
  assert.strictEqual(merged['app'].enabled, false)
  assert.strictEqual(merged['cookie'].level, 'warn')
  // Unchanged keys keep defaults
  assert.strictEqual(merged['proxy'].level, 'info')
  assert.strictEqual(merged['proxy'].enabled, true)
})

test('mergeCategoryConfigs: undefined overrides is safe', () => {
  const merged = mergeCategoryConfigs(undefined)
  assert.strictEqual(Object.keys(merged).length, 13)
})

// ===========================================================================
// D. isAllCategoriesDisabled()
// ===========================================================================

test('isAllCategoriesDisabled: returns true when all disabled', () => {
  const configs: Record<string, { level: string; enabled: boolean }> = {}
  for (const cat of ALL_CATEGORIES) {
    configs[cat] = { level: 'info', enabled: false }
  }
  assert.strictEqual(isAllCategoriesDisabled(configs), true)
})

test('isAllCategoriesDisabled: returns false when at least one enabled', () => {
  const configs: Record<string, { level: string; enabled: boolean }> = {}
  for (const cat of ALL_CATEGORIES) {
    configs[cat] = { level: 'info', enabled: false }
  }
  configs['app'].enabled = true
  assert.strictEqual(isAllCategoriesDisabled(configs), false)
})

test('isAllCategoriesDisabled: returns true for empty configs', () => {
  // Every() on empty array returns true (vacuous truth)
  assert.strictEqual(isAllCategoriesDisabled({}), true)
})

// ===========================================================================
// E. setCategoryEnabled()
// ===========================================================================

test('setCategoryEnabled: disables an enabled category', () => {
  const configs = { app: { level: 'info', enabled: true } }
  const updated = setCategoryEnabled(configs, 'app', false)
  assert.strictEqual(updated['app'].enabled, false)
  // Original unchanged (immutable)
  assert.strictEqual(configs['app'].enabled, true)
})

test('setCategoryEnabled: enables a disabled category', () => {
  const configs = { proxy: { level: 'warn', enabled: false } }
  const updated = setCategoryEnabled(configs, 'proxy', true)
  assert.strictEqual(updated['proxy'].enabled, true)
  // Level preserved
  assert.strictEqual(updated['proxy'].level, 'warn')
})

test('setCategoryEnabled: creates new entry for unknown category', () => {
  const configs = {}
  const updated = setCategoryEnabled(configs, 'newcat', true)
  assert.ok('newcat' in updated)
  assert.strictEqual(updated['newcat'].enabled, true)
  assert.strictEqual(updated['newcat'].level, 'info') // default level
})

// ===========================================================================
// F. setCategoryLevel()
// ===========================================================================

test('setCategoryLevel: updates level for existing category', () => {
  const configs = { app: { level: 'info', enabled: true } }
  const updated = setCategoryLevel(configs, 'app', 'error')
  assert.strictEqual(updated['app'].level, 'error')
  // enabled preserved
  assert.strictEqual(updated['app'].enabled, true)
  // Original unchanged
  assert.strictEqual(configs['app'].level, 'info')
})

test('setCategoryLevel: creates new entry for unknown category', () => {
  const configs: Record<string, { level: string; enabled: boolean }> = {}
  const updated = setCategoryLevel(configs, 'newcat', 'debug')
  assert.ok('newcat' in updated)
  assert.strictEqual(updated['newcat'].level, 'debug')
  assert.strictEqual(updated['newcat'].enabled, true) // default enabled
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

test('DEFAULT_LOG_CATEGORIES: no unexpected categories', () => {
  const keys = Object.keys(DEFAULT_LOG_CATEGORIES)
  for (const key of keys) {
    assert.ok(ALL_CATEGORIES.includes(key as LogCategory), `unexpected category: ${key}`)
  }
})

test('DEFAULT_LOG_CATEGORIES: all levels are valid LogLevel values', () => {
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  for (const [cat, config] of Object.entries(DEFAULT_LOG_CATEGORIES)) {
    assert.ok(validLevels.includes(config.level), `invalid level for ${cat}: ${config.level}`)
  }
})

test('DEFAULT_LOG_CATEGORIES: all enabled flags are true', () => {
  for (const [cat, config] of Object.entries(DEFAULT_LOG_CATEGORIES)) {
    assert.strictEqual(config.enabled, true, `${cat} should be enabled by default`)
  }
})

// ===========================================================================
// H. LogManager integration — category filter (electron-free via log() mock)
// ===========================================================================

test('LogManager.getCategoryConfigs returns defaults on fresh instance', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()

  const configs = mgr.getCategoryConfigs()
  assert.strictEqual(Object.keys(configs).length, 13)
  assert.strictEqual(configs['cookie'].level, 'debug')
  assert.strictEqual(configs['ui'].level, 'warn')
})

test('LogManager: disabled category blocks logs', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()
  mgr.setCategoryConfigs({ proxy: { level: 'info', enabled: false } })

  assert.strictEqual(log(mgr, 'drop', 'info', 'proxy'), null)
  assert.strictEqual(mgr.getLogs().length, 0)
})

test('LogManager: level threshold blocks lower-priority logs', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()
  mgr.setCategoryConfigs({ cookie: { level: 'info', enabled: true } })

  assert.strictEqual(log(mgr, 'verbose', 'debug', 'cookie'), null)
  assert.ok(log(mgr, 'normal', 'info', 'cookie') !== null)
  assert.ok(log(mgr, 'warning', 'warn', 'cookie') !== null)
})

test('LogManager: getLogs filters by category and level', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()

  log(mgr, 'app info', 'info', 'app')
  log(mgr, 'app error', 'error', 'app')
  log(mgr, 'proxy info', 'info', 'proxy')
  log(mgr, 'proxy error', 'error', 'proxy')

  const appLogs = mgr.getLogs({ category: 'app' })
  assert.strictEqual(appLogs.length, 2)

  const errors = mgr.getLogs({ level: 'error' })
  assert.strictEqual(errors.length, 2)

  const appErrors = mgr.getLogs({ category: 'app', level: 'error' })
  assert.strictEqual(appErrors.length, 1)
})

test('LogManager: setCategoryConfigs merges with defaults', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()

  mgr.setCategoryConfigs({ app: { level: 'warn', enabled: false } })

  const configs = mgr.getCategoryConfigs()
  assert.strictEqual(configs['app'].level, 'warn')
  assert.strictEqual(configs['app'].enabled, false)
  // Others keep defaults
  assert.strictEqual(configs['proxy'].level, 'info')
  assert.strictEqual(configs['proxy'].enabled, true)
})

test('LogManager: getStats returns per-category breakdown', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()

  log(mgr, 'app info', 'info', 'app')
  log(mgr, 'app warn', 'warn', 'app')
  log(mgr, 'proxy error', 'error', 'proxy')

  const stats = mgr.getStats()
  assert.strictEqual(stats.total, 3)
  assert.strictEqual(stats.categories['app'].total, 2)
  assert.strictEqual(stats.categories['proxy'].total, 1)
  assert.strictEqual(stats.categories['proxy'].error, 1)
})

test('LogManager: empty state — getLogs, getStats, getTrend all empty', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()

  assert.deepEqual(mgr.getLogs(), [])
  assert.strictEqual(mgr.getStats().total, 0)
  assert.ok(mgr.getTrend(1).every(d => d.total === 0))
})

test('LogManager: maxLogs FIFO eviction', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()
  mgr.setMaxLogs(5)

  for (let i = 0; i < 10; i++) {
    log(mgr, `msg-${i}`, 'info', 'general')
  }

  const logs = mgr.getLogs()
  assert.strictEqual(logs.length, 5)
  const messages = logs.map(l => l.message)
  for (const expected of ['msg-5', 'msg-6', 'msg-7', 'msg-8', 'msg-9']) {
    assert.ok(messages.includes(expected))
  }
})

test('LogManager: all categories disabled → zero logs', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()

  const allOff: Record<string, { level: LogLevel; enabled: boolean }> = {}
  for (const cat of ALL_CATEGORIES) {
    allOff[cat] = { level: 'info', enabled: false }
  }
  mgr.setCategoryConfigs(allOff)

  for (const cat of ['app', 'proxy', 'engine']) {
    log(mgr, `${cat} msg`, 'info', cat)
  }
  assert.strictEqual(mgr.getLogs().length, 0)
  assert.strictEqual(mgr.getStats().total, 0)
})

test('LogManager: exportLogs includes category field', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()

  log(mgr, 'startup', 'info', 'app')

  const jsonExport = mgr.exportLogs('json')
  const parsed = JSON.parse(jsonExport)
  assert.strictEqual(parsed[0].category, 'app')

  const txtExport = mgr.exportLogs('txt')
  assert.ok(txtExport.includes('[app]'))
})

test('LogManager: log entry carries all metadata fields', async (t) => {
  const root = makeRoot()
  t.after(() => destroyRoot(root))

  const mgr = makeManager(join(root, 'app.log'))
  await mgr.initialize()

  const entry = mgr.log('info', 'done', {
    category: 'api',
    subCategory: 'chat',
    accountId: 'a1',
    providerId: 'p1',
    requestId: 'r1',
    data: { model: 'gpt-4' },
  })

  assert.ok(entry !== null)
  assert.strictEqual(entry!.category, 'api')
  assert.strictEqual(entry!.subCategory, 'chat')
  assert.strictEqual(entry!.accountId, 'a1')
  assert.strictEqual(entry!.providerId, 'p1')
  assert.strictEqual(entry!.requestId, 'r1')
  assert.deepEqual(entry!.data, { model: 'gpt-4' })
})
