import { readFileSync } from 'node:fs'

// 核实：项目里有几条「工具定义」来源？各自用什么名字体系？
// 目的：判断 Bash/Read/Write 这套名字是「残留」还是「另一套活的系统」。

const files = [
  ['commandRunners', 'src/engine/agent/command-runners.ts'],
  ['engine工具注册表', 'src/engine/index.ts'],
  ['权限规则', 'src/main/permissions/permissionConfig.ts'],
]

// 1) engine 的 ToolDefinition 是怎么来的
const idx = readFileSync('src/engine/index.ts', 'utf-8')
console.log('=== engine/index.ts 里 toolDefinitions 的来源 ===')
const lines = idx.split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('toolDefinitions') || lines[i].includes('registry')) {
    console.log(`${i + 1}: ${lines[i].trim().slice(0, 120)}`)
  }
}
