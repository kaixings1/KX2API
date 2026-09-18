import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/toolCallExtractor.ts'
const s = readFileSync(p, 'utf-8')
const NL = s.includes('\r\n') ? '\r\n' : '\n'
const lines = s.split(NL)

// 定位 ruleSurgeTagXml 的函数体：从函数签名行开始，找到 `const match = pattern.exec(text)` 之后插入守卫
const sigIdx = lines.findIndex(l => l.includes('function ruleSurgeTagXml'))
if (sigIdx < 0) {
  console.log('未找到 ruleSurgeTagXml 签名')
  process.exit(1)
}

// 在其后 5 行内找 `const match = pattern.exec(text)`
let matchIdx = -1
for (let i = sigIdx; i < Math.min(sigIdx + 6, lines.length); i++) {
  if (lines[i].includes('const match = pattern.exec(text)')) {
    matchIdx = i
    break
  }
}
if (matchIdx < 0) {
  console.log('未找到 const match 行')
  process.exit(1)
}

console.log('签名行', sigIdx + 1, ':', lines[sigIdx].trim())
console.log('match 行', matchIdx + 1, ':', lines[matchIdx].trim())

const indent = lines[matchIdx].match(/^\s*/)[0]
const guard = [
  indent + '// 跳过「容器标签」：<toolName>/<name>/<arguments> 等是标准结构化格式的组成部件，',
  indent + '// 它们本身不是工具名。若在此把它们当工具名，会抢在结构化解析之前劫持标准格式',
  indent + '// （实测：<tool_call><toolName>ls</toolName>… 被解析成 name="ToolName"）。',
  indent + '// 这类文本应交给后面的 pattern 7 / 8 / 8b 处理。',
  indent + 'if (match && /^(tool_?name|name|arguments?|parameters?|input|args|params)$/i.test(match[1].trim())) {',
  indent + '  return null',
  indent + '}',
]

lines.splice(matchIdx + 1, 0, ...guard)
writeFileSync(p, lines.join(NL))
console.log('已插入守卫，共', guard.length, '行')
