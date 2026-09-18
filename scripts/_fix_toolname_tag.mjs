import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/toolCallExtractor.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 缺口：pattern 8 只认 `<name>`，而 engine-bridge 的 BASE_SYSTEM_PROMPT
// 教模型输出的是 `<toolName>`（大写 N）。一字之差 → 格式不匹配 → 落到兜底
// 逻辑后把**标签名本身** "ToolName" 当成了工具名，参数也被包成
// {"arguments":"<path>.</path>..."} 而不是解析成 { path, showHidden }。
//
// 这正是「注入协议与解析器必须同源」这条不变量的破坏点：
//   注入的是 <tool_call><toolName>ls</toolName><arguments>…</arguments></tool_call>
//   解析却只认 <name>
// 用 core-harness 实测可复现：
//   name 期望 "ls"，实际 "ToolName"
const anchor = '    // 9. <function_calls> 包裹的调用'

if (!s.includes(anchor)) {
  console.log('未命中 pattern 9 锚点')
  process.exit(1)
}

const inserted = [
  '    // 8b. <tool_call><toolName>…</toolName><arguments>…</arguments></tool_call>',
  '    //',
  '    // 与 pattern 8 的区别只在标签名：<toolName> vs <name>。',
  '    // 这是 engine-bridge.ts BASE_SYSTEM_PROMPT 明确教给模型的格式',
  '    // （见其「工具调用协议」段），必须与注入端同源，否则调用必被误解析。',
  '    const toolCallToolName = /<tool_call>\\s*<tool_?name>([^<]+)<\\/tool_?name>\\s*<arguments>([\\s\\S]*?)<\\/arguments>\\s*<\\/tool_call>/i.exec(text);',
  '    if (toolCallToolName) {',
  '      const name = toolCallToolName[1].trim();',
  '      const argsStr = toolCallToolName[2].trim();',
  '      const parsedArgs = tryParseJSON(argsStr);',
  '      // <arguments> 内多为 <key>value</key> 子标签；JSON 解析失败时按子标签抽取',
  '      let args: unknown = parsedArgs;',
  '      if (args === null || args === undefined) {',
  '        const params: Record<string, string> = {};',
  '        const paramRegex = /<([a-zA-Z0-9_]+)>([\\s\\S]*?)<\\/\\1>/gi;',
  '        let pm: RegExpExecArray | null;',
  '        while ((pm = paramRegex.exec(argsStr)) !== null) {',
  '          params[pm[1]] = pm[2].trim();',
  '        }',
  '        args = Object.keys(params).length > 0 ? params : argsStr;',
  '      }',
  '      return { name, args, confidence: \'high\', rawText: toolCallToolName[0], end: toolCallToolName.index + toolCallToolName[0].length };',
  '    }',
  '',
  anchor,
].join(NL)

s = s.replace(anchor, inserted)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
