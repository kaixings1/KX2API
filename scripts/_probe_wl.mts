/**
 * 摸清白名单与 registry 的关系：
 *   1. 白名单里每个名字在 registry 里是否存在（不存在 = 拼错或已删）
 *   2. registry 里「与白名单条目同概念」的命令有哪些（这些应一起进白名单）
 */
import { commandRegistry } from '../src/engine/commands/registry.ts'
import { getToolConcept, getToolNameVariants } from '../src/engine/toolNameCompat.ts'

const WL = [
  'pwd', 'ls', 'dir', 'find', 'findstr', 'grep', 'cat', 'tree', 'echo',
  'date', 'env', 'ps', 'where', 'git-status', 'git-diff', 'git-branch', 'git-log',
  'memory', 'config', 'read_file', 'write_file', 'edit', 'bash', 'glob', 'web_search', 'web_fetch',
]

const regNames = commandRegistry.getNames()
const regSet = new Set(regNames)

console.log('白名单条目:', WL.length, ' registry 命令:', regNames.length)
console.log('\n=== 白名单逐项核对 ===')
const missing = []
for (const n of WL) {
  const inReg = regSet.has(n)
  if (!inReg) missing.push(n)
  console.log(`${n.padEnd(14)} registry=${inReg ? '有' : '无'}  概念=${getToolConcept(n)}`)
}
console.log('\n白名单里 registry 不存在的（这些永远匹配不到）:', missing.length ? missing.join(', ') : '无')

console.log('\n=== registry 里与白名单「同概念」但未入白名单的命令 ===')
const wlConcepts = new Set(WL.map(n => getToolConcept(n)).filter(c => c !== 'unknown'))
const extra = []
for (const n of regNames) {
  const c = getToolConcept(n)
  if (c !== 'unknown' && wlConcepts.has(c) && !WL.includes(n)) extra.push(`${n}(${c})`)
}
console.log('共', extra.length, '个:')
console.log(extra.slice(0, 40).join(', '))
