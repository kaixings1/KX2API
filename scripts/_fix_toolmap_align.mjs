import { readFileSync, writeFileSync } from 'node:fs'

/**
 * 把 TOOL_NAME_MAPPING 对齐到「本项目注册命令名」。
 *
 * 原表映射到 Claude Code 风格名（Bash / Read / Write / ListFiles / Glob …），
 * 这 11 个目标名在本项目 commandRunners 里**一个都不存在**（0/11），
 * 归一化后仍然调不通工具。
 *
 * 正确方向已由项目自身给出：src/engine/toolNameResolver.ts 的 TOOL_ALIASES
 * 就是「模型自造名 → 注册名」（list_directory → ls、local_read → cat）。
 *
 * 对齐原则（不硬凑）：
 *   - 有明确对应注册命令的 → 映射过去（ls/cat/find/bash/…）
 *   - 对应的能力在本项目**根本不存在**的（读写/编辑文件：Write/Edit/Read）→ 删除该条
 *     因为映射到一个语义相近但错误的命令（如 write→cp）比不映射更危险：
 *     会把"写文件"执行成"复制文件"。
 */

const p = 'src/main/proxy/toolCalling/protocols/shared.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const runners = readFileSync('src/engine/agent/command-runners.ts', 'utf-8')
const regBlock = runners.slice(runners.indexOf('export const commandRunners'))
const registry = new Set([...regBlock.matchAll(/^\s*\['([^']+)',/gm)].map(m => m[1]))

// 只保留「有明确对应注册命令」的映射；语义不明确的宁可删掉
const aligned = [
  // 执行命令
  ['bash', 'bash'], ['cmd', 'bash'], ['shell', 'bash'], ['powershell', 'bash'],
  ['batch', 'bash'], ['execute_command', 'bash'], ['run_command', 'bash'],
  // 列目录 / 当前目录
  ['ls', 'ls'], ['dir', 'ls'], ['listfiles', 'ls'], ['list_dir', 'ls'],
  ['list_directory', 'ls'], ['list_files', 'ls'], ['ls_dir', 'ls'],
  // 读文件内容
  ['cat', 'cat'], ['read', 'cat'], ['read_file', 'cat'],
  ['read_file_content', 'cat'], ['local_file', 'cat'], ['local_cat', 'cat'],
  ['local_read', 'cat'],
  // 搜索：内容是关键词匹配 → 用 findstr（Windows 原生命令）
  ['grep', 'findstr'], ['search_content', 'findstr'], ['findstr_search', 'findstr'],
  // 搜索：找文件 → 用 find
  ['find', 'find'], ['glob', 'find'], ['search_files', 'find'], ['find_file', 'find'],
  ['find_files', 'find'], ['local_find', 'find'], ['local_search', 'find'],
  // 执行代码
  ['code_interpreter', 'exec'], ['execute_code', 'exec'],
]

const kept = []
const droppedForMissingCommand = []
for (const [k, v] of aligned) {
  if (registry.has(v)) kept.push([k, v])
  else droppedForMissingCommand.push(`${k} → ${v}`)
}

// 检视：原表里还有哪些条目，其能力在本项目不存在 → 明确删除
const removedConcepts = [
  'write / write_file / write_to_file（写文件）',
  'edit / replace_in_file / str_replace_editor（改文件）',
  'web_search / fetch_url / web_extractor（联网检索）',
]

const NL = s.includes('\r\n') ? '\r\n' : '\n'

const newBlock = [
  'export const TOOL_NAME_MAPPING: Record<string, string> = {',
  '  // 方向：模型可能输出的名字 → **本项目注册命令名**（commandRunners 的 key）。',
  '  //',
  '  // 为什么是这个方向：原表映射到 Claude Code 风格名（Bash / Read / Write /',
  '  // ListFiles / Glob …），而这 11 个名字在本项目注册表里**一个都不存在** ——',
  '  // 于是凡经此归一化的调用，名字必然对不上可执行的工具。',
  '  //',
  '  // 与本文件同源的正确实现见 src/engine/toolNameResolver.ts 的 TOOL_ALIASES',
  '  //（list_directory → ls、local_read → cat），方向一致。',
  '  //',
  '  // 说明：本项目**没有**「写文件 / 改文件 / 联网检索」这类注册命令，',
  '  // 因此原表中对应的条目（write_file / replace_in_file / web_search …）已删除 ——',
  '  // 映射到一个语义相近但错误的命令（如 write → cp）比不映射更危险，',
  '  // 会把"写文件"执行成"复制文件"。',
  ...kept.map(([k, v]) => `  ${k}: '${v}',`),
  '}',
].join(NL)

const oldBlock = /export const TOOL_NAME_MAPPING: Record<string, string> = \{[\s\S]*?\n\}/
if (!oldBlock.test(s)) {
  console.log('未找到 TOOL_NAME_MAPPING')
  process.exit(1)
}
s = s.replace(oldBlock, newBlock)

if (s !== before) {
  writeFileSync(p, s)
  console.log(`已改: ${p}`)
  console.log(`保留映射 ${kept.length} 条：`)
  for (const [k, v] of kept) console.log(`  ${k} → ${v}`)
  if (droppedForMissingCommand.length) {
    console.log('\n因目标命令不在注册表而未采用（需人工确认）:')
    for (const d of droppedForMissingCommand) console.log('  ' + d)
  }
  console.log('\n已删除的能力类目（本项目无对应注册命令）:')
  for (const r of removedConcepts) console.log('  - ' + r)
}
