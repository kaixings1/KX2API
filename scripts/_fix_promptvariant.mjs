import { readFileSync, writeFileSync } from 'node:fs'

const edits = [
  {
    p: 'src/main/proxy/adapters/prompt/BasePromptAdapter.ts',
    from: /  injected: boolean\r?\n  variant\?: PromptVariant\r?\n/,
    to: '  injected: boolean\n  /** 与 PromptAdapter.getPromptVariant 的约定一致：用 null 显式表示「无匹配变体」 */\n  variant?: PromptVariant | null\n',
  },
]

for (const e of edits) {
  let s = readFileSync(e.p, 'utf-8')
  const before = s
  if (!e.from.test(s)) {
    console.log('未命中: ' + e.p)
    continue
  }
  s = s.replace(e.from, e.to)
  if (s !== before) {
    writeFileSync(e.p, s)
    console.log('已改: ' + e.p)
  }
}
