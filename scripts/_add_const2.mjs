import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/sandbox/index.ts'
let s = readFileSync(p, 'utf-8')
const NL = s.includes('\r\n') ? '\r\n' : '\n'
const lines = s.split(NL)

// 先确认是否真的没有「定义」（有 export const 才算定义）
const hasDef = lines.some(l => l.includes('export const DEFAULT_ALLOWED_TOOLS'))
if (hasDef) {
  console.log('已有定义，退出')
  process.exit(0)
}

// 插到最后一个 import 之后
let insertAt = 0
for (let i = 0; i < lines.length; i++) {
  if (/^import\s/.test(lines[i])) insertAt = i + 1
}
console.log('最后一个 import 在第', insertAt, '行:', lines[insertAt - 1])

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

// 顺手把 334 行残留的硬编码数组换成常量
let s2 = lines.join(NL)
s2 = s2.replace(
  "        allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],",
  '        allowedTools: DEFAULT_ALLOWED_TOOLS,',
)

writeFileSync(p, s2)
console.log('已插入常量')
