import { readFileSync } from 'node:fs'

const runners = readFileSync('src/engine/agent/command-runners.ts', 'utf-8')
const regBlock = runners.slice(runners.indexOf('export const commandRunners'))
const keys = [...regBlock.matchAll(/^\s*\['([^']+)',/gm)].map(m => m[1])

console.log('=== commandRunners 注册的全部命令（' + keys.length + ' 个）===')
// 按 6 个一行输出，便于扫读
for (let i = 0; i < keys.length; i += 6) {
  console.log('  ' + keys.slice(i, i + 6).join(', '))
}
