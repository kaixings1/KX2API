/**
 * engine/featureFlag/types.ts — 特性标记核心类型
 *
 * 吸收自 D:\src\GrowthBook.ts 的类型体系。
 */

/** 特性规则 */
export interface FeatureRule {
  variations: unknown[]
  coverage?: number
  hashAttribute?: string
  force?: unknown
  fallbackAttribute?: string
}

/** 特性定义 */
export interface Feature {
  defaultValue: unknown
  rules?: FeatureRule[]
  enforce?: string
}

/** 特性求值结果 */
export interface FeatureResult {
  value: unknown
  source: 'default' | 'force' | 'experiment' | 'unknown'
  rule?: FeatureRule
}

/** GrowthBook 配置 */
export interface GrowthBookOptions {
  features?: Record<string, Feature>
  attributes?: Record<string, string | number>
  apiHost?: string
  clientKey?: string
}
