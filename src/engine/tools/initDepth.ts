/**
 * engine/tools/initDepth.ts — 工具初始化深度管理
 *
 * 实现 getToolInitDepth()、_markToolInitStart()、_markToolInitEnd()。
 */

let _toolInitDepth = 0

/** 获取当前初始化深度 */
export function getToolInitDepth(): number {
  return _toolInitDepth
}

/** 标记初始化开始 */
export function _markToolInitStart(): void {
  _toolInitDepth++
}

/** 标记初始化结束 */
export function _markToolInitEnd(): void {
  _toolInitDepth = Math.max(0, _toolInitDepth - 1)
}

/** 在指定深度上下文中执行异步函数 */
export async function withInitDepth<T>(fn: () => Promise<T>): Promise<T> {
  _markToolInitStart()
  try {
    return await fn()
  } finally {
    _markToolInitEnd()
  }
}
