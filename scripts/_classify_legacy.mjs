import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 判定每个 legacy 测试用的是哪套框架：
//   - 导入 'vitest'           → 必须放 src/**/__tests__/（vitest 只收这里）
//   - 自带 process.exit/assert → 独立脚本型（按 CLAUDE.md 用 npx tsx 手动跑）
//   - 导入 'node:test'        → node:test，放 tests/ 顶层
const dir = 'tests/engine/legacy/broken'

for (const name of readdirSync(dir)) {
  if (!name.endsWith('.ts')) continue
  const txt = readFileSync(join(dir, name), 'utf-8')
  const kind = txt.includes("from 'vitest'") || txt.includes('from "vitest"')
    ? 'vitest'
    : txt.includes("from 'node:test'")
      ? 'node:test'
      : txt.includes('process.exit')
        ? '独立脚本'
        : '未知'
  console.log(`${name.padEnd(34)} ${kind}`)
}
