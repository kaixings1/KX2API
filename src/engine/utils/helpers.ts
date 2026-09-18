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

/**
 * 带超时的 Promise 包装。
 *
 * ⚠️ 定时器必须在两个方向上都释放：
 *   - promise 先完成 → 清掉定时器（否则句柄存活到超时，拖住 Node 进程退出；
 *     超时后还会对一个已 settle 的 promise 再 reject）
 *   - 超时先触发 → 清掉定时器（已经触发，主动清理更明确）
 *
 * 原实现把 `clearTimeout` 写成 `new Promise(executor)` 的**返回值**，
 * 而 Promise 构造器会忽略执行器的返回值 —— 等于清理逻辑从未执行。
 * 这里改为在回调内直接 clearTimeout，并用 finally 兜底。
 */
export function promiseTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timer = undefined
      reject(new Error(`${label} 超时 (${ms}ms)`))
    }, ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  })
}

/** 版本号补齐（用于版本比较） */
export function paddedVersionString(version: string): string {
  return version
    .split('.')
    .map(part => part.padStart(4, '0'))
    .join('.')
}
