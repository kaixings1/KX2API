import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/sandbox/index.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 1) 摘掉放错位置的常量块（它被插在 CommandFilterPolicy 之前，晚于使用点）
const constBlock = /\/\*\*\r?\n \* 沙箱默认放行的工具（两套写法都列出）。[\s\S]*?\n\]\r?\n\r?\n/

if (!constBlock.test(s)) {
  console.log('未找到常量块')
  process.exit(1)
}
s = s.replace(constBlock, '')

// 2) 放到 import 之后（第 19 行附近）
const anchor = "import { CommandFilter } from \"../../security/CommandFilter.ts\"\n"
const anchorCRLF = 'import { CommandFilter } from "../../security/CommandFilter.ts"\r\n'

const block = [
  '',
  '// ============ 默认放行名单 ============',
  '',
  '/**',
  ' * 沙箱默认放行的工具（**两套写法都列出**）。',
  ' *',
  ' * 历史写法（Bash/Read/ListFiles…）必须保留：用户已保存的配置与 hooks 里用的是它们；',
  ' * 注册名（bash/cat/ls…）也必须列出：**实际被调度执行**的是这些。',
  ' * 只列一套会导致另一套被误拒 —— 这正是本文件此前"危险命令拦截从未生效"的同源问题。',
  ' */',
  'export const DEFAULT_ALLOWED_TOOLS: string[] = [',
  "  'bash', 'Bash', 'cmd', 'shell',",
  "  'cat', 'Read', 'head', 'tail',",
  "  'ls', 'ListFiles', 'dir', 'tree',",
  "  'find', 'Glob', 'Grep', 'findstr',",
  "  'cp', 'mv', 'mkdir', 'Write', 'Edit',",
  ']',
  '',
].join(NL)

if (s.includes(anchor)) s = s.replace(anchor, anchor + block)
else if (s.includes(anchorCRLF)) s = s.replace(anchorCRLF, anchorCRLF + block)
else {
  console.log('未找到 import 锚点')
  process.exit(1)
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
