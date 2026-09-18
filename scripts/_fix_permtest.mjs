import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/__tests__/main/permissionConfig.test.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 样例配置已改用注册命令名（bash/cat/ls/find）—— 它们才是实际生效的工具名。
// 断言随之更新，并补一条「旧的 Claude 风格名仍能被归一化命中」，
// 确保老用户升级后规则不会突然失效。
s = s.replace(
  "    expect(askRules.some(r => r.value.toolName === 'Bash')).toBe(true)",
  [
    '    // 样例已改用注册命令名 bash（实际生效的工具名）；',
    '    // 同时校验旧的 Bash 写法经归一化后仍指向同一工具（老配置不失效）。',
    "    expect(askRules.some(r => r.value.toolName === 'bash')).toBe(true)",
    "    expect(normalizeLegacyToolName('Bash')).toBe('bash')",
  ].join(NL),
)

s = s.replace(
  "    const readRule = rules.find(r => r.value.toolName === 'Read')",
  "    // 注册名是 cat；旧写法 Read 归一化后同样指向它\n    const readRule = rules.find(r => r.value.toolName === 'cat')",
)

// 确认 normalizeLegacyToolName 已导入
if (!s.includes('normalizeLegacyToolName')) {
  console.log('注意：测试未导入 normalizeLegacyToolName')
} else if (!/import[\s\S]*?normalizeLegacyToolName/.test(s)) {
  // 从 permissionRules 导入
  s = s.replace(
    /^(import[\s\S]*?from '.*permissionRules')(\r?\n)/m,
    "$1\nimport { normalizeLegacyToolName } from '../../engine/permissions/permissionRules'" + NL,
  )
}

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
