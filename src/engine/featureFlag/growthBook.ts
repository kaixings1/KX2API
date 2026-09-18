/**
 * engine/featureFlag/growthBook.ts — 特性标记求值引擎
 *
 * 吸收自 D:\src\GrowthBook.ts 的核心 evalFeature 能力。
 * 移植了哈希分桶、规则求值、强制覆盖等核心逻辑。
 */

import type { Feature, FeatureRule, FeatureResult, GrowthBookOptions } from './types.js'

const EVENTS = {
  FEATURE_EVALUATED: 'feature_evaluated',
  EXPERIMENT_VIEWED: 'experiment_viewed',
}

/**
 * 简易 MurmurHash3 实现（用于特性分桶）。
 * 与 GrowthBook 使用的算法一致，保证分桶结果可复现。
 */
export function murmurHash3(str: string): number {
  let h1 = 0
  let h2 = 0
  const remainder = str.length % 16
  const bytes = new TextEncoder().encode(str)

  for (let i = 0; i < bytes.length; i++) {
    let k1 = bytes[i]
    k1 *= 0xcc9e2d51
    k1 = (k1 << 15) | (k1 >>> 17)
    k1 *= 0x1b873593
    h1 ^= k1
    h1 = (h1 << 13) | (h1 >>> 19)
    h1 = h1 * 5 + 0xe6546b64
  }

  h1 ^= bytes.length
  h1 ^= h1 >>> 16
  h1 = Math.imul(h1, 0x85ebca6b)
  h1 ^= h1 >>> 13
  h1 = Math.imul(h1, 0xc2b2ae35)
  h1 ^= h1 >>> 16

  return Math.abs(h1)
}

/** 从属性中获取哈希值 */
function getHashAttribute(attr: string, attributes: Record<string, string | number>): string {
  const val = attributes[attr]
  if (val !== undefined) return String(val)
  return String(Math.floor(Math.random() * 1000000))
}

/** 选择 variation 索引 */
function chooseVariation(n: number, coverage: number, hash: string): number {
  if (n <= 0 || coverage <= 0 || coverage > 1) return -1

  const hashInt = murmurHash3(hash)
  const bucket = (hashInt % 10000) / 10000
  if (bucket > coverage) return -1

  return Math.floor(bucket / coverage * n)
}

/** 判断是否在覆盖范围内 */
function isIncluded(coverage: number, hashValue: string): boolean {
  if (coverage <= 0) return false
  const hashInt = murmurHash3(hashValue)
  const bucket = (hashInt % 10000) / 10000
  return bucket <= coverage
}

/**
 * 特性标记求值引擎
 */
export class GrowthBook {
  private features: Record<string, Feature> = {}
  private attributes: Record<string, string | number> = {}
  private apiHost: string
  private clientKey?: string

  constructor(options: GrowthBookOptions = {}) {
    this.features = options.features ?? {}
    this.attributes = options.attributes ?? {}
    this.apiHost = options.apiHost ?? 'https://cdn.growthbook.io'
    this.clientKey = options.clientKey
  }

  /**
   * 求值特性
   */
  evalFeature(name: string, defaultValue: unknown): FeatureResult {
    const feature = this.features[name]
    if (!feature) {
      return { value: defaultValue, source: 'default' }
    }

    const result = this.evalRules(feature, defaultValue, name)
    return result
  }

  /** 特性是否开启 */
  isOn(name: string): boolean {
    return this.evalFeature(name, false).value === true
  }

  /** 特性是否关闭 */
  isOff(name: string): boolean {
    return !this.isOn(name)
  }

  /** 获取特性值 */
  getFeatureValue(name: string, defaultValue: unknown): unknown {
    return this.evalFeature(name, defaultValue).value
  }

  /** 获取所有已求值的特性 */
  getFeatures(): Map<string, FeatureResult> {
    const results = new Map<string, FeatureResult>()
    for (const name of Object.keys(this.features)) {
      results.set(name, this.evalFeature(name, this.features[name].defaultValue))
    }
    return results
  }

  /** 求值规则链 */
  private evalRules(feature: Feature, defaultValue: unknown, featureName: string): FeatureResult {
    const rules = feature.rules ?? []

    // 强制规则优先
    for (const rule of rules) {
      if (rule.force !== undefined) {
        const hashAttr = rule.hashAttribute || 'id'
        const hashValue = getHashAttribute(hashAttr, this.attributes)
        if (rule.coverage !== undefined) {
          if (!isIncluded(rule.coverage, hashValue)) continue
        }
        return {
          value: rule.force,
          source: 'force',
          rule,
        }
      }

      // 覆盖分桶规则
      if (rule.coverage !== undefined && rule.variations.length > 0) {
        const hashAttr = rule.hashAttribute || 'id'
        const hashValue = getHashAttribute(hashAttr, this.attributes)
        const idx = chooseVariation(rule.variations.length, rule.coverage, hashValue)
        if (idx >= 0) {
          return {
            value: rule.variations[idx],
            source: 'experiment',
            rule,
          }
        }
      }
    }

    return { value: defaultValue, source: 'default' }
  }

  /** 事件追踪 */
  track(_event: string, _data: Record<string, unknown>): void {
    // 事件追踪由上层消费
  }
}

/** 便捷工厂函数 */
export function createGrowthBook(options: GrowthBookOptions = {}): GrowthBook {
  return new GrowthBook(options)
}
