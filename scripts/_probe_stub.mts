/**
 * 摸清 registry 里有多少「桩命令」：execute 直接返回 needsAgent / 不真正执行。
 */
import { commandRegistry } from '../src/engine/commands/registry.ts'
import { commandRunners } from '../src/engine/agent/command-runners.ts'

const all = commandRegistry.getAll()
const runnerKeys = new Set([...commandRunners.keys()])

const stubs: string[] = []
const real: string[] = []

for (const cmd of all) {
  const src = String(cmd.execute)
  // 桩的典型特征：函数体里直接返回 needsAgent，或包含"需要 AI 执行"这类文案
  const isStub = /needsAgent\s*:\s*true/.test(src) || /需要\s*AI\s*执行/.test(src)
  if (isStub) stubs.push(cmd.name)
  else real.push(cmd.name)
}

console.log('registry 命令总数:', all.length)
console.log('其中桩命令（needsAgent / 需 AI 执行）:', stubs.length)
console.log('有真实实现:', real.length)

console.log('\n=== 桩命令（前 40）===')
console.log(stubs.slice(0, 40).join(', '))
if (stubs.length > 40) console.log(`… 其余 ${stubs.length - 40} 个`)

console.log('\n=== 桩命令里也存在于 commandRunners 的（说明有真实现可用）===')
const stubWithRealImpl = stubs.filter(s => runnerKeys.has(s))
console.log('共', stubWithRealImpl.length, '个:', stubWithRealImpl.join(', ') || '(无)')

console.log('\n=== 关键：白名单涉及的名字里哪些是桩 ===')
const wl = [
  'pwd', 'ls', 'dir', 'tree', 'cat', 'find', 'findstr', 'grep', 'wc', 'head', 'tail',
  'bash', 'echo', 'date', 'env', 'ps', 'where',
  'git-status', 'git-diff', 'git-branch', 'git-log',
  'memory', 'config', 'cp', 'mv', 'mkdir', 'edit', 'read_file', 'write_file',
  'web_search', 'web_fetch', 'shell', 'cmd',
]
for (const n of wl) {
  const cmd = commandRegistry.get(n)
  if (!cmd) { console.log(`${n.padEnd(14)} registry 无`); continue }
  const src = String(cmd.execute)
  const isStub = /needsAgent\s*:\s*true/.test(src) || /需要\s*AI\s*执行/.test(src)
  console.log(`${n.padEnd(14)} ${isStub ? '⚠ 桩' : '✓ 真实现'}  runners=${runnerKeys.has(n) ? '有' : '无'}`)
}
