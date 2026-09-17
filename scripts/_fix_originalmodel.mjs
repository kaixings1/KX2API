import { readFileSync, writeFileSync } from 'node:fs'

// 各适配器本地声明的 ChatCompletionRequest 漏了 originalModel，
// 但 forwarder 会把「映射前的原始模型名」传进来用于特性检测（web search / thinking）。
// proxy/types.ts 的 ChatCompletionRequest 里已有该字段，这里补齐本地声明。
const targets = [
  'src/main/proxy/adapters/kimi.ts',
]

const line = '  /** 映射前的原始模型名（forwarder 传入，用于特性检测） */\r\n'
const lineLF = '  /** 映射前的原始模型名（forwarder 传入，用于特性检测） */\n'

for (const p of targets) {
  let s = readFileSync(p, 'utf-8')
  const before = s

  const crlf = /interface ChatCompletionRequest \{\r?\n(  model: string\r?\n)/
  const m = crlf.exec(s)
  if (!m) {
    console.log('未命中: ' + p)
    continue
  }
  const useCRLF = m[0].includes('\r\n')
  s = s.replace(crlf, (full) => full + (useCRLF ? line : lineLF) + (useCRLF ? '  originalModel?: string\r\n' : '  originalModel?: string\n'))

  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  }
}
