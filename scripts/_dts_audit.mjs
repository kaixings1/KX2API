import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

/**
 * 审计全仓库的 .d.ts：
 *   1) 区分「手写类型声明」（有实际类型内容）与「编译残留空壳」（只有 export {}）
 *   2) 统计规模，供决定是否清理
 */
const roots = ['src', 'tests', 'scripts', 'tools']
const stats = {
  handwritten: [],   // 手写：含 interface/type/declare module 等实质声明
  emptyShell: [],    // 空壳：仅 export {} 或注释
  other: [],
}

const SUBSTANTIVE = /^\s*(export\s+)?(declare\s+)?(interface|type|namespace|module|function|class|const|let|var|enum)\b/m
const DECLARE_MODULE = /declare\s+module\s+['"]/

function walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'out') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (e.name.endsWith('.d.ts')) {
      let txt
      try { txt = readFileSync(full, 'utf-8') } catch { continue }
      // 去掉注释后看有没有实质声明
      const stripped = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim()
      const onlyExportEmpty = stripped === '' || stripped === 'export {};' || stripped === 'export {}'
      if (DECLARE_MODULE.test(txt) || SUBSTANTIVE.test(stripped)) {
        stats.handwritten.push(full.replace(process.cwd() + '\\', ''))
      } else if (onlyExportEmpty) {
        stats.emptyShell.push(full.replace(process.cwd() + '\\', ''))
      } else {
        stats.other.push(full.replace(process.cwd() + '\\', ''))
      }
    }
  }
}
for (const r of roots) walk(r)

console.log(`手写类型声明（必须保留）: ${stats.handwritten.length}`)
console.log(`编译残留空壳（仅 export {}）: ${stats.emptyShell.length}`)
console.log(`其它（需人工判断）: ${stats.other.length}`)

if (stats.emptyShell.length) {
  console.log('\n--- 空壳清单 ---')
  for (const f of stats.emptyShell) console.log('  ' + f)
}
if (stats.other.length) {
  console.log('\n--- 其它（需人工判断） ---')
  for (const f of stats.other.slice(0, 30)) console.log('  ' + f)
}
