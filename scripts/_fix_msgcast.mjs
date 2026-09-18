import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/api/client.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// Message 没有字符串索引签名，直接 `as Record<string, unknown>` 会被 TS 判为
// 「两侧不够重叠」（TS2352）。这里确实是有意做字段透传（保留 tool_call_id 等
// 未在 Message 上声明的字段），故显式经 unknown 中转，表明是刻意的类型放宽。
const n = (s.match(/const record = m as Record<string, unknown>/g) || []).length
s = s.replace(
  /const record = m as Record<string, unknown>/g,
  'const record = m as unknown as Record<string, unknown>',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（${n} 处）`)
} else {
  console.log('无改动')
}
