/**
 * 复现 tool calls / tool results 不匹配的场景。
 * 用 tsx 直接跑： npx tsx scripts/_repro.mts
 */
import { ensureToolResultPairing } from '../src/engine/messageIntegrity.ts'

type M = { role: string; content: unknown; toolUseId?: string }

function show(label, msgs) {
  console.log('\n=== ' + label + ' ===')
  for (const m of msgs) {
    if (m.role === 'assistant' && Array.isArray(m.content)) {
      const kinds = m.content.map(b => b.type === 'tool_use' ? `tool_use(${b.id})` : b.type)
      console.log(`  assistant: [${kinds.join(', ')}]`)
    } else if (m.role === 'tool') {
      console.log(`  tool      : id=${m.toolUseId}`)
    } else {
      console.log(`  ${m.role}: ${String(m.content).slice(0, 40)}`)
    }
  }
}

// 场景 A：同一 assistant 有两个 tool_use，但只有一个有结果
const a = [
  { role: 'user', content: 'go' },
  { role: 'assistant', content: [
    { type: 'tool_use', id: 'call_1', name: 'ls', input: {} },
    { type: 'tool_use', id: 'call_2', name: 'pwd', input: {} },
  ] },
  { role: 'tool', toolUseId: 'call_2', content: 'ok2' },
]

// 场景 B：结果顺序与 call 顺序相反
const b = [
  { role: 'user', content: 'go' },
  { role: 'assistant', content: [
    { type: 'tool_use', id: 'call_1', name: 'ls', input: {} },
    { type: 'tool_use', id: 'call_2', name: 'pwd', input: {} },
  ] },
  { role: 'tool', toolUseId: 'call_2', content: 'ok2' },
  { role: 'tool', toolUseId: 'call_1', content: 'ok1' },
]

// 场景 C：assistant 有 tool_use，但结果被推到很后面（中间夹了 system）
const c = [
  { role: 'user', content: 'go' },
  { role: 'assistant', content: [{ type: 'tool_use', id: 'call_1', name: 'ls', input: {} }] },
  { role: 'system', content: 'Continuing to next iteration.' },
  { role: 'tool', toolUseId: 'call_1', content: 'ok1' },
]

for (const [label, msgs] of [['A 缺一半结果', a], ['B 顺序颠倒', b], ['C 中间夹 system', c]]) {
  show(label + ' 修复前', msgs)
  show(label + ' 修复后', ensureToolResultPairing(msgs))
}
