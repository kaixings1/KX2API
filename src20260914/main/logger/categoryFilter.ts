/**
 * Pure category + level filter functions for LogManager.
 * No Electron dependency — safe to import in Node.js test environment.
 */

// ---------------------------------------------------------------------------
// Types (defined locally to avoid shared/types import resolution issues)
// ---------------------------------------------------------------------------
export type LogCategory =
  | 'app' | 'proxy' | 'engine' | 'oauth' | 'cookie' | 'ipc'
  | 'api' | 'forward' | 'tool' | 'session' | 'config' | 'ui' | 'general'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface CategoryConfig {
  level: LogLevel
  enabled: boolean
}

export interface CategoryFilterResult<T> {
  passed: T | null
  reason?: 'disabled' | 'level'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_LOG_CATEGORIES: Record<string, CategoryConfig> = {
  app:     { level: 'info',  enabled: true },
  proxy:   { level: 'info',  enabled: true },
  engine:  { level: 'info',  enabled: true },
  oauth:   { level: 'info',  enabled: true },
  cookie:  { level: 'debug', enabled: true },
  ipc:     { level: 'info',  enabled: true },
  api:     { level: 'info',  enabled: true },
  forward: { level: 'info',  enabled: true },
  tool:    { level: 'info',  enabled: true },
  session: { level: 'info',  enabled: true },
  config:  { level: 'info',  enabled: true },
  ui:      { level: 'warn',  enabled: true },
  general: { level: 'info',  enabled: true },
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

// ---------------------------------------------------------------------------
// Core filter function
// ---------------------------------------------------------------------------

/**
 * Returns whether a log at `level` for `category` should be emitted
 * given the `configs` map.
 *
 * - If the category is disabled or missing → { passed: null, reason: 'disabled' }
 * - If the level is below the threshold → { passed: null, reason: 'level' }
 * - Otherwise → { passed: true }
 */
export function shouldLog(
  category: string,
  level: LogLevel,
  configs: Record<string, CategoryConfig>,
): CategoryFilterResult<boolean> {
  const config = configs[category]
  if (!config || !config.enabled) {
    return { passed: null, reason: 'disabled' }
  }
  if (LEVEL_ORDER[level] < LEVEL_ORDER[config.level]) {
    return { passed: null, reason: 'level' }
  }
  return { passed: true }
}

/**
 * Filters an array of log entries, keeping only those that pass
 * the category config rules.
 */
export function filterLogsByCategory<T extends { category: string; level: LogLevel }>(
  entries: T[],
  configs: Record<string, CategoryConfig>,
): T[] {
  return entries.filter(entry => {
    const result = shouldLog(entry.category, entry.level, configs)
    return result.passed !== null
  })
}

/**
 * Merges partial overrides into a full category config object.
 */
export function mergeCategoryConfigs(
  overrides: Record<string, CategoryConfig> = {},
): Record<string, CategoryConfig> {
  return { ...DEFAULT_LOG_CATEGORIES, ...overrides }
}

/**
 * Returns true if every category in `configs` is disabled.
 */
export function isAllCategoriesDisabled(configs: Record<string, CategoryConfig>): boolean {
  return Object.values(configs).every(c => !c.enabled)
}

/**
 * Returns a new configs object with the given category toggled.
 */
export function setCategoryEnabled(
  configs: Record<string, CategoryConfig>,
  category: string,
  enabled: boolean,
): Record<string, CategoryConfig> {
  const existing = configs[category] || { level: 'info', enabled: true }
  return { ...configs, [category]: { ...existing, enabled } }
}

/**
 * Returns a new configs object with the given category's level changed.
 */
export function setCategoryLevel(
  configs: Record<string, CategoryConfig>,
  category: string,
  level: LogLevel,
): Record<string, CategoryConfig> {
  const existing = configs[category] || { enabled: true }
  return { ...configs, [category]: { ...existing, level } }
}
