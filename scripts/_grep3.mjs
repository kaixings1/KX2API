import { readFileSync } from 'node:fs'

const file = process.argv[2]
const kw = process.argv[3]
const ctx = Number(process.argv[4] || 0)
const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(kw)) {
    for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) {
      console.log(`${j + 1}: ${lines[j]}`)
    }
    console.log('---')
  }
}
