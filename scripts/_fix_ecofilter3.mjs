import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/ecoFilter.ts'
let s = readFileSync(p, 'utf-8')
const NL = s.includes('\r\n') ? '\r\n' : '\n'
const lines = s.split(NL)

// 前 8 行已被前面的脚本弄乱，直接重建注释块 + 导入段
const head = [
  '/**',
  ' * engine/ecoFilter.ts — Bash 输出压缩过滤器',
  ' *',
  ' * 在 Bash 输出发送给模型前，经过确定性过滤器管道压缩。',
  ' * 原始输出 tee 到 session 文件，确保可恢复。',
  ' *',
  ' * 注：tee 分支原先用 `require("fs")` 就地取模块 —— ESM 产物里没有 require，',
  ' * 该分支一旦执行即抛错（被 catch 静默吞掉，表现为"原始输出从未落盘"）。',
  ' * 现改为静态导入 node:fs。',
  ' */',
  '',
  "import { existsSync, mkdirSync, appendFileSync } from 'node:fs'",
  "import { dirname } from 'node:path'",
  '',
]

// 找到 export interface EcoStats 的位置，从那里接回
const idx = lines.findIndex(l => l.startsWith('export interface EcoStats'))
if (idx < 0) {
  console.log('未命中 EcoStats')
  process.exit(1)
}

const rest = lines.slice(idx)
writeFileSync(p, head.join(NL) + rest.join(NL))
console.log('已重建文件头: ' + p)
