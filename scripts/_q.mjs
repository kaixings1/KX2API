import { readFileSync } from 'node:fs'

const file = process.argv[2]
const kw = process.argv[3]
const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
let n = 0
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(kw)) {
    n++
    if (n <= 80) console.log(`${i + 1}: ${lines[i].trim()}`)
  }
}
console.log(`--- ${n} 处 ---`)
