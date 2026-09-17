import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 精确列出裸 require( 的位置与上下文（排除注释行）
const root = process.argv[2] || 'src'
const hits = []

function walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '__tests__') continue
      walk(full)
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      let txt
      try { txt = readFileSync(full, 'utf-8') } catch { continue }
      const lines = txt.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const m = /(?<![\w.])require\s*\(/.exec(line)
        if (!m) continue
        const trimmed = line.trim()
        // 跳过注释
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
        // 取 require('...') 里的路径
        const spec = /require\s*\(\s*['"]([^'"]+)['"]/.exec(line)
        hits.push({ file: full, line: i + 1, spec: spec ? spec[1] : '(动态)', text: trimmed.slice(0, 110) })
      }
    }
  }
}

walk(root)
for (const h of hits) {
  console.log(`${h.file}:${h.line}  spec=${h.spec}`)
  console.log(`    ${h.text}`)
}
console.log(`\n--- ${hits.length} 处 ---`)
