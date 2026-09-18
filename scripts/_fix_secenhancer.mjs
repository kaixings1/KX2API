import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/securityEnhancer.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 同 sandbox：`tool.name === 'Bash'` 永不命中实际工具名 `bash`，
// 导致命令过滤（数据销毁/权限提升等拦截）形同虚设。
s = s.replace(
  "      if (cfg.filterCommands && tool.name === 'Bash') {",
  [
    '      // 用 isShellTool 取代 `tool.name === \'Bash\'`：实际工具名是注册命令 `bash`，',
    '      // 原判断永不命中 —— 命令过滤（数据销毁/权限提升等）因此从未生效。',
    '      if (cfg.filterCommands && isShellTool(tool.name)) {',
  ].join(NL),
)

s = s.replace(
  "        const fileTools = new Set(['Read', 'Edit', 'Write', 'MultiFileEdit', 'Glob', 'Grep'])\n        if (fileTools.has(tool.name)) {",
  '        // 概念归类取代硬编码名单：cat/ls/find/Read/Glob… 任意写法都能识别\n        if (isFileTool(tool.name)) {',
)
s = s.replace(
  "        const fileTools = new Set(['Read', 'Edit', 'Write', 'MultiFileEdit', 'Glob', 'Grep'])\r\n        if (fileTools.has(tool.name)) {",
  '        // 概念归类取代硬编码名单：cat/ls/find/Read/Glob… 任意写法都能识别\r\n        if (isFileTool(tool.name)) {',
)

// 补导入
if (!s.includes('isFileTool')) {
  console.log('警告：isFileTool 未出现，替换可能未生效')
} else if (!s.includes("from './toolNameCompat.ts'")) {
  const lines = s.split(NL)
  let lastImport = 0
  for (let i = 0; i < lines.length; i++) if (/^import\s/.test(lines[i])) lastImport = i
  lines.splice(lastImport + 1, 0, "import { isFileTool, isShellTool } from './toolNameCompat.ts'")
  s = lines.join(NL)
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
