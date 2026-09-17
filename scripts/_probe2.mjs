import { readFileSync } from 'node:fs'

const [file, kw, ctxArg] = process.argv.slice(2)
const ctx = Number(ctxArg || 0)
const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(kw)) {
    const from = Math.max(0, i - ctx)
    const to = Math.min(lines.length, i + ctx + 1)
    for (let j = from; j < to; j++) {
      console.log(`${j + 1}: ${lines[j]}`)
    }
    console.log('---')
  }
}
