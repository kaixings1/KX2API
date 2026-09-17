import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/knowledgeGraph.ts'
const raw = readFileSync(p, 'utf-8')
let s = raw
const before = s

// 写入时的编码事故：两处混入了 U+FFFD（替换字符）。
// 1) 第 257 行 `string | n\uFFFDull` —— 语法错误，整个文件编译不过（TS1005/TS1490）
s = s.replace('let targetPath: string | n\uFFFDull = null', 'let targetPath: string | null = null')

// 2) 第 320 行注释里的坏字，按语境补回「名」
s = s.replace('忽略跨文件同\uFFFD的重复匹配', '忽略跨文件名重复匹配')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
  // 复核是否还有残留
  const left = (s.match(/\uFFFD/g) || []).length
  console.log('剩余 U+FFFD 数量: ' + left)
} else {
  console.log('未命中（可能替换串与实际不符）')
}
