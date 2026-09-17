import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const dir = resolve(process.cwd(), process.argv[2])
const kw = process.argv[3]
const files = readdirSync(dir).filter(f => /\.(ts|tsx)$/.test(f))
let total = 0
for (const f of files) {
  const full = join(dir, f)
  const lines = readFileSync(full, 'utf-8').split(/\r?\n/)
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(kw)) {
      n++
      total++
      console.log(`${f}:${i + 1}: ${lines[i].trim()}`)
    }
  }
}
console.log(`--- ${total} 处 ---`)
