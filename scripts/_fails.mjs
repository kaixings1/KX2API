import { readFileSync } from 'node:fs'

const file = process.argv[2]
const mark = process.argv[3] || '\u2717'
const lines = readFileSync(file, 'utf-8').split('\n')
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(mark)) console.log(`${i + 1}: ${lines[i]}`)
}
