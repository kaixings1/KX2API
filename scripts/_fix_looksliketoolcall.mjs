import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/protocols/shared.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

/**
 * 原实现对「以 { 开头」一刀切返回 true：
 *
 *   if (t.startsWith('{') || t.startsWith('[tool_calls]') || t.startsWith('[{{')) return true
 *
 * 而 extractToolCallsFromText 见到 true 就**直接返回空结果**（不提取、也不保留正文）。
 * 设计本意是「别把流式传输中的**未完成** JSON 片段当正文泄露」，
 * 但一刀切把**已完整闭合的 JSON 工具调用**也一并丢弃 ——
 * 结果是「正文空、工具调用空」，两边都丢，静默失败。
 *
 * core-harness 实测：
 *   {"name": "ls", "arguments": {"path": "."}}
 *   → { content: "", toolCalls: [], protocol: "unknown" }
 *
 * 修法：区分「未完成」与「完整」——完整 JSON 交回提取器，半截才按中间态处理。
 */
const re =
  /  if \(t\.startsWith\('\{'\) \|\| t\.startsWith\('\[tool_calls\]'\) \|\| t\.startsWith\('\{\['\)\) return true/

if (!re.test(s)) {
  console.log('未命中 startsWith 行')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  // 以 `{` 开头**不再**直接判定为工具调用：',
    '  //',
    '  // 本函数的语义是「这是流式传输中的中间态、先别当正文输出」。但原实现',
    '  // 对 `{` 一刀切，把「已完整闭合的 JSON 工具调用」也判成中间态，',
    '  // 调用方（extractToolCallsFromText）据此直接返回空结果 ——',
    '  // 于是正文与工具调用**双双丢失**（静默失败）。',
    '  //',
    '  // 现在只有「配平不完整 / 解析不成功」才算中间态；完整 JSON 交给提取器处理。',
    "  if (t.startsWith('{') || t.startsWith('[tool_calls]')) {",
    '    return !isCompleteJsonValue(t)',
    '  }',
  ].join(NL),
)

// 追加判定辅助函数
const anchor = 'export function tryRepairIncompleteJsonObject(text: string): unknown | null {'
if (!s.includes(anchor)) {
  console.log('未命中 tryRepairIncompleteJsonObject 锚点')
  process.exit(1)
}

s = s.replace(
  anchor,
  [
    '/**',
    ' * 判断一段文本是否为「完整且可解析」的 JSON 值。',
    ' *',
    ' * 用于把「中间态（还没传完的半截 JSON）」与「完整结构」区分开：',
    ' * 前者不能被当正文输出、也不能当工具调用；后者应当正常被提取。',
    ' *',
    ' * 判据：括号配平（忽略字符串内的括号与转义）+ JSON.parse 成功。',
    ' * 只看配平不够 —— 形如 {"a":1,} 配平但非法，同样不该被当作可提取结构。',
    ' */',
    'function isCompleteJsonValue(text: string): boolean {',
    '  const t = text.trim()',
    "  if (!t || (t[0] !== '{' && t[0] !== '[')) return false",
    '',
    '  // 括号配平扫描：跳过字符串字面量与转义字符',
    '  let depth = 0',
    '  let inString = false',
    '  let escaped = false',
    '  for (const ch of t) {',
    '    if (escaped) { escaped = false; continue }',
    "    if (ch === '\\\\') { if (inString) escaped = true; continue }",
    '    if (ch === \'"\') { inString = !inString; continue }',
    '    if (inString) continue',
    "    if (ch === '{' || ch === '[') depth++",
    "    else if (ch === '}' || ch === ']') { depth--; if (depth < 0) return false }",
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
  ].join(NL),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
