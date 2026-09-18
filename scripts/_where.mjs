import { readFileSync } from 'node:fs'

const file = process.argv[2]
const kw = process.argv[3]
const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(kw)) console.log(`${i + 1}: ${lines[i]}`)
}
console.log('--- 共 ' + lines.filter(l => l.includes(kw)).length + ' 行 ---')
