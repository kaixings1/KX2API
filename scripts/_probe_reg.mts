/**
 * 核实：commandRegistry 与 commandRunners 是不是两套（导致 resolveToolName 查不到 bash）
 */
import { commandRegistry } from '../src/engine/commands/registry.ts'
import { commandRunners } from '../src/engine/agent/command-runners.ts'

const regNames = commandRegistry.getNames()
const runnerKeys = [...commandRunners.keys()]

console.log('commandRegistry 命令数:', regNames.length)
console.log('commandRunners 键数  :', runnerKeys.length)

console.log('\n--- commandRunners 有、但 commandRegistry 没有的（前 30）---')
const regSet = new Set(regNames)
const onlyRunners = runnerKeys.filter(k => !regSet.has(k))
console.log('共', onlyRunners.length, '个:')
console.log(onlyRunners.slice(0, 30).join(', '))

console.log('\n--- 关键命令逐个核对 ---')
for (const n of ['bash', 'ls', 'cat', 'dir', 'cmd', 'shell', 'find', 'grep', 'findstr', 'exec']) {
  const inReg = regSet.has(n)
  const inRunners = runnerKeys.includes(n)
  console.log(`${n.padEnd(10)} registry=${inReg ? '有' : '无'}  runners=${inRunners ? '有' : '无'}`)
}
