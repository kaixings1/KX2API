import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/transformers/anthropic.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const re = /usage: resp\.usage \? \{\r?\n\s*promptTokens: resp\.usage\.input_tokens,\r?\n\s*completionTokens: resp\.usage\.output_tokens,\r?\n\s*totalTokens: resp\.usage\.input_tokens \+ resp\.usage\.output_tokens,\r?\n\s*\} : undefined,/

if (!re.test(s)) {
  console.log('未命中 usage 块')
  process.exit(1)
}

// ChatCompletionResponse.usage 是 OpenAI 线格式（snake_case）
s = s.replace(
  re,
  [
    'usage: resp.usage',
    '      ? {',
    '          prompt_tokens: resp.usage.input_tokens,',
    '          completion_tokens: resp.usage.output_tokens,',
    '          total_tokens: resp.usage.input_tokens + resp.usage.output_tokens,',
    '        }',
    '      : undefined,',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
