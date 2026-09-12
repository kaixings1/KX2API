/**
 * pMap — 带并发控制的 Promise.map
 * 从 doge-desktop src/vendor/pMap.ts 移植
 */

export async function pMap<T, R>(
  iterable: Iterable<T> | AsyncIterable<T>,
  mapper: (element: T, index: number) => R | Promise<R>,
  options?: { concurrency?: number },
): Promise<R[]> {
  const concurrency = options?.concurrency ?? Number.POSITIVE_INFINITY
  if (typeof mapper !== 'function') {
    throw new TypeError('Mapper function is required')
  }

  const result: R[] = []
  let currentIndex = 0

  const iterator = Symbol.iterator in iterable
    ? (iterable as Iterable<T>)[Symbol.iterator]()
    : (iterable as AsyncIterable<T>)[Symbol.asyncIterator]()

  const next = async (): Promise<boolean> => {
    const item = await (iterator as any).next()
    if (item.done) return false
    const index = currentIndex++
    result[index] = await mapper(item.value, index)
    return true
  }

  const runners: Promise<void>[] = []
  for (let i = 0; i < concurrency; i++) {
    runners.push(
      (async () => {
        while (await next()) {
          // continue
        }
      })(),
    )
  }

  await Promise.all(runners)
  return result
}

export default pMap
