import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 修正 tests/engine/legacy/broken/ 下遗留测试的相对导入路径。
 *
 * 这些文件原本位于 src/engine/__tests__/（距仓库根 3 层），
 * 搬进 tests/engine/legacy/broken/ 后距根变成 4 层，
 * 因此 `../../../<target>` 需要补一层变成 `../../../../<target>`。
 *
 * 上一版只用 String.replace（只替换首个匹配），漏掉了同一文件里的后续导入；
 * 这里改为全局替换。
 */
const dir = process.argv[2] || 'tests/engine/legacy/broken'
const dryRun = process.argv.includes('--dry-run')

let totalFiles = 0
let totalFixes = 0

for (const name of readdirSync(dir)) {
  if (!name.endsWith('.ts')) continue
  const full = join(dir, name)
  const src = readFileSync(full, 'utf-8')

  let fixes = 0
  // 全局匹配：所有指向 src/ 的相对导入，层数不足 4 的补一层
  const fixed = src.replace(/(['"])((?:\.\.\/)+)(src\/)/g, (m, q, dots, rest) => {
    const depth = dots.split('../').length - 1
    if (depth >= 4) return m
    fixes++
    return `${q}../${dots}${rest}`
  })

  if (fixes > 0) {
    totalFiles++
    totalFixes += fixes
    console.log(`${dryRun ? '[dry-run] ' : ''}${full} — 修正 ${fixes} 处`)
    if (!dryRun) writeFileSync(full, fixed)
  }
}

console.log(`\n--- ${totalFiles} 个文件，${totalFixes} 处路径 ---`)
