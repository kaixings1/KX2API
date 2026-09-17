import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 多关键词扫描（避免 MSYS2 的引号/管道问题，一次跑完）
const root = 'src'
const kws = process.argv.slice(2)
const hits = new Map(kws.map(k => [k, []]))

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
        for (const k of kws) {
          if (lines[i].includes(k)) hits.get(k).push(`${full}:${i + 1}: ${lines[i].trim().slice(0, 120)}`)
        }
      }
    }
  }
}

walk(root)
for (const [k, arr] of hits) {
  console.log(`\n===== ${k} (${arr.length}) =====`)
  console.log(arr.slice(0, 25).join('\n'))
}
