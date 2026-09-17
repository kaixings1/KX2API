import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const kws = ['formatUserError', 'formatHttpError', 'formatSystemError', 'formatSystemHttpError', 'translateI18nKey']
const roots = ['src']
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
        for (const k of kws) {
          if (lines[i].includes(k)) hits.push(`${full}:${i + 1}: ${lines[i].trim().slice(0, 110)}`)
        }
      }
    }
  }
}
for (const r of roots) walk(r)
console.log(hits.join('\n'))
console.log(`\n--- ${hits.length} 处 ---`)
