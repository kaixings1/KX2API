import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/codeExplainer.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// Bun.file() 是 Bun 运行时专有 API；本项目跑在 Electron(内置 Node) 上，
// 该调用在运行时必然抛 "Bun is not defined"（类型检查也报 TS2868）。
// 改用 Node 的 fs/promises，行为一致（读取为 UTF-8 文本）。
const re =
  /export async function readFileContent\(filePath: string\): Promise<string> \{\r?\n  try \{\r?\n    const content = await Bun\.file\(filePath\)\.text\(\)\r?\n    return content\r?\n  \} catch \{\r?\n    return ''\r?\n  \}\r?\n\}/

if (!re.test(s)) {
  console.log('未命中 readFileContent')
  process.exit(1)
}

s = s.replace(
  re,
  [
    'export async function readFileContent(filePath: string): Promise<string> {',
    '  try {',
    '    // 用 Node 的 fs/promises：本项目运行在 Electron 内置 Node 上，',
    '    // 不存在 Bun 运行时（原 Bun.file(...).text() 会直接抛 "Bun is not defined"）。',
    "    return await readFile(filePath, 'utf-8')",
    '  } catch {',
    "    return ''",
    '  }',
    '}',
  ].join(NL),
)

// 补导入（放在文件首个 import 处；该文件顶部若无 import，则插在首行注释块之后）
if (!s.includes("from 'node:fs/promises'")) {
  const lines = s.split(NL)
  // 找到注释块结束（第一个非注释、非空行）
  let insertAt = 0
  let inBlock = false
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.startsWith('/*')) inBlock = true
    if (inBlock && t.endsWith('*/')) { inBlock = false; insertAt = i + 1; continue }
    if (!inBlock && t.startsWith('//')) { insertAt = i + 1; continue }
    if (!inBlock && t === '') { insertAt = i + 1; continue }
    if (!inBlock && t !== '') { insertAt = i; break }
  }
  lines.splice(insertAt, 0, "import { readFile } from 'node:fs/promises'", '')
  s = lines.join(NL)
}

writeFileSync(p, s)
console.log('已改: ' + p)
