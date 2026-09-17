import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/codeVectorStore.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// `db.prepire` 是 `db.prepare` 的拼写错误（better-sqlite3 / bun:sqlite 均无此方法），
// 原样调用会立刻抛 TypeError: this.db.prepire is not a function。
const n = (s.match(/\.prepire\(/g) || []).length
s = s.replace(/\.prepire\(/g, '.prepare(')

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}（替换 ${n} 处 prepire → prepare）`)
} else {
  console.log('无改动')
}
