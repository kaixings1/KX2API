import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/qwen.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const re = /interface ChatCompletionRequest \{\r?\n  model: string\r?\n/
if (!re.test(s)) {
  console.log('未命中')
  process.exit(1)
}
const crlf = /\r\n/.test(s)
const NL = crlf ? '\r\n' : '\n'
s = s.replace(
  re,
  'interface ChatCompletionRequest {' + NL +
  '  model: string' + NL +
  '  /** 映射前的原始模型名（forwarder 传入，用于特性检测） */' + NL +
  '  originalModel?: string' + NL,
)

writeFileSync(p, s)
console.log('已改: ' + p)
