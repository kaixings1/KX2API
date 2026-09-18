import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/toolCallExtractor.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 根因：ruleSurgeTagXml 把 <tool_call> 后的**第一个子标签名**当成工具名：
//
//   /<tool_call>\s*<([a-zA-Z0-9_]+)>([\s\S]*)/i
//
// 而 BASE_SYSTEM_PROMPT 教给模型的标准格式是
//   <tool_call><toolName>ls</toolName><arguments>…</arguments></tool_call>
// 第一个子标签是 `toolName`（这是**工具名的容器标签**，不是工具名本身），
// 于是工具名被解析成 "ToolName"，参数也被当成剩下的整块文本。
//
// 更严重的是：这些「声明式意图」规则在 findToolCallInBuffer 里
// **先于**结构化 XML 解析（pattern 7/8/8b）执行，属于抢匹配 ——
// 标准格式因此永远走不到正确的分支。
//
// 修法（最小且安全）：让本规则跳过「工具名/参数的容器标签」。
// 这类标签出现时，说明文本是标准结构化格式，应交给后面的结构化解析处理。
const re =
  /function ruleSurgeTagXml\(text: string\): IntentMatch \| null \{\r?\n  const pattern = \/<tool_call>\\s\*<\(\[a-zA-Z0-9_\]+\)>\(\[\\s\\S\]\*\)\/i\r?\n  const match = pattern\.exec\(text\)/

if (!re.test(s)) {
  console.log('未命中 ruleSurgeTagXml')
  process.exit(1)
}

s = s.replace(
  re,
  [
    'function ruleSurgeTagXml(text: string): IntentMatch | null {',
    '  const pattern = /<tool_call>\\s*<([a-zA-Z0-9_]+)>([\\s\\S]*)/i',
    '  const match = pattern.exec(text)',
    '  // 跳过「容器标签」：<toolName>/<name>/<arguments> 等是标准结构化格式的组成部件，',
    '  // 它们本身不是工具名。若在此把它们当工具名，会抢在结构化解析之前劫持标准格式',
    '  // （实测：<tool_call><toolName>ls</toolName>… 被解析成 name="ToolName"）。',
    '  // 这类文本交给后面的 pattern 7 / 8 / 8b 处理。',
    '  if (match && /^(tool_?name|name|arguments?|parameters?|input|args|params)$/i.test(match[1].trim())) {',
    '    return null',
    '  }',
  ].join(NL),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
