import { readFileSync, writeFileSync } from 'node:fs'

const p = 'tests/engine/legacy/broken/engine.test.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 两条断言基于旧 API，经实测（scripts/_api_probe.mts）确认：
//   1) getConfig() 现在**不再暴露 apiKey** —— 只返回 model/provider/maxOutputTokens/systemPrompt。
//      这是安全性改进（引擎配置不应外泄密钥），不是缺陷。
//   2) getHistory() 直接返回**消息数组**，不再包一层 { messages: [] }。
// 因此更新断言以匹配当前 API，并保留原意（校验形状而非具体值）。
s = s.replace(
  "  assert(typeof config.apiKey === 'string', 'apiKey is string')",
  [
    '  // 注意：getConfig() 有意**不暴露 apiKey**（引擎配置不应外泄密钥），',
    '  // 故这里改为校验它确实不在返回结构里 —— 防止将来有人把密钥又塞回来。',
    "  assert(!('apiKey' in config), 'getConfig() 不暴露 apiKey（安全性约束）')",
    "  assert(typeof config.systemPrompt === 'string', 'systemPrompt is string')",
  ].join(NL),
)

s = s.replace(
  "  const history = engine.getHistory()\n  assert(Array.isArray(history.messages), 'getHistory returns messages array')",
  [
    '  const history = engine.getHistory()',
    '  // getHistory() 现直接返回消息数组（不再包一层 { messages }）',
    "  assert(Array.isArray(history), 'getHistory returns messages array')",
  ].join(NL),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('未命中断言')
}
