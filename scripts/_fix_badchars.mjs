import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/index.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 该行注释里有一处被截断的多字节字符（原文件编码损坏），补回原意「技能分层配置」
s = s.replace('技能分\ufffd\ufffd配置', '技能分层配置')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已修损坏字符: ' + p)
} else {
  console.log('未命中损坏字符（可能已是正常文本）')
}
