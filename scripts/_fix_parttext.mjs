import { readFileSync, writeFileSync } from 'node:fs'

// ChatMessageContent.text 是可选字段（text?: string），
// 直接 parts.push(part.text) 会把 string | undefined 塞进 string[]（TS2345）。
// 改成显式判空后再 push。
const targets = [
  'src/main/proxy/adapters/prompt/PromptAdapterRegistry.ts',
  'src/main/proxy/adapters/prompt/BasePromptAdapter.ts',
  'src/main/proxy/adapters/prompt/CherryStudioPromptAdapter.ts',
  'src/main/proxy/adapters/prompt/KiloCodePromptAdapter.ts',
]

const re = /(\s+)parts\.push\(part\.text\)/

for (const p of targets) {
  let s = readFileSync(p, 'utf-8')
  const before = s
  let count = 0
  s = s.replace(re, (m, indent) => {
    count++
    return `${indent}if (typeof part.text === 'string') parts.push(part.text)`
  })
  if (s !== before) {
    writeFileSync(p, s)
    console.log(`已改: ${p}（${count} 处）`)
  } else {
    console.log(`无改动: ${p}`)
  }
}
