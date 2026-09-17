import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/plans/plansService.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// CRLF 容错：行尾一律用 (\r?\n)
const r1 = /  result\?: string(\r?\n)/
const r2 = /  completedAt\?: number(\r?\n)/

if (!r1.test(s)) console.log('未命中 result')
if (!r2.test(s)) console.log('未命中 completedAt')

s = s.replace(r1, '  result?: string | null$1')
s = s.replace(r2, '  completedAt?: number | null$1')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
