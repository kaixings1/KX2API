import { readFileSync, writeFileSync } from 'node:fs'

// ChatCompletionResponse.usage 是 OpenAI 线格式（snake_case）
const p = 'src/main/proxy/adapters/transformers/openai.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const re =
  /    usage: resp\.usage \? \{\r?\n      promptTokens: resp\.usage\.prompt_tokens,\r?\n      completionTokens: resp\.usage\.completion_tokens,\r?\n      totalTokens: resp\.usage\.total_tokens,\r?\n    \} : undefined,/

if (!re.test(s)) {
  console.log('未命中 usage 块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '    usage: resp.usage',
    '      ? {',
    '          prompt_tokens: resp.usage.prompt_tokens,',
    '          completion_tokens: resp.usage.completion_tokens,',
    '          total_tokens: resp.usage.total_tokens,',
    '        }',
    '      : undefined,',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
