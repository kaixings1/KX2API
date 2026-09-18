/**
 * engine/featureFlag/hash.ts — 哈希属性系统
 *
 * 实现 hash()、getHashAttribute()、getStickyBucketAttributeKey() 等。
 */

import { murmurHash3 } from './growthBook.js'

/** 哈希字符串 */
export function hash(str: string): string {
  return String(murmurHash3(str))
}

/** 从属性获取哈希值（返回整数） */
export function getHashAttribute(attr: string, attributes?: Record<string, string | number>): number {
  const val = attributes?.[attr]
  if (val !== undefined) {
    return murmurHash3(String(val))
  }
  return murmurHash3(attr)
}

/** 生成粘性分桶属性键名 */
export function getStickyBucketAttributeKey(namespace: string): string {
  return `sticky_bucket_${namespace}`
}

/** 检查值是否在范围内 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/** 检查 key 是否属于 namespace */
export function inNamespace(namespace: string, key: string): boolean {
  return key.startsWith(`${namespace}:`) || key.startsWith(`${namespace}_`)
}

/** 根据哈希选择 variation 索引 */
export function chooseVariation(n: number, coverage: number, hash: string): number {
  if (n <= 0 || coverage <= 0 || coverage > 1) return -1

  const hashInt = murmurHash3(hash)
  const bucket = (hashInt % 10000) / 10000
  if (bucket > coverage) return -1

  return Math.floor(bucket / coverage * n)
}

/** 判断用户是否在实验组 */
export function isIncluded(coverage: number, hashValue: string, fallbackAttribute?: string): boolean {
  if (coverage <= 0) return false
  const hashInt = murmurHash3(hashValue)
  const bucket = (hashInt % 10000) / 10000
  return bucket <= coverage
}
