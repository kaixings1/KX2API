import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/stepfun-studio.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 同 stepfun.ts：serverError 是 string | null（null = 没有错误），
// 而返回值 error?: string（undefined = 没有错误），显式转换。
const n = (s.match(/\n(\s+)headers: responseHeaders,\r?\n\s+error: serverError,\r?\n/g) || []).length
s = s.replace(
  /(\n\s+headers: responseHeaders,\r?\n\s+)error: serverError,(\r?\n)/g,
  '$1error: serverError ?? undefined,$2',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（${n} 处）`)
} else {
  console.log('无改动')
}
