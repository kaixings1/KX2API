import { readFileSync, writeFileSync } from 'node:fs'

// extractToolCallsFromText(text) 只接受 1 个参数（第二参 'default' 是无效实参），
// 且 ExtractedToolCall 没有 index 字段（只有 id/type/function/rawText/confidence）。
// 这里改为单参调用，并用 map 的序号补齐 index（ToolCall.index 可选）。
const targets = [
  'src/main/proxy/toolCalling/promptAdapters/DefaultPromptAdapter.ts',
  'src/main/proxy/toolCalling/promptAdapters/KiloCodePromptAdapter.ts',
  'src/main/proxy/toolCalling/promptAdapters/CherryStudioPromptAdapter.ts',
]

const reCall = /extractToolCallsFromText\(content, 'default'\)/g

const reMap =
  /toolCalls: toolCalls\.map\(tc => \(\{\r?\n(\s+)index: tc\.index,\r?\n(\s+)id: tc\.id,\r?\n(\s+)type: tc\.type,\r?\n(\s+)function: tc\.function,\r?\n(\s+)\}\)\)/

const reMap2 =
  /toolCalls = result\.toolCalls\.map\(tc => \(\{\r?\n(\s+)index: tc\.index,\r?\n(\s+)id: tc\.id,\r?\n(\s+)type: tc\.type,\r?\n(\s+)function: tc\.function,\r?\n(\s+)\}\)\)/

for (const p of targets) {
  let s = readFileSync(p, 'utf-8')
  const before = s

  s = s.replace(reCall, 'extractToolCallsFromText(content)')

  s = s.replace(reMap, (m, i1, i2, i3, i4, i5) =>
    [
      'toolCalls: toolCalls.map((tc, index) => ({',
      `${i1}index,`,
      `${i2}id: tc.id,`,
      `${i3}type: tc.type,`,
      `${i4}function: tc.function,`,
      `${i5}}))`,
    ].join('\n'),
  )

  s = s.replace(reMap2, (m, i1, i2, i3, i4, i5) =>
    [
      'toolCalls = result.toolCalls.map((tc, index) => ({',
      `${i1}index,`,
      `${i2}id: tc.id,`,
      `${i3}type: tc.type,`,
      `${i4}function: tc.function,`,
      `${i5}}))`,
    ].join('\n'),
  )

  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  } else {
    console.log('无改动: ' + p)
  }
}
