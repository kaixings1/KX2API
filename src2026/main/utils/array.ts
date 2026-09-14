/**
 * Array utility functions
 */

/**
 * Insert `separator` between each pair of elements in `as`.
 *
 * @example intersperse([1, 2, 3], i => 'x') → [1, 'x', 2, 'x', 3]
 */
export function intersperse<A>(as: A[], separator: (index: number) => A): A[] {
  return as.flatMap((a, i) => (i ? [separator(i), a] : [a]))
}

/**
 * Count elements matching a predicate.
 */
export function count<T>(arr: readonly T[], pred: (x: T) => unknown): number {
  let n = 0
  for (const x of arr) n += +!!pred(x)
  return n
}

/**
 * Return unique elements, preserving insertion order.
 */
export function uniq<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)]
}
