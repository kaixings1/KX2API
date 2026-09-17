import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const target = resolve(process.cwd(), process.argv[2])
const kw = process.argv[3]
const hits = []

function scanFile(f) {
  let txt
  try {
    txt = readFileSync(f, 'utf-8')
  } catch {
    return
  }
  const lines = txt.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(kw)) hits.push(`${f.replace(process.cwd(), '.')}:${i + 1}: ${lines[i].trim()}`)
  }
}

const st = statSync(target)
if (st.isFile()) {
  scanFile(target)
} else {
  const walk = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) scanFile(full)
    }
  }
  walk(target)
}

console.log(hits.slice(0, 60).join('\n'))
console.log(`--- ${hits.length} 处 ---`)
