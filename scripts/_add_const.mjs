import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/sandbox/index.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

if (s.includes('DEFAULT_ALLOWED_TOOLS')) {
  console.log('常量已存在，跳过')
  process.exit(0)
}

// 插在 import 段之后（CommandFilter 那行之后）
const lines = s.split(NL)
let insertAt = -1
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("from '../../security/CommandFilter.ts'") || lines[i].includes('from "../../security/CommandFilter.ts"')) {
    insertAt = i + 1
    break
  }
}
if (insertAt < 0) {
  console.log('未找到 CommandFilter import')
  process.exit(1)
}

const block = [
  '',
  '// ============ 默认放行名单 ============',
  '',
  '/**',
  ' * 沙箱默认放行的工具（**两套写法都列出**）。',
  ' *',
  ' * 历史写法（Bash/Read/ListFiles…）必须保留：用户已保存的配置与 hooks 用的是它们；',
  ' * 注册名（bash/cat/ls…）也必须列出：**实际被调度执行**的是这些。',
  ' * 只列一套会导致另一套被误拒 —— 与本文件"危险命令拦截因名不符而从未生效"同源。',
  ' */',
  'export const DEFAULT_ALLOWED_TOOLS: string[] = [',
  "  'bash', 'Bash', 'cmd', 'shell',",
  "  'cat', 'Read', 'head', 'tail',",
  "  'ls', 'ListFiles', 'dir', 'tree',",
  "  'find', 'Glob', 'Grep', 'findstr',",
  "  'cp', 'mv', 'mkdir', 'Write', 'Edit',",
  ']',
]

lines.splice(insertAt, 0, ...block)
writeFileSync(p, lines.join(NL))
console.log('已插入常量（第 ' + (insertAt + 1) + ' 行处）')
