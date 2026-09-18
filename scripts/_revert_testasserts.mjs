import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  'src/__tests__/engine/permissionRules.test.ts',
  'src/__tests__/main/permissionConfig.test.ts',
]

const reverts = [
  // permissionRules.test.ts
  ["// Bash 是历史写法 → 归一化为注册名 bash\n    expect(permissionRuleValueFromString('Bash')).toEqual({ toolName: 'bash' })",
   "expect(permissionRuleValueFromString('Bash')).toEqual({ toolName: 'Bash' })"],
  ["expect(permissionRuleValueFromString('Bash()')).toEqual({ toolName: 'bash' })",
   "expect(permissionRuleValueFromString('Bash()')).toEqual({ toolName: 'Bash' })"],
  ["expect(permissionRuleValueFromString('Bash(*)')).toEqual({ toolName: 'bash' })",
   "expect(permissionRuleValueFromString('Bash(*)')).toEqual({ toolName: 'Bash' })"],
  ["// 历史写法归一化到本项目注册名\n    expect(normalizeLegacyToolName('Bash')).toBe('bash')",
   "expect(normalizeLegacyToolName('Bash')).toBe('Bash')"],
  // permissionConfig.test.ts
  ["    // 样例已改用注册命令名 bash（实际生效的工具名）；\n    // 同时校验旧的 Bash 写法经归一化后仍指向同一工具（老配置不失效）。\n    expect(askRules.some(r => r.value.toolName === 'bash')).toBe(true)\n    expect(normalizeLegacyToolName('Bash')).toBe('bash')",
   "    expect(askRules.some(r => r.value.toolName === 'bash')).toBe(true)"],
  ["    // 注册名是 cat；旧写法 Read 归一化后同样指向它\n    const readRule = rules.find(r => r.value.toolName === 'cat')",
   "    const readRule = rules.find(r => r.value.toolName === 'cat')"],
]

for (const p of files) {
  let s = readFileSync(p, 'utf-8')
  const before = s
  for (const [from, to] of reverts) {
    if (from === to) continue
    const fromCRLF = from.replace(/\n/g, '\r\n')
    const toCRLF = to.replace(/\n/g, '\r\n')
    if (s.includes(from)) s = s.replace(from, to)
    else if (s.includes(fromCRLF)) s = s.replace(fromCRLF, toCRLF)
  }
  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  } else {
    console.log('无改动: ' + p)
  }
}
