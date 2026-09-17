import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// 扫描 src/ 下所有 ts/tsx，找出 U+FFFD（写入时的编码事故产物）并报告
const root = 'src'
const hits = []

function walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      walk(full)
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      let txt
      try { txt = readFileSync(full, 'utf-8') } catch { continue }
      const lines = txt.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('\uFFFD')) {
          hits.push({ file: full, line: i + 1, text: lines[i].trim() })
        }
      }
    }
  }
}

walk(root)
for (const h of hits) console.log(`${h.file}:${h.line}: ${h.text}`)
console.log(`--- 共 ${hits.length} 处 U+FFFD ---`)
