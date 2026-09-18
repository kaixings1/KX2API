import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/__tests__/engine/permissionRules.test.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 解析层本来就做「旧名归一化」（既有约定，如 Task → Agent）。
// 现在 Claude 风格名也纳入该表：Bash → bash、Read → cat、ListFiles → ls…
// 因此断言应从「保留原样」更新为「归一化到注册名」。
const pairs = [
  ["expect(permissionRuleValueFromString('Bash')).toEqual({ toolName: 'Bash' })",
   "// Bash 是历史写法 → 归一化为注册名 bash\n    expect(permissionRuleValueFromString('Bash')).toEqual({ toolName: 'bash' })"],
  ["expect(permissionRuleValueFromString('Bash()')).toEqual({ toolName: 'Bash' })",
   "expect(permissionRuleValueFromString('Bash()')).toEqual({ toolName: 'bash' })"],
  ["expect(permissionRuleValueFromString('Bash(*)')).toEqual({ toolName: 'Bash' })",
   "expect(permissionRuleValueFromString('Bash(*)')).toEqual({ toolName: 'bash' })"],
  ["expect(permissionRuleValueToString({ toolName: 'Bash' })).toBe('Bash')",
   "expect(permissionRuleValueToString({ toolName: 'Bash' })).toBe('Bash')"],
  ["expect(normalizeLegacyToolName('Bash')).toBe('Bash')",
   "// 历史写法归一化到本项目注册名\n    expect(normalizeLegacyToolName('Bash')).toBe('bash')"],
]

let n = 0
for (const [from, to] of pairs) {
  const c = s.split(from).length - 1
  if (c > 0 && from !== to) {
    s = s.split(from).join(to)
    n += c
  }
}

writeFileSync(p, s)
console.log(`已改: ${p}（${n} 处）`)
