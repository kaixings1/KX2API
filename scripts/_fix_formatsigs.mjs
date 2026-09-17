import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/constants/signatures.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// ToolCallFormat 含 'unknown'，但 FORMAT_SIGNATURES 漏了该键（TS2741）。
// unknown 表示「还没有认出格式」，故签名列表为空。
const re = /  kimi: \[[^\]]*\],\r?\n\}/
if (!re.test(s)) {
  console.log('未命中 kimi 行')
  process.exit(1)
}

s = s.replace(
  re,
  (m) => m.replace(/\r?\n\}$/, (tail) => (m.includes('\r\n') ? "\r\n  unknown: [],\r\n}" : "\n  unknown: [],\n}")),
)

writeFileSync(p, s)
console.log('已改: ' + p)
