import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/api/client.ts'
let s = readFileSync(p, 'utf-8')
const before = s

s = s.replace(
  '      // 因此这里只做安全提取：字符串直接用；流对象则尝试同步读出已到达的错误正文。',
  '      // 因此这里只做安全提取：字符串直接用；流对象做一次异步读取拿到错误正文。',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已修注释')
} else {
  console.log('未命中注释（可能已更新）')
}
