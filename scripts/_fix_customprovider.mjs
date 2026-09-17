import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/engine-bridge.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// active.provider 的类型含 'custom'（自定义 OpenAI 兼容端点），
// 而 EngineOptions.provider 只接受 'anthropic' | 'openai'（TS2322）。
// 'custom' 走的就是 OpenAI 兼容协议，这里显式映射，避免类型不一致又保留行为。
const re = /        provider: active\.provider \|\| 'openai',/

if (!re.test(s)) {
  console.log('未命中 provider 赋值')
  process.exit(1)
}

s = s.replace(
  re,
  [
    "        // 'custom' 是自定义 OpenAI 兼容端点，协议上与 'openai' 同路",
    "        provider: active.provider === 'anthropic' ? 'anthropic' : 'openai',",
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
