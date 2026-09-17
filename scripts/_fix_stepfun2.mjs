import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/stepfun-studio.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// CRLF 容错：多行匹配一律用 \r?\n
const re = /const statusCode = response\.statusCode\r?\n(\s*)resolve\(statusCode && statusCode < 400\)/
if (!re.test(s)) {
  console.log('未命中目标块')
  process.exit(1)
}
s = s.replace(re, (m, indent) =>
  [
    'const statusCode = response.statusCode',
    `${indent}// 必须显式布尔化：\`statusCode && ...\` 在 statusCode 为 0 时会把 0 本身`,
    `${indent}// 交给 Promise<boolean>，类型与语义都不对。`,
    `${indent}resolve(typeof statusCode === 'number' && statusCode < 400)`,
  ].join('\n'),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
