import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/perplexity.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// content 实际可能是多模态数组（下方 extractQuery 里有 Array.isArray 分支），
// 原类型只写 string | null，导致 Array.isArray 收窄为 never（TS2339）。
const r = /interface PerplexityMessage \{\r?\n  role: 'user' \| 'assistant' \| 'system' \| 'tool'\r?\n  content: string \| null\r?\n/
if (!r.test(s)) {
  console.log('未命中')
  process.exit(1)
}
s = s.replace(
  r,
  [
    'interface PerplexityMessage {',
    "  role: 'user' | 'assistant' | 'system' | 'tool'",
    '  /** 支持纯文本或多模态内容块（与 OpenAI 线格式一致） */',
    '  content: string | Array<{ type: string; text?: string }> | null',
    '',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
