import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), process.argv[2])
const kw = process.argv[3]
const raw = readFileSync(file, 'utf-8')
const lines = raw.split(/\r?\n/)
const out = []
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(kw)) out.push(`${i + 1}: ${lines[i].trim()}`)
}
console.log(`FILE=${file}`)
console.log(out.slice(0, 80).join('\n'))
console.log(`--- ${out.length} 处 ---`)
