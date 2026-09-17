import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/api/client.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// httpStream.on('error', (err) => ...) 参数未标注（TS7006）
const n = (s.match(/httpStream\.on\('error', \(err\) => \{/g) || []).length
s = s.replace(/httpStream\.on\('error', \(err\) => \{/g, "httpStream.on('error', (err: Error) => {")

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（${n} 处）`)
} else {
  console.log('无改动')
}
