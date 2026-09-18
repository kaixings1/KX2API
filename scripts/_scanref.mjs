import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 检查 .d.ts 文件是否被任何源码/配置引用（决定能否安全删除）
const targets = process.argv.slice(2)
const roots = ['src', 'tests', 'scripts', 'tools']
const hits = []

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'out') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.(ts|tsx|mjs|js|json)$/.test(e.name)) {
      let txt
      try { txt = readFileSync(full, 'utf-8') } catch { continue }
      for (const t of targets) {
        // 只找「显式引用该文件名」的地方，避免命中泛化匹配
        const base = t.split('/').pop()
        if (txt.includes(base)) hits.push(`${full}: 引用了 ${base}`)
      }
    }
  }
}

for (const r of roots) walk(r)
// 额外检查 tsconfig / package.json
for (const f of ['tsconfig.check.json', 'package.json', 'vitest.config.ts', 'electron.vite.config.ts']) {
  try {
    const txt = readFileSync(f, 'utf-8')
    for (const t of targets) {
      const base = t.split('/').pop()
      if (txt.includes(base)) hits.push(`${f}: 引用了 ${base}`)
    }
  } catch { /* 文件不存在 */ }
}

console.log(hits.length ? hits.join('\n') : '（无任何引用）')
console.log(`--- ${hits.length} 处引用 ---`)
