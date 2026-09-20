/**
 * utils/treeify.ts — 对象树状文本渲染（自 D:\src\utils\treeify.ts 移植）
 *
 * 基于 https://github.com/notatestuser/treeify 。
 * 将嵌套对象渲染为树枝状文本（├ └ │）。剥离了上游对 Ink 主题/颜色系统
 * （theme.ts / color.ts / figures.ts）的颜色依赖，保留完整树结构逻辑。
 * 若需要颜色，调用方可自行对输出做 ANSI 着色。
 */

export type TreeNode = {
  [key: string]: unknown
}

export type TreeifyOptions = {
  showValues?: boolean
  hideFunctions?: boolean
}

const TREE_CHARS = {
  branch: '├', // lineUpDownRight
  lastBranch: '└', // lineUpRight
  line: '│', // lineVertical
  empty: ' ',
}

/**
 * 将嵌套对象渲染为树状文本。
 * @param obj 任意嵌套对象
 * @param options.showValues 是否展示叶子值（默认 true）
 * @param options.hideFunctions 是否过滤函数字段（默认 false）
 */
export function treeify(obj: TreeNode, options: TreeifyOptions = {}): string {
  const { showValues = true, hideFunctions = false } = options

  const lines: string[] = []
  const visited = new WeakSet<object>()

  function growBranch(
    node: TreeNode | string,
    prefix: string,
    _isLast: boolean,
    depth: number = 0,
  ): void {
    if (typeof node === 'string') {
      lines.push(prefix + node)
      return
    }

    if (typeof node !== 'object' || node === null) {
      if (showValues) {
        lines.push(prefix + String(node))
      }
      return
    }

    // 循环引用检测
    if (visited.has(node)) {
      lines.push(prefix + '[Circular]')
      return
    }
    visited.add(node)

    const keys = Object.keys(node).filter(key => {
      const value = node[key]
      if (hideFunctions && typeof value === 'function') return false
      return true
    })

    keys.forEach((key, index) => {
      const value = node[key]
      const isLastKey = index === keys.length - 1
      const nodePrefix = depth === 0 && index === 0 ? '' : prefix

      // 确定树字符
      const treeChar = isLastKey ? TREE_CHARS.lastBranch : TREE_CHARS.branch
      const coloredKey = key.trim() === '' ? '' : key

      let line = nodePrefix + treeChar + (coloredKey ? ' ' + coloredKey : '')

      // 是否加冒号（空/空白键不加）
      const shouldAddColon = key.trim() !== ''

      // 递归前检查循环引用
      if (value && typeof value === 'object' && visited.has(value)) {
        lines.push(
          line + (shouldAddColon ? ': ' : line ? ' ' : '') + '[Circular]',
        )
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        lines.push(line)
        // 嵌套项的续行前缀
        const continuationChar = isLastKey
          ? TREE_CHARS.empty
          : TREE_CHARS.line
        const nextPrefix = nodePrefix + continuationChar + ' '
        growBranch(value as TreeNode, nextPrefix, isLastKey, depth + 1)
      } else if (Array.isArray(value)) {
        // 数组：显示长度
        lines.push(
          line +
            (shouldAddColon ? ': ' : line ? ' ' : '') +
            '[Array(' +
            value.length +
            ')]',
        )
      } else if (showValues) {
        // 展示值
        const valueStr =
          typeof value === 'function' ? '[Function]' : String(value)
        line += (shouldAddColon ? ': ' : line ? ' ' : '') + valueStr
        lines.push(line)
      } else {
        lines.push(line)
      }
    })
  }

  // 开始生长树
  const keys = Object.keys(obj)
  if (keys.length === 0) {
    return '(empty)'
  }

  // 单个空白字符串键的特例
  if (
    keys.length === 1 &&
    keys[0] !== undefined &&
    keys[0].trim() === '' &&
    typeof obj[keys[0]] === 'string'
  ) {
    const firstKey = keys[0]
    return TREE_CHARS.lastBranch + ' ' + (obj[firstKey] as string)
  }

  growBranch(obj, '', true)
  return lines.join('\n')
}