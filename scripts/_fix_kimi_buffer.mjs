import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/kimi.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// TS 5.7 起 Buffer 带 ArrayBuffer 泛型：Buffer.alloc(0) 推断为 Buffer<ArrayBuffer>，
// 而 Buffer.concat() 返回 Buffer<ArrayBufferLike>，回调里回写就报 TS2322。
// 显式标注为 Buffer（默认泛型）即可消除这层无意义的窄化。
const n = (s.match(/    let buffer = Buffer\.alloc\(0\)/g) || []).length
s = s.replace(/    let buffer = Buffer\.alloc\(0\)/g, '    let buffer: Buffer = Buffer.alloc(0)')

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（${n} 处）`)
} else {
  console.log('无改动')
}
