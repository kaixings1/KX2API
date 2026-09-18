import { readFileSync } from 'node:fs'

// 对比两套「工具名集合」：
//   A. shared.ts 的 TOOL_NAME_MAPPING 映射到的目标名（Claude Code 风格）
//   B. 本项目实际注册的命令名（commandRunners 的 key）
// 若两者交集很小，说明归一化方向错了 —— 归一化后得到的是"不存在的工具名"。

const shared = readFileSync('src/main/proxy/toolCalling/protocols/shared.ts', 'utf-8')
const mapBlock = shared.match(/export const TOOL_NAME_MAPPING[^{]*\{([\s\S]*?)\n\}/)
if (!mapBlock) {
  console.log('未找到 TOOL_NAME_MAPPING')
  process.exit(1)
}

// 解析 "k: 'V'," 形式
const pairs = [...mapBlock[1].matchAll(/([a-z_0-9]+)\s*:\s*'([^']+)'/g)].map(m => [m[1], m[2]])
const targets = new Set(pairs.map(p => p[1]))

// 读 commandRunners 的注册键
const runners = readFileSync('src/engine/agent/command-runners.ts', 'utf-8')
const mapStart = runners.indexOf('export const commandRunners')
const regBlock = runners.slice(mapStart)
const keys = [...regBlock.matchAll(/^\s*\['([^']+)',/gm)].map(m => m[1])

console.log(`TOOL_NAME_MAPPING 条目: ${pairs.length}，映射目标名 ${targets.size} 个:`)
console.log('  ' + [...targets].sort().join(', '))
console.log(`\ncommandRunners 注册命令: ${keys.length} 个`)
console.log('  ' + keys.slice(0, 40).join(', ') + (keys.length > 40 ? ' …' : ''))

const targetArr = [...targets]
const inRegistry = targetArr.filter(t => keys.includes(t))
const notInRegistry = targetArr.filter(t => !keys.includes(t))

console.log(`\n映射目标名中，真正存在于注册表的: ${inRegistry.length}/${targetArr.length}  ${JSON.stringify(inRegistry)}`)
console.log(`映射目标名中，注册表里【没有】的: ${notInRegistry.length} 个`)
console.log('  ' + notInRegistry.join(', '))
