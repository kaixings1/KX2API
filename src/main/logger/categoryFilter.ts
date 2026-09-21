/**
 * Pure category + level filter functions for LogManager.
 * No Electron dependency — safe to import in Node.js test environment.
 */

// ---------------------------------------------------------------------------
// Types
//
// 原先这里本地重定义了 LogCategory / LogLevel / CategoryConfig（注释说是为了
// 避开 shared/types 的解析问题），但本文件已经从 shared/types 重导出
// DEFAULT_LOG_CATEGORIES，说明该 import 是可行的。类型再本地写一份就是第三份真相，
// 与 shared/types 的 LogCategoryConfig 结构漂移时编译器也未必报出来。
// ---------------------------------------------------------------------------
import type { LogCategory, LogLevel, LogCategoryConfig } from '../../shared/types.ts'
import { DEFAULT_LOG_CATEGORIES as SHARED_DEFAULT_LOG_CATEGORIES } from '../../shared/types.ts'

export type { LogCategory, LogLevel }
export type CategoryConfig = LogCategoryConfig

export interface CategoryFilterResult<T> {
  passed: T | null
  reason?: 'disabled' | 'level'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * 默认值**不在此处再写一份**。
 *
 * 原先本文件与 `shared/types.ts` 各有一份逐字相同的 `DEFAULT_LOG_CATEGORIES`
 * （13 项、cookie=debug、ui=warn）。两份常量就是两份真相：改一处忘另一处，
 * 就会出现「测试测的是 A 套默认值、生产跑的是 B 套」的漂移，且这类漂移
 * 不会报错、只表现为"某个分类的日志莫名多了/少了"。
 * 这里改为重导出，保证唯一来源。
 */
export { DEFAULT_LOG_CATEGORIES } from '../../shared/types.ts'

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
  return { ...SHARED_DEFAULT_LOG_CATEGORIES, ...overrides }
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
