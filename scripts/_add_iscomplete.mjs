import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/protocols/shared.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

const anchor = 'export function tryRepairIncompleteJsonObject(text: string): unknown | null {'
if (!s.includes(anchor)) {
  console.log('未命中锚点')
  process.exit(1)
}

if (s.includes('function isCompleteJsonValue')) {
  console.log('已存在 isCompleteJsonValue，跳过')
  process.exit(0)
}

const fn = [
  '/**',
  ' * 判断一段文本是否为「完整且可解析」的 JSON 值。',
  ' *',
  ' * 用途：把「中间态（还没传完的半截 JSON）」与「完整结构」区分开。',
  ' *   - 中间态：既不能当正文输出，也不能当工具调用（否则会泄露半截 JSON 或被误执行）',
  ' *   - 完整结构：应当正常交给提取器处理',
  ' *',
  ' * 判据：括号配平（跳过字符串字面量与转义）+ JSON.parse 成功。',
  ' * 只看配平不够 —— 形如 {"a":1,} 是配平的但非法，同样不该被当作可提取结构。',
  ' */',
  'function isCompleteJsonValue(text: string): boolean {',
  '  const t = text.trim()',
  '  const first = t[0]',
  "  if (first !== '{' && first !== '[') return false",
  '',
  '  // 括号配平扫描：跳过字符串字面量与转义字符',
  '  let depth = 0',
  '  let inString = false',
  '  let escaped = false',
  '  for (const ch of t) {',
  '    if (escaped) {',
  '      escaped = false',
  '      continue',
  '    }',
  "    if (ch === '\\\\') {",
  '      if (inString) escaped = true',
  '      continue',
  '    }',
  "    if (ch === '\"') {",
  '      inString = !inString',
  '      continue',
  '    }',
  '    if (inString) continue',
  "    if (ch === '{' || ch === '[') depth++",
  "    else if (ch === '}' || ch === ']') {",
  '      depth--',
  '      if (depth < 0) return false',
  '    }',
  '  }',
  '  if (depth !== 0 || inString) return false',
  '',
  '  try {',
  '    JSON.parse(t)',
  '    return true',
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  anchor,
].join(NL)

s = s.replace(anchor, fn)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
