import { readFileSync, writeFileSync } from 'node:fs'

// ── 1) 示例配置：改用真实生效的工具名 ──
{
  const p = 'src/main/permissions/permissionConfig.ts'
  let s = readFileSync(p, 'utf-8')
  const before = s

  const old = [
    '        // 只读类操作默认放行',
    "        { behavior: 'allow', rule: 'Read' },",
    "        { behavior: 'allow', rule: 'Glob' },",
    "        { behavior: 'allow', rule: 'Grep' },",
    '        // 危险命令每次询问（不是直接拒绝，用户仍可确认后执行）',
    "        { behavior: 'ask', rule: 'Bash(rm **)' },",
    "        { behavior: 'ask', rule: 'Bash(git push **)' },",
    "        { behavior: 'ask', rule: 'Bash(npm publish **)' },",
  ]

  const neu = [
    '        // 只读类操作默认放行。',
    '        // 注意：这里用的是**注册命令名**（cat/ls/find），与实际生效的工具名一致；',
    '        // 早期示例写的是 Claude 风格名（Read/Glob/Grep），照抄不会命中任何工具。',
    "        { behavior: 'allow', rule: 'cat' },",
    "        { behavior: 'allow', rule: 'ls' },",
    "        { behavior: 'allow', rule: 'find' },",
    '        // 危险命令每次询问（不是直接拒绝，用户仍可确认后执行）',
    "        { behavior: 'ask', rule: 'bash(rm **)' },",
    "        { behavior: 'ask', rule: 'bash(git push **)' },",
    "        { behavior: 'ask', rule: 'bash(npm publish **)' },",
  ]

  const oldCRLF = old.join('\r\n')
  const neuCRLF = neu.join('\r\n')

  if (s.includes(oldCRLF)) s = s.replace(oldCRLF, neuCRLF)
  else if (s.includes(old.join('\n'))) s = s.replace(old.join('\n'), neu.join('\n'))
  else console.log('permissionConfig 示例未命中')

  if (s !== before) {
    writeFileSync(p, s)
    console.log('已改: ' + p)
  }
}
