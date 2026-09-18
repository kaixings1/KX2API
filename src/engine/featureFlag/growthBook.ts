/**
 * engine/featureFlag/growthBook.ts — 特性标记求值引擎
 *
 * 吸收自 D:\src\GrowthBook.ts 的核心 evalFeature 能力。
 * 移植了哈希分桶、规则求值、强制覆盖等核心逻辑。
 */

import type { Feature, FeatureRule, FeatureResult, GrowthBookOptions } from './types.ts'

const EVENTS = {
  FEATURE_EVALUATED: 'feature_evaluated',
  EXPERIMENT_VIEWED: 'experiment_viewed',
}

/**
 * 简化的 MurmurHash3 变体（用于特性分桶）。
 *
 * ⚠️ 说明：这里按「逐字节」处理而非标准 MurmurHash3 的 4 字节块 + 尾部混合，
 * 因此**结果与 GrowthBook 官方 SDK 不一致**。它满足分桶需要的两条性质：
 * 确定性（同输入同输出）与雪崩性（微小输入差异得到差异较大的桶位），
 * 但不能用于与官方 SDK 对拍分桶结果。若要严格对齐上游，需替换为
 * 标准 MurmurHash3 x86_32 实现。
 */
export function murmurHash3(str: string): number {
  let h1 = 0
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

/**
 * 从属性中获取哈希值。
 *
 * ⚠️ 缺失属性时**必须确定性回落**（回落到属性名本身），绝不能用
 * `Math.random()` —— 那会让同一个实例在同一份数据上每次求值都落到
 * 不同分桶，用户会在实验组之间反复横跳（A/B 实验的核心前提就是
 * 「同一用户结果稳定」）。与 hash.ts 的同名函数保持同一口径。
 */
function getHashAttribute(attr: string, attributes: Record<string, string | number>): string {
  const val = attributes[attr]
  if (val !== undefined) return String(val)
  return attr
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

    // 特性存在但没有任何规则命中时，应回落到**特性自身的 defaultValue**，
    // 而不是调用方传入的兜底值 —— 否则 `{ defaultValue: true }` 这种
    // 「默认开启、无规则」的特性会因调用方传 false 而被判为关闭。
    // 调用方传入的 defaultValue 只用于「特性未定义」的场景。
    const fallback = feature.defaultValue === undefined ? defaultValue : feature.defaultValue
    return this.evalRules(feature, fallback, name)
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
