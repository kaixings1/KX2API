import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/renderer/src/components/settings/PermissionRulesSettings.tsx'
let s = readFileSync(p, 'utf-8')
const before = s

// 界面上的「常见规则模板」是给用户照着写的，必须用真实生效的工具名。
// 原用的是 Claude 风格名（Read/Glob/Grep/Bash），照抄不会命中任何工具。
const old = [
  '/** 常见规则模板：降低「不知道该写什么」的门槛 */',
  'const TEMPLATES: RuleEntry[] = [',
  "  { behavior: 'allow', rule: 'Read' },",
  "  { behavior: 'allow', rule: 'Glob' },",
  "  { behavior: 'allow', rule: 'Grep' },",
  "  { behavior: 'ask', rule: 'Bash(rm **)' },",
  "  { behavior: 'ask', rule: 'Bash(git push **)' },",
  "  { behavior: 'ask', rule: 'Bash(npm publish **)' },",
  ']',
].join('\n')

const neu = [
  '/**',
  ' * 常见规则模板：降低「不知道该写什么」的门槛。',
  ' *',
  ' * 注意：模板里的工具名必须是**注册命令名**（cat/ls/find/bash），',
  ' * 它们才是实际被调度执行的名字。早期模板写的是 Claude 风格名',
  ' *（Read/Glob/Grep/Bash），用户照抄后规则不会命中任何工具。',
  ' */',
  'const TEMPLATES: RuleEntry[] = [',
  "  { behavior: 'allow', rule: 'cat' },",
  "  { behavior: 'allow', rule: 'ls' },",
  "  { behavior: 'allow', rule: 'find' },",
  "  { behavior: 'ask', rule: 'bash(rm **)' },",
  "  { behavior: 'ask', rule: 'bash(git push **)' },",
  "  { behavior: 'ask', rule: 'bash(npm publish **)' },",
  ']',
].join('\n')

const oldCRLF = old.replace(/\n/g, '\r\n')
const neuCRLF = neu.replace(/\n/g, '\r\n')

if (s.includes(oldCRLF)) s = s.replace(oldCRLF, neuCRLF)
else if (s.includes(old)) s = s.replace(old, neu)
else console.log('未命中 TEMPLATES')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
