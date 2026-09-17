import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/engine-bridge.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 调用点传的是 `{[x: string]: unknown}[]`（来自 forwarder 的宽松消息形状），
// 而此处要求每个元素必须含 content 字段，导致 TS2345。
// 本函数只做「字符串长度 / 4」的粗估，已用 typeof 守卫，放宽元素形状即可。
const re = /function estimateRequestTokens\(messages: Array<\{ content: unknown \}>\): number \{/

if (!re.test(s)) {
  console.log('未命中')
  process.exit(1)
}

s = s.replace(
  re,
  'function estimateRequestTokens(messages: ReadonlyArray<Record<string, unknown>>): number {',
)

writeFileSync(p, s)
console.log('已改: ' + p)
