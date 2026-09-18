import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 修正 tests/engine/legacy/broken/ 下遗留测试的相对导入路径。
 *
 * 这些文件原本位于 src/engine/__tests__/（距仓库根 3 层），
 * 搬进 tests/engine/legacy/broken/ 后距根变成 4 层，
 * 因此所有 `../../../src/...` 需要补一层变成 `../../../../src/...`。
 *
 * 只改相对路径里的 `src/` 目标，不动 node_modules / node: 前缀的导入。
 */
const dir = process.argv[2] || 'tests/engine/legacy/broken'
const dryRun = process.argv.includes('--dry-run')

let totalFiles = 0
let totalFixes = 0

for (const name of readdirSync(dir)) {
  if (!name.endsWith('.ts')) continue
  const full = join(dir, name)
  const src = readFileSync(full, 'utf-8')

  // 匹配 from '../../..(/src/...)' 或 import('...')
  // 说明：仅处理指向 src/ 的相对路径，且层数不足 4 的
  const fixed = src.replace(/(['"])((?:\.\.\/)+)(src\/)/g, (m, q, dots, rest) => {
    const depth = dots.split('../').length - 1
    if (depth >= 4) return m // 已正确
    return `${q}../${dots}${rest}`
  })

  if (fixed !== src) {
    const n = (src.match(/(['"])(?:\.\.\/)+(src\/)/g) || []).length
    totalFiles++
    totalFixes += n
    console.log(`${dryRun ? '[dry-run] ' : ''}${full} — 修正 ${n} 处`)
    if (!dryRun) writeFileSync(full, fixed)
  }
}

console.log(`\n--- ${totalFiles} 个文件，${totalFixes} 处路径 ---`)
