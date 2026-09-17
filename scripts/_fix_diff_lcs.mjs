import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/utils/diff.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// Int32Array[] 不能赋给 number[][]（TS2322）。这里表达的是「一维数值表」，
// 用 ArrayLike<number>[] 既准确又保留 Int32Array 的内存优势。
s = s.replace(
  'function buildLcsTable(a: string[], b: string[]): number[][] {',
  'function buildLcsTable(a: string[], b: string[]): ArrayLike<number>[] {',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
