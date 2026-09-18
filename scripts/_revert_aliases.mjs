import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/permissions/permissionRules.ts'
let s = readFileSync(p, 'utf-8')
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 撤回上一版：把 Claude 风格名塞进 LEGACY_TOOL_NAME_ALIASES 是错的。
//
// 那张表的语义是**工具改名**（Task → Agent，旧名此后不再存在），
// 而 Bash/bash、Read/cat 属于「同一工具的不同写法」——
// 塞进改名表会导致：
//   1. 用户输入 'Bash' 被改写成 'bash'，回显与往返序列化都变了（破坏既有行为）；
//   2. 概念混淆：改名 vs 别名，日后难判断能否安全删除。
//
// 正确做法：**解析/存储保留用户原样**，只在**匹配时**用概念归类做兼容判定。
const start = s.indexOf('  // ── Claude Code 风格名 → 本项目注册命令名 ──')
if (start < 0) {
  console.log('未找到待撤回区块')
  process.exit(1)
}
const endMarker = '  MultiFileEdit: \'fix\',\n'
const endMarkerCRLF = '  MultiFileEdit: \'fix\',\r\n'

let end = s.indexOf(endMarker, start)
if (end < 0) end = s.indexOf(endMarkerCRLF, start)
if (end < 0) {
  console.log('未找到区块结尾')
  process.exit(1)
}
end += (s.slice(end).startsWith(endMarkerCRLF) ? endMarkerCRLF.length : endMarker.length)

s = s.slice(0, start) + s.slice(end)

writeFileSync(p, s)
console.log('已撤回别名表扩充')
