import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/protocols/shared.ts'
const s = readFileSync(p, 'utf-8')
const NL = s.includes('\r\n') ? '\r\n' : '\n'

const lines = s.split(NL)
const idx = lines.findIndex(l => l.includes('t.startsWith(') && l.includes('tool_calls') && l.includes('return true'))
if (idx < 0) {
  console.log('未命中 startsWith 行')
  process.exit(1)
}
console.log('命中第', idx + 1, '行:', JSON.stringify(lines[idx]))

const indent = lines[idx].match(/^\s*/)[0]

// 用字符拼接构造，彻底避免手抄 '[{' / '[{{' 出错
const OPEN_BRACE = "'" + '{' + "'"
const OPEN_BRACKET_BRACE = "'[" + '{' + "'"
const conditionLine =
  indent + 'if (t.startsWith(' + OPEN_BRACE + ') || t.startsWith(\'[tool_calls]\') || t.startsWith(' + OPEN_BRACKET_BRACE + ')) {'

const replacement = [
  indent + '// 以 `{` / `[{` 开头**不再**直接判定为工具调用：',
  indent + '//',
  indent + '// 本函数的语义是「这是流式传输中的中间态，先别把它当正文输出」。',
  indent + '// 但原实现对 `{` 一刀切，把「已完整闭合的 JSON 工具调用」也判成中间态，',
  indent + '// 而调用方（extractToolCallsFromText）见到 true 就**直接返回空结果** ——',
  indent + '// 于是正文与工具调用**双双丢失**，静默失败。',
  indent + '//',
  indent + '// 实测（tools/core-harness）：',
  indent + '//   {"name": "ls", "arguments": {"path": "."}}',
  indent + '//   → { content: "", toolCalls: [], protocol: "unknown" }',
  indent + '//',
  indent + '// 现在只有「配平不完整 / 解析不成功」才算中间态；完整 JSON 交回提取器处理。',
  conditionLine,
  indent + '  return !isCompleteJsonValue(t)',
  indent + '}',
].join(NL)

lines.splice(idx, 1, replacement)
writeFileSync(p, lines.join(NL))
console.log('已改: ' + p)
console.log('新行:', conditionLine)
