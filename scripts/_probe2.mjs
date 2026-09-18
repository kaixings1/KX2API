import { readFileSync } from 'node:fs'

// 核心问题：项目里到底有几套「工具名」概念，各自是什么用途？
// 我要确认：注册命令名（ls）与 Claude 风格名（ListFiles）哪一侧才是"真正执行用的"。

const runners = readFileSync('src/engine/agent/command-runners.ts', 'utf-8')
const mapStart = runners.indexOf('export const commandRunners')
const regBlock = runners.slice(mapStart)
const keys = [...regBlock.matchAll(/^\s*\['([^']+)',/gm)].map(m => m[1])
console.log('commandRunners 注册名（执行侧真正使用的名字）:', keys.length, '个')
console.log('  样例:', keys.slice(0, 20).join(', '))

// toolNameResolver 的别名表方向
const resolverPath = 'src/engine/toolNameResolver.ts'
let t = readFileSync(resolverPath, 'utf-8')
console.log('\n--- toolNameResolver.ts 中的别名表方向 ---')
const aliasBlock = t.match(/TOOL_ALIASES[\s\S]*?\n\}/)
if (aliasBlock) {
  const pairs = [...aliasBlock[0].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)].map(m => `${m[1]} → ${m[2]}`)
  console.log('共', pairs.length, '条，样例:')
  console.log('  ' + pairs.slice(0, 25).join('\n  '))
}

// 判定：别名表的"目标值"是否都落在注册名集合里
if (aliasBlock) {
  const vals = [...aliasBlock[0].matchAll(/'[^']+'\s*:\s*'([^']+)'/g)].map(m => m[1])
  const uniq = [...new Set(vals)]
  const hit = uniq.filter(v => keys.includes(v))
  const miss = uniq.filter(v => !keys.includes(v))
  console.log(`\n别名目标值 ${uniq.length} 个：命中注册名 ${hit.length} 个，未命中 ${miss.length} 个`)
  if (miss.length) console.log('  未命中:', miss.join(', '))
}
