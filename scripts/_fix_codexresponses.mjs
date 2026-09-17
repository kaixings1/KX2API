import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/protocols/codexResponses.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// buildToolCall(...) 返回 ToolCall；此处 `const toolCalls = []` 没标类型，
// 又作为 createParseResult 的入参被推断，触发 TS7034 / TS7005（隐式 any[]）。
s = s.replace(
  '    const toolCalls = []\r\n',
  '    const toolCalls: ToolCall[] = []\r\n',
)
s = s.replace(
  '    const toolCalls = []\n',
  '    const toolCalls: ToolCall[] = []\n',
)

// 补 ToolCall 类型导入
if (!s.includes('ToolCall')) {
  s = s.replace(
    "import type { ToolProtocolAdapter } from './base.ts'",
    "import type { ToolCall } from '../types'\nimport type { ToolProtocolAdapter } from './base.ts'",
  )
} else if (!/import type \{[^}]*\bToolCall\b/.test(s)) {
  // 已有 ToolCall 用法但没导入
  if (!s.includes("import type { ToolCall }")) {
    s = s.replace(
      "import type { ToolProtocolAdapter } from './base.ts'",
      "import type { ToolCall } from '../types'\nimport type { ToolProtocolAdapter } from './base.ts'",
    )
  }
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
