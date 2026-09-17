import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/messageIntegrity.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const start = s.indexOf('export function ensureToolResultPairing(')
const endMarker = '\nfunction findLastIndex<T>('
const end = s.indexOf(endMarker)

if (start < 0 || end < 0) {
  console.log('未定位到目标函数体')
  process.exit(1)
}

const newFn = [
  'export function ensureToolResultPairing(messages: InternalMessage[]): InternalMessage[] {',
  '  const out: InternalMessage[] = []',
  '',
  '  // ── Pass 1：清掉重复 tool_use，并按**出现顺序**收集本次 assistant 的 tool_use id ──',
  '  const seenToolUse = new Set<string>()',
  '',
  '  const pass1: InternalMessage[] = []',
  '  for (const msg of messages) {',
  '    if (!isAssistantWithToolUse(msg)) {',
  '      pass1.push(msg)',
  '      continue',
  '    }',
  '    const blocks = msg.content as Array<Record<string, unknown>>',
  '    const keptBlocks: Array<Record<string, unknown>> = []',
  '    for (const b of blocks) {',
  "      if (b && typeof b === 'object' && b.type === 'tool_use' && typeof b.id === 'string' && b.id) {",
  '        if (seenToolUse.has(b.id)) {',
  "          if (process.env.KX2_DEBUG_INTEGRITY === '1') {",
  '            console.warn(`[MessageIntegrity] 剥离重复 tool_use: ${b.id}`)',
  '          }',
  '          continue',
  '        }',
  '        seenToolUse.add(b.id)',
  '      }',
  '      keptBlocks.push(b)',
  '    }',
  '    // 所有块都被剥离后不能留空助手消息；补一个 text 占位保住角色序列',
  '    pass1.push(',
  '      keptBlocks.length > 0',
  '        ? { ...msg, content: keptBlocks }',
  "        : { ...msg, content: [{ type: 'text', text: EMPTY_MESSAGE_PLACEHOLDER }] },",
  '    )',
  '  }',
  '',
  '  // ── Pass 2：按「assistant → 其全部 tool 结果」重排 ──',
  '  //',
  '  // 原实现只做「剥离孤立 / 补占位」，完全不动顺序。而严格的 API 实现既要求',
  '  // 配对存在，也要求结果与对应 tool_use 保持相邻且顺序一致，否则报',
  '  //   400: tool calls and tool results do not match',
  '  // 常见触发场景：同一 assistant 的多个结果乱序、结果之间夹了 system 消息、',
  '  // 压缩后占位结果被追加到末尾。这里统一按 tool_use 的原始顺序收拢。',
  '  const resultById = new Map<string, InternalMessage>()',
  '  const groupless: InternalMessage[] = []',
  '',
  '  for (const msg of pass1) {',
  "    if (msg.role !== 'tool') {",
  '      groupless.push(msg)',
  '      continue',
  '    }',
  '    const id = msg.toolUseId',
  '    const known = typeof id === "string" && id.length > 0 && seenToolUse.has(id)',
  '    if (!known) {',
  "      if (process.env.KX2_DEBUG_INTEGRITY === '1') {",
  '        console.warn(`[MessageIntegrity] 剥离孤立 tool_result: ${String(id)}`)',
  '      }',
  '      continue',
  '    }',
  '    if (resultById.has(id)) {',
  "      if (process.env.KX2_DEBUG_INTEGRITY === '1') {",
  '        console.warn(`[MessageIntegrity] 剥离重复 tool_result: ${id}`)',
  '      }',
  '      continue',
  '    }',
  '    resultById.set(id, msg)',
  '  }',
  '',
  '  // 重建：遇到 assistant(tool_use) 时，立刻按顺序补上它的全部结果',
  '  for (const msg of groupless) {',
  '    if (!isAssistantWithToolUse(msg)) {',
  '      out.push(msg)',
  '      continue',
  '    }',
  '    out.push(msg)',
  '    for (const id of collectToolUseIds(msg)) {',
  '      const existing = resultById.get(id)',
  '      if (existing) {',
  '        out.push(existing)',
  '      } else {',
  '        // 缺失结果 → 补占位，且必须紧跟在对应的 tool_use 之后',
  '        out.push({',
  "          role: 'tool',",
  '          toolUseId: id,',
  '          content: SYNTHETIC_TOOL_RESULT_PLACEHOLDER,',
  '        })',
  '      }',
  '    }',
  '  }',
  '',
  '  return out',
  '}',
  '',
].join('\n')

s = s.slice(0, start) + newFn + s.slice(end + 1)

writeFileSync(p, s)
console.log('已改: ' + p)
