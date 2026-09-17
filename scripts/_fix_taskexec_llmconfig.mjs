import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/agent/task-executor.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// CommandRunner.execute 的第三参已改为 ApiConfig，其可选字段不接受显式 undefined。
// 这里用条件展开，只在有值时才带上 baseUrl/maxTokens。
const re =
  /  private toLlmConfig\(\) \{\r?\n    if \(!this\.llmConfig\) return undefined\r?\n    return \{\r?\n      provider: this\.llmConfig\.provider,\r?\n      apiKey: this\.llmConfig\.apiKey,\r?\n      model: this\.llmConfig\.model,\r?\n      baseUrl: this\.llmConfig\.baseUrl,\r?\n      maxTokens: this\.llmConfig\.maxTokens,\r?\n    \}\r?\n  \}/

if (!re.test(s)) {
  console.log('未命中 toLlmConfig')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  private toLlmConfig() {',
    '    if (!this.llmConfig) return undefined',
    '    const { provider, apiKey, model, baseUrl, maxTokens } = this.llmConfig',
    '    // 条件展开：ApiConfig 的可选字段不接受显式 undefined',
    '    return {',
    '      provider,',
    '      apiKey,',
    '      model,',
    '      ...(baseUrl ? { baseUrl } : {}),',
    '      ...(maxTokens !== undefined ? { maxTokens } : {}),',
    '    }',
    '  }',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
