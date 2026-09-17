import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/stepfun.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// serverError 初始为 null（表示「没有错误」），而返回值里 error?: string
// （undefined 表示「没有错误」）。两处把 null 显式转成 undefined，
// 语义等价且不改变已有行为。
const n1 = (s.match(/\n(\s+)headers: responseHeaders,\r?\n\s+error: serverError,\r?\n/g) || []).length
s = s.replace(
  /(\n\s+headers: responseHeaders,\r?\n\s+)error: serverError,(\r?\n)/g,
  '$1error: serverError ?? undefined,$2',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（${n1} 处）`)
} else {
  console.log('无改动')
}
