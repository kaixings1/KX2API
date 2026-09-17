import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/agent/task-executor.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// llmConfig.provider 写的是宽泛 string，而 ApiConfig.provider 是字面量联合
// （'anthropic' | 'openai' | 'custom'），传入时 TS2345。
// 让本类型直接复用 ApiConfig 的字段类型，保证两侧永远一致。
const re =
  /  llmConfig\?: \{\r?\n    provider: string\r?\n    apiKey: string\r?\n    model: string\r?\n    baseUrl\?: string\r?\n    maxTokens\?: number\r?\n  \}/

if (!re.test(s)) {
  console.log('未命中 llmConfig 声明')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  /** LLM 配置（用于 llm 类型子任务）；形状与 ApiConfig 对齐，避免两侧漂移 */',
    '  llmConfig?: {',
    "    provider: 'anthropic' | 'openai' | 'custom'",
    '    apiKey: string',
    '    model: string',
    '    baseUrl?: string',
    '    maxTokens?: number',
    '  }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
