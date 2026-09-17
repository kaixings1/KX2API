import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/stepfun-stream.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 两处 stream.on('error', (err) => ...) 的参数没标注（TS7006）。
// Node 的 'error' 事件参数是 Error。
const re1 = /stream\.on\('error', \(err\) => \{/
const re2 = /stream\.on\('error', \(err\) => \{/g

const n = (s.match(re2) || []).length
s = s.replace(re2, "stream.on('error', (err: Error) => {")

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（${n} 处）`)
} else {
  console.log('无改动')
}
