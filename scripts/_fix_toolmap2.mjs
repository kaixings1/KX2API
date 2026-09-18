import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/protocols/shared.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// findstr 不在 commandRunners 注册表中（注册表里与搜索相关的只有 find / cat / ls）。
// 与此前删除 write/edit 同理：不能映射到一个不存在的名字。
// 内容检索在本项目里统一走 find。
s = s.replace(
  /^  grep: 'findstr',$/m,
  "  // 内容检索：本项目没有独立的 grep/findstr 注册命令，统一走 find\n  grep: 'find',",
)
s = s.replace(/^  search_content: 'findstr',$/m, "  search_content: 'find',")
s = s.replace(/^  findstr_search: 'findstr',$/m, "  findstr_search: 'find',")

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动（检查匹配）')
}
