import { readFileSync } from 'node:fs'

const name = process.argv[2]
const a = readFileSync(`src/engine/__tests__/${name}`, 'utf-8').split(/\r?\n/)
const b = readFileSync(`tests/engine/legacy/broken/${name}`, 'utf-8').split(/\r?\n/)

console.log(`原件 ${a.length} 行 / 副本 ${b.length} 行\n`)
const max = Math.max(a.length, b.length)
let shown = 0
for (let i = 0; i < max; i++) {
  const la = a[i] ?? '<无>'
  const lb = b[i] ?? '<无>'
  // 归一化路径前缀后再比，只报告实质差异
  const norm = s => s.replace(/(?:\.\.\/)+/g, '')
  if (norm(la) !== norm(lb)) {
    console.log(`L${i + 1}:`)
    console.log(`  原件: ${la.trim().slice(0, 130)}`)
    console.log(`  副本: ${lb.trim().slice(0, 130)}`)
    if (++shown >= 20) { console.log('  …（仅显示前 20 处）'); break }
  }
}
if (shown === 0) console.log('（归一化路径后无实质差异）')
