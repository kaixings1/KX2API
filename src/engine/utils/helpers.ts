/**
 * engine/utils/helpers.ts — 通用工具函数集合
 *
 * 吸收自 D:\src\util.ts 的散落辅助函数。
 */

/** 简单字符串哈希（djb2） */
export function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  }
  return h
}

/** 检查值是否在范围内 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/** 检查字符串是否在指定命名空间内 */
export function inNamespace(name: string, namespaces: string[]): boolean {
  return namespaces.some(ns => name === ns || name.startsWith(`${ns}.`))
}

/** 从多个候选中按权重随机选择（返回索引） */
export function chooseVariation(n: number, coverage: number, hashValue: string): number {
  if (n <= 0) return -1
  if (coverage <= 0) return -1

  const bucket = parseInt(hashValue.slice(0, 8), 16) / 0xFFFFFFFF
  if (bucket > coverage) return -1

  return Math.floor(bucket / coverage * n)
}

/** 带超时的 Promise 包装 */
export function promiseTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const id = setTimeout(() => reject(new Error(`${label} 超时 (${ms}ms)`)), ms)
      return () => clearTimeout(id)
    }),
  ])
}

/** 版本号补齐（用于版本比较） */
export function paddedVersionString(version: string): string {
  return version
    .split('.')
    .map(part => part.padStart(4, '0'))
    .join('.')
}
