import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/toolCalling/promptAdapters/PromptAdapterRegistry.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// detect() 的返回类型是 `PromptAdapter | null`（注释也写明 "or null if unknown"），
// 但实现里返回的是 undefined。统一用 null：
s = s.replace(
  /    if \(!allContent\) \{\r?\n      return undefined\r?\n    \}/,
  '    if (!allContent) {\n      return null\n    }',
)
s = s.replace(
  /    if \(detectionResult\.clientType === 'unknown'\) \{\r?\n      return undefined\r?\n    \}/,
  "    if (detectionResult.clientType === 'unknown') {\n      return null\n    }",
)
// findAdapterByClientType 返回 undefined（Map.get），归一到 null
s = s.replace(
  /(\r?\n\s+return )adapter(\r?\n  \}\r?\n\r?\n  \/\*\*\r?\n   \* Check if any known client)/,
  '$1adapter ?? null$2',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
