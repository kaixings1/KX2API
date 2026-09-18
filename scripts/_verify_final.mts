/**
 * 端到端验证：合并视图 + 概念兜底，是否让用户日志里的 `shell` 真正可执行。
 */
import { commandRegistry } from '../src/engine/commands/registry.ts'
import { commandRunners } from '../src/engine/agent/command-runners.ts'
import { getToolConcept, getToolNameVariants } from '../src/engine/toolNameCompat.ts'
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
const merged = new Map()
for (const cmd of commandRegistry.getAll()) {
  if (isStub(cmd.execute)) continue
  merged.set(cmd.name, cmd)
}
for (const [name, runner] of commandRunners) merged.set(name, runner)
const available = new Set([...merged.keys()].filter(n => whitelistSet.has(n)))

// 复刻 messageLoop 的完整判定链
function pickExecutableByConcept(requested: string, avail: Set<string>): string | null {
  if (!requested) return null
  for (const v of getToolNameVariants(requested)) if (avail.has(v)) return v
  const concept = getToolConcept(requested)
  const PREFERRED: Record<string, string[]> = {
    shell: ['bash', 'exec', 'sh'],
    list: ['ls', 'dir', 'tree'],
    read: ['cat', 'head', 'tail'],
    search: ['find', 'findstr', 'grep'],
    write: ['cp', 'mkdir', 'mv'],
    code: ['exec', 'bash'],
    web: ['search'],
  }
  for (const c of PREFERRED[concept] ?? []) if (avail.has(c)) return c
  return null
}

async function resolveLike(name: string): Promise<string | null> {
  if (available.has(name)) return name
  let r: string | null = null
  try { r = await resolveToolName(name) } catch { r = null }
  if (r && available.has(r)) return r
  return pickExecutableByConcept(name, available)
}

console.log('=== 用户日志场景（模型发 shell + args:["dir"]）===')
const r = await resolveLike('shell')
console.log(`shell → ${r ? '✅ ' + r + '（将执行 dir 命令）' : '❌ 仍无效'}`)

console.log('\n=== 全量核对 ===')
const cases = ['shell', 'cmd', 'powershell', 'bash', 'exec', 'dir', 'ls', 'grep', 'findstr',
  'find', 'cat', 'cp', 'mv', 'wc', 'head', 'tail', 'tree', 'pwd', 'echo', 'date', 'env', 'ps',
  'git-status', 'memory', 'config', '__nope__']
let ok = 0
for (const n of cases) {
  const got = await resolveLike(n)
  if (got) ok++
  console.log(`${n.padEnd(14)} → ${got ? '✅ ' + got : '❌ 无效'}`)
}
console.log(`\n${ok}/${cases.length} 可解析`)
