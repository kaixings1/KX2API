import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/protocols/shared.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 1) 补回 grep 系列（统一落到 find，本项目没有独立的 grep/findstr 注册命令）
s = s.replace(
  "  local_search: 'find',\r\n",
  "  local_search: 'find',\r\n" +
    "  // 内容检索：本项目没有独立的 grep / findstr 注册命令，统一走 find\r\n" +
    "  grep: 'find',\r\n" +
    "  search_content: 'find',\r\n" +
    "  findstr_search: 'find',\r\n",
)
s = s.replace(
  "  local_search: 'find',\n",
  "  local_search: 'find',\n" +
    "  // 内容检索：本项目没有独立的 grep / findstr 注册命令，统一走 find\n" +
    "  grep: 'find',\n" +
    "  search_content: 'find',\n" +
    "  findstr_search: 'find',\n",
)

// 2) 修兜底：原实现把未知名字首字母大写（ls → Ls），凭空造出不存在的名字。
//    既然方向已定为「本项目注册命令名」，查不到映射就应**原样保留**，
//    交给上层的 resolveToolName（它才有别名与模糊匹配能力）处理。
const oldFallback = 'return TOOL_NAME_MAPPING[lower] || colonBase.charAt(0).toUpperCase() + colonBase.slice(1)'
if (!s.includes(oldFallback)) {
  console.log('未命中兜底行')
  process.exit(1)
}

s = s.replace(
  oldFallback,
  [
    '// 查不到映射时**原样保留**：',
    '  //',
    '  // 原实现是 `colonBase.charAt(0).toUpperCase() + colonBase.slice(1)`，',
    '  // 会把 `ls` 变成 `Ls` —— 凭空造出一个既不在映射表、也不在注册表里的名字，',
    '  // 反而让下游更不可能匹配成功。',
    '  //',
    '  // 归一化的方向已明确为「本项目注册命令名」，未命中就说明模型用的可能是',
    '  // 更自由的别名（如 local_dir_list），应交由 toolNameResolver.resolveToolName',
    '  // 用完整的 TOOL_ALIASES（54 条）+ 模糊匹配处理，而不是在这里做无依据的变形。',
    '  return TOOL_NAME_MAPPING[lower] || colonBase',
  ].join(NL),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
