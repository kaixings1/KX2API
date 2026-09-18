/**
 * 验证 B 方案：白名单从概念派生后，`shell` 是否自动进入可用工具集。
 */
import { commandRegistry } from '../src/engine/commands/registry.ts'
import { getToolConcept } from '../src/engine/toolNameCompat.ts'
import { resolveToolName } from '../src/engine/toolNameResolver.ts'

const BASE = [
  'pwd', 'ls', 'dir', 'tree', 'cat', 'find', 'findstr', 'grep', 'wc', 'head', 'tail',
  'bash', 'echo', 'date', 'env', 'ps', 'where',
  'git-status', 'git-diff', 'git-branch', 'git-log',
  'memory', 'config', 'cp', 'mv', 'mkdir', 'edit', 'read_file', 'write_file',
  'web_search', 'web_fetch',
]

const wlSet = new Set(BASE)
const concepts = new Set(BASE.map(n => getToolConcept(n)).filter(c => c !== 'unknown'))
const derived: string[] = []
for (const cmd of commandRegistry.getAll()) {
  const c = getToolConcept(cmd.name)
  if (c === 'unknown' || !concepts.has(c)) continue
  if (wlSet.has(cmd.name)) continue
  wlSet.add(cmd.name)
  derived.push(cmd.name)
}

console.log('基础名单:', BASE.length, '条')
console.log('概念派生并入:', derived.length, '条 →', derived.join(', ') || '(无)')
console.log('最终白名单:', wlSet.size, '条')

// 模拟 messageLoop 的判定：白名单 ∩ registry 即 availableTools
const available = new Set([...wlSet].filter(n => commandRegistry.get(n)))
console.log('实际可用的工具数:', available.size)

async function resolveLike(name: string): Promise<string | null> {
  if (available.has(name)) return name
  let r: string | null = null
  try { r = await resolveToolName(name) } catch { r = null }
  if (r && available.has(r)) return r
  return null
}

console.log('\n=== 关键场景 ===')
for (const n of ['shell', 'cmd', 'powershell', 'bash', 'dir', 'ls', 'grep', 'findstr', 'find', 'cat']) {
  const r = await resolveLike(n)
  console.log(`${n.padEnd(14)} → ${r ? '✅ ' + r : '❌ 仍无效'}`)
}
