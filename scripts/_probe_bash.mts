import { commandRegistry } from '../src/engine/commands/registry.ts'
import { commandRunners } from '../src/engine/agent/command-runners.ts'
import { execaCommand } from '../src/engine/utils/exec.ts'

console.log('=== registry 里的 shell 系命令 ===')
for (const n of ['shell', 'cmd', 'bash', 'exec', 'powershell']) {
  const c = commandRegistry.get(n)
  console.log(`${n.padEnd(12)} ${c ? '有: ' + c.description.slice(0, 50) : '无'}`)
}

console.log('\n=== registry 里 shell 命令实际做什么 ===')
const shellCmd = commandRegistry.get('shell')
if (shellCmd) {
  console.log('description:', shellCmd.description)
  // 看它的 execute 源码大致形态
  console.log('execute:', String(shellCmd.execute).slice(0, 300))
}

console.log('\n=== commandRunners 里的 bash 实现 ===')
const bashRunner = commandRunners.get('bash')
if (bashRunner) {
  console.log('type:', bashRunner.type)
  console.log('description:', bashRunner.description)
}

console.log('\n=== 对比：两者是否等价 ===')
console.log('registry.get("shell") 存在:', !!commandRegistry.get('shell'))
console.log('commandRunners.get("bash") 存在:', !!commandRunners.get('bash'))
console.log('registry.get("bash") 存在:', !!commandRegistry.get('bash'))
console.log('commandRunners.get("shell") 存在:', !!commandRunners.get('shell'))
