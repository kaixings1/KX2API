/**
 * 量化「真实现缺口」：
 *   - runners 有真实现、但 registry 没有 → 永远无法通过 commandToolsToMap 暴露
 *   - registry 有、但 runners 没有（且非桩）→ 可以由 registry 直接执行
 */
import { commandRegistry } from '../src/engine/commands/registry.ts'
import { commandRunners } from '../src/engine/agent/command-runners.ts'

const regAll = commandRegistry.getAll()
const regSet = new Set(regAll.map(c => c.name))
const runnerKeys = new Set([...commandRunners.keys()])

const isStub = (execute: unknown) => {
  const src = String(execute)
  return /needsAgent\s*:\s*true/.test(src) || /需要\s*AI\s*执行/.test(src)
}

const regReal = new Set(regAll.filter(c => !isStub(c.execute)).map(c => c.name))
const regStub = new Set(regAll.filter(c => isStub(c.execute)).map(c => c.name))

console.log('registry 总数:', regAll.length, ' 真实现:', regReal.size, ' 桩:', regStub.size)
console.log('runners 总数:', runnerKeys.size)

const onlyRunners = [...runnerKeys].filter(k => !regSet.has(k))
console.log('\n=== 缺口①：runners 有真实现、registry 完全没有（' + onlyRunners.length + ' 个）===')
console.log(onlyRunners.join(', '))

const stubWithRunner = [...regStub].filter(k => runnerKeys.has(k))
console.log('\n=== 缺口②：registry 是桩、但 runners 有真实现（' + stubWithRunner.length + ' 个）===')
console.log(stubWithRunner.join(', '))
console.log('   ↑ 这些命令模型能"看到"（在白名单里），但执行时走的是 registry 的桩')
