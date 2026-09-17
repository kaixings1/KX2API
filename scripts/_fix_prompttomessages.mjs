import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/routes/completions.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 返回类型写成 role: string，与 ChatMessage.role（字面量联合）不兼容（TS2345）。
// 本函数只产出 'user' / 'assistant'，用精确字面量即可。
s = s.replace(
  'function promptToMessages(prompt: string | string[]): Array<{ role: string; content: string }> {',
  "function promptToMessages(prompt: string | string[]): Array<{ role: 'user' | 'assistant'; content: string }> {",
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
