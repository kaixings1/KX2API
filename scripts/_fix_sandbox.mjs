import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/sandbox/index.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// ── 1) 引入单一真源 ──
if (!s.includes("from '../toolNameCompat.ts'")) {
  // 插在第一个 import 之后
  const m = /^import[\s\S]*?\r?\n/m.exec(s)
  if (!m) {
    console.log('未找到 import 段')
    process.exit(1)
  }
  s = s.replace(m[0], m[0] + "import { isFileTool, isShellTool } from '../toolNameCompat.ts'" + NL)
}

// ── 2) 危险命令过滤：toolName === 'Bash' → isShellTool() ──
// 这是最严重的一处：实际工具名是 `bash`（小写），原判断永不命中，
// 导致 rm -rf 等 blockedPatterns 从未生效。
s = s.replace(
  "    if (toolName === 'Bash' && typeof input.command === 'string') {",
  [
    '    // 用 isShellTool 取代 `toolName === \'Bash\'`：',
    '    // 实际工具名是注册命令 `bash`（小写），原判断永不命中 ——',
    '    // 意味着危险命令拦截（rm -rf 等）从未真正生效过。',
    "    if (isShellTool(toolName) && typeof input.command === 'string') {",
  ].join(NL),
)

s = s.replace(
  '    // 只检查 Bash 工具\n    if (toolName !== \'Bash\') {',
  '    // 只检查「执行命令」类工具（bash / cmd / shell … 任意写法均可识别）\n    if (!isShellTool(toolName)) {',
)

// ── 3) 文件操作类工具集合：改用 isFileTool ──
s = s.replace(
  "    const fileTools = new Set(['Read', 'Write', 'Edit', 'MultiFileEdit', 'Glob', 'Grep'])\n    if (!fileTools.has(toolName)) {",
  '    // 用概念归类取代硬编码名单：cat/ls/find/Read/ListFiles… 任意写法都能识别\n    if (!isFileTool(toolName)) {',
)
s = s.replace(
  "    const fileTools = new Set(['Read', 'Write', 'Edit', 'MultiFileEdit', 'Glob', 'Grep'])\r\n    if (!fileTools.has(toolName)) {",
  '    // 用概念归类取代硬编码名单：cat/ls/find/Read/ListFiles… 任意写法都能识别\r\n    if (!isFileTool(toolName)) {',
)

// ── 4) 默认白名单：补上注册名，保留历史名（两套都放行，避免误拒） ──
s = s.replace(
  "constructor(allowedTools: string[] = ['Bash', 'Read', 'Edit', 'Write']) {",
  "constructor(allowedTools: string[] = DEFAULT_ALLOWED_TOOLS) {",
)
s = s.replace(
  "  allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],\n",
  '  allowedTools: DEFAULT_ALLOWED_TOOLS,\n',
)
s = s.replace(
  "  allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],\r\n",
  '  allowedTools: DEFAULT_ALLOWED_TOOLS,\r\n',
)

// 追加常量定义
if (!s.includes('DEFAULT_ALLOWED_TOOLS')) {
  const anchor = 'export class CommandFilterPolicy implements SandboxPolicy {'
  if (!s.includes(anchor)) {
    console.log('未命中 CommandFilterPolicy 锚点')
    process.exit(1)
  }
  s = s.replace(
    anchor,
    [
      '/**',
      ' * 沙箱默认放行的工具（两套写法都列出）。',
      ' *',
      ' * 保留历史写法（Bash/Read/…）是因为用户已保存的配置与 hooks 里用的是它们；',
      ' * 同时列出注册名（bash/cat/…）是因为**实际调度执行**用的是这些。',
      ' * 只列一套会导致另一套被误拒。',
      ' */',
      'export const DEFAULT_ALLOWED_TOOLS: string[] = [',
      "  'bash', 'Bash', 'cmd', 'shell',",
      "  'cat', 'Read', 'head', 'tail',",
      "  'ls', 'ListFiles', 'dir', 'tree',",
      "  'find', 'Glob', 'Grep', 'findstr',",
      "  'cp', 'mv', 'mkdir', 'Write', 'Edit',",
      ']',
      '',
      anchor,
    ].join(NL),
  )
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
