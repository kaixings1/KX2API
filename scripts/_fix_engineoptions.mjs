import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/index.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 用不含中文的锚点，避免注释里可能存在的编码异常影响匹配
const re = /  subagents\?: Array<\{ name: string; description: string \}>;\r?\n\}/

if (!re.test(s)) {
  console.log('未命中 subagents 行')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '  subagents?: Array<{ name: string; description: string }>;',
    '  /**',
    '   * 图片上下文预算：控制 history 中 base64 图片的保留量。',
    '   * 由 main 层经 readImageBudgetConfig() 从用户配置读出后注入。',
    '   */',
    '  imageBudget?: import("../shared/types").ImageBudgetConfig;',
    '}',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
