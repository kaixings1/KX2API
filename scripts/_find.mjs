import { readFileSync } from 'node:fs'

const [file, kw] = process.argv.slice(2)
const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
let n = 0
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(kw)) {
    n++
    console.log(`${i + 1}: ${lines[i].trim()}`)
  }
}
console.log(`--- 命中 ${n} 处 ---`)
