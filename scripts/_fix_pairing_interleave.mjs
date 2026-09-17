import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/messageLoop.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 根因：`Continuing to next iteration.` 这条 system 消息原先无条件插在
// 「assistant(含 tool_use) 已写入」之后、「tool 结果写入」之前，
// 把 assistant 的 tool_calls 与其 tool 结果隔开。上游据此报
//   400: tool calls and tool results do not match
// 修法：只在「本轮没有工具调用」时插入。有工具调用时，配对必须保持相邻，
// 该提示对模型也无意义（下一轮马上会带工具结果回来）。
const re =
  /    this\.deps\.conversation\.messages\.push\(\{\r?\n      role: "system",\r?\n      content: "Continuing to next iteration\.",\r?\n    \} as InternalMessage\);\r?\n\r?\n    if \(processed\.toolCalls\.length > 0\) \{/

if (!re.test(s)) {
  console.log('未命中 system 插入块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '    // 仅在「本轮没有工具调用」时插入续跑提示。',
    '    //',
    '    // 有工具调用时，assistant(含 tool_use) 必须与其 tool 结果**紧邻**，',
    '    // 中间插入任何消息都会被上游判为',
    '    //   400: tool calls and tool results do not match',
    '    // （该提示对模型也无价值：下一轮随即带回工具结果）。',
    '    if (processed.toolCalls.length === 0) {',
    '      this.deps.conversation.messages.push({',
    '        role: "system",',
    '        content: "Continuing to next iteration.",',
    '      } as InternalMessage);',
    '    }',
    '',
    '    if (processed.toolCalls.length > 0) {',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
