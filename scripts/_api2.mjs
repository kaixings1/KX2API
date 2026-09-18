import { readFileSync } from 'node:fs'

const file = process.argv[2]
const txt = readFileSync(file, 'utf-8')
const lines = txt.split(/\r?\n/)
const out = []
for (let i = 0; i < lines.length; i++) {
  const l = lines[i]
  if (/^\s*(export\s+)?(class|interface|function|const)\s+\w/.test(l) ||
      /^\s{2}(public\s+|private\s+|protected\s+)?(async\s+)?\w+\s*\(/.test(l)) {
    out.push(`${String(i + 1).padStart(4)}  ${l.trim().slice(0, 120)}`)
  }
}
console.log(out.join('\n'))
console.log(`--- ${out.length} 项 ---`)
