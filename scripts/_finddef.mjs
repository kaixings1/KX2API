import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 在整个 src/ 下查找某个标识符的定义与使用
const kw = process.argv[2]
const hits = []

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.(ts|tsx|js)$/.test(e.name)) {
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

walk('src')
console.log(hits.slice(0, 40).join('\n'))
console.log(`--- ${hits.length} 处 ---`)
