import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
const kw = process.argv[3]
const exts = ['.ts', '.tsx']
const hits = []

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      walk(full)
    } else if (exts.some(x => e.name.endsWith(x))) {
      let txt
      try {
        txt = readFileSync(full, 'utf-8')
      } catch {
        continue
      }
      const lines = txt.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(kw)) hits.push(`${full}:${i + 1}: ${lines[i].trim()}`)
      }
    }
  }
}

walk(root)
console.log(hits.slice(0, 120).join('\n'))
console.log('--- 命中 ' + hits.length + ' 处 ---')
