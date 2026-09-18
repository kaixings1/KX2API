import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const kw = process.argv[2]
const dirs = process.argv[3] ? [process.argv[3]] : ['src', 'tests']
const hits = []

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
      let txt
      try { txt = readFileSync(full, 'utf-8') } catch { continue }
      const lines = txt.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(kw)) {
          hits.push(`${full.replace(process.cwd() + '\\', '')}:${i + 1}: ${lines[i].trim().slice(0, 120)}`)
        }
      }
    }
  }
}
for (const d of dirs) walk(d)
console.log(hits.slice(0, 50).join('\n'))
console.log(`--- ${hits.length} 处 ---`)
