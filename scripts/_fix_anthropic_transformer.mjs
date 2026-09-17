import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/transformers/anthropic.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// internal ChatMessage（../../types）用 snake_case：tool_call_id
s = s.replace('tool_use_id: msg.toolCallId || \'\'', 'tool_use_id: msg.tool_call_id || \'\'')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
