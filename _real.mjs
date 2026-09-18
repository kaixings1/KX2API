import { getToolConcept } from './src/engine/toolNameCompat.ts'

const BASE = ['pwd','ls','dir','tree','cat','find','findstr','grep','wc','head','tail','bash','echo','date','env','ps','where','git-status','git-diff','git-branch','git-log','memory','config','cp','mv','mkdir','edit','read_file','write_file','web_search','web_fetch']

const known = new Set()
for (const n of BASE) {
  const c = getToolConcept(n)
  if (c !== 'unknown') known.add(c)
}
console.log('基础名单涵盖的概念:', [...known].join(', '))

// 模拟：registry 里所有命令名 → 哪些会被概念派生
const { commandRegistry } = await import('./src/engine/commands/registry.ts')
const all = commandRegistry.getAll()
console.log(`\nregistry 命令总数: ${all.length}`)

const isStub = (execute) => {
  const s = String(execute)
  return /needsAgent\s*:\s*true/.test(s) || /需要\s*AI\s*执行/.test(s)
}

const derived = []
const skippedStubs = []
for (const cmd of all) {
  const c = getToolConcept(cmd.name)
  if (c === 'unknown' || !known.has(c)) continue
  if (BASE.includes(cmd.name)) continue
  if (isStub(cmd.execute)) { skippedStubs.push(cmd.name); continue }
  derived.push(`${cmd.name}(${c})`)
}
console.log(`\n会被派生的命令 (${derived.length}):`)
console.log('  ' + derived.join(', '))
console.log(`\n被跳过的同概念桩 (${skippedStubs.length}):`)
console.log('  ' + skippedStubs.join(', '))
