import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/transformers/openai.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const pairs = [
  ['req.topP', 'req.top_p'],
  ['req.maxTokens', 'req.max_tokens'],
  ['req.presencePenalty', 'req.presence_penalty'],
  ['req.frequencyPenalty', 'req.frequency_penalty'],
  ['req.logitBias', 'req.logit_bias'],
  ['req.webSearch', 'req.web_search'],
  ['req.reasoningEffort', 'req.reasoning_effort'],
  ['req.toolChoice', 'req.tool_choice'],
]

for (const [from, to] of pairs) {
  // 只替换该文件中「对象属性访问」形式 req.xxx，且用词边界避免误伤已正确的 snake_case
  const re = new RegExp(from.replace('.', '\\.') + '(?!\\w)', 'g')
  s = s.replace(re, to)
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动: ' + p)
}
