import { readFileSync } from 'node:fs'

const file = process.argv[2]
const kw = process.argv[3]
const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
if (!kw) {
  // 无关键词：打印前 N 行
  const n = Number(process.argv[4] || 30)
  lines.slice(0, n).forEach((l, i) => console.log(`${i + 1}: ${l}`))
} else {
  let c = 0
  lines.forEach((l, i) => {
    if (l.includes(kw)) { c++; console.log(`${i + 1}: ${l}`) }
  })
  console.log(`--- ${c} 处 ---`)
}
