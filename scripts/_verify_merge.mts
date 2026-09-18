/**
 * 验证合并视图：bash 是否可用、shell 是否被真实现覆盖或排除。
 */
import { commandRegistry } from '../src/engine/commands/registry.ts'
import { commandRunners } from '../src/engine/agent/command-runners.ts'
import { getToolConcept } from '../src/engine/toolNameCompat.ts'
import { resolveToolName } from '../src/engine/toolNameResolver.ts'

const isStub = (execute: unknown) => {
  const src = String(execute)
  return /needsAgent\s*:\s*true/.test(src) || /需要\s*AI\s*执行/.test(src)
}

const BASE = [
  'pwd', 'ls', 'dir', 'tree', 'cat', 'find', 'findstr', 'grep', 'wc', 'head', 'tail',
  'bash', 'echo', 'date', 'env', 'ps', 'where',
  'git-status', 'git-diff', 'git-branch', 'git-log',
  'memory', 'config', 'cp', 'mv', 'mkdir', 'edit', 'read_file', 'write_file',
  'web_search', 'web_fetch',
]

const whitelistSet = new Set(BASE)
const concepts = new Set(BASE.map(n => getToolConcept(n)).filter(c => c !== 'unknown'))
for (const cmd of commandRegistry.getAll()) {
  const c = getToolConcept(cmd.name)
  if (c === 'unknown' || !concepts.has(c)) continue
  if (whitelistSet.has(cmd.name)) continue
  if (isStub(cmd.execute)) continue
  whitelistSet.add(cmd.name)
}

// 合并视图
const merged = new Map()
for (const cmd of commandRegistry.getAll()) {
  if (isStub(cmd.execute)) continue
  merged.set(cmd.name, cmd.description)
}
for (const [name, runner] of commandRunners) {
  merged.set(name, runner.description + ' [runners]')
}

const available = new Set([...merged.keys()].filter(n => whitelistSet.has(n)))
console.log('白名单:', whitelistSet.size, ' 合并可执行:', merged.size, ' 最终暴露:', available.size)
console.log('\n暴露的工具:', [...available].sort().join(', '))

async function resolveLike(name: string): Promise<string | null> {
  if (available.has(name)) return name
  let r: string | null = null
  try { r = await resolveToolName(name) } catch { r = null }
  if (r && available.has(r)) return r
  return null
}

console.log('\n=== 关键场景 ===')
for (const n of ['shell', 'cmd', 'bash', 'exec', 'dir', 'ls', 'grep', 'cat', 'cp', 'mv', 'wc']) {
  const r = await resolveLike(n)
  console.log(`${n.padEnd(12)} → ${r ? '✅ ' + r : '❌ 无效'}`)
}
