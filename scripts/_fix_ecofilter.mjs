import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/ecoFilter.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// ESM 产物里 require 未定义 → tee 分支一旦执行就抛错（被 catch 静默吞掉，
// 表现为「eco 原始输出永远没落盘」，排查时完全无迹可寻）。改为静态导入。
const oldBlock = [
  '      const fs = require(\'fs\')',
  '      const path = require(\'path\')',
  '      const dir = path.dirname(teePath)',
].join(NL)

const oldBlockLF = oldBlock.replace(/\r\n/g, '\n')

if (!s.includes(oldBlock) && !s.includes(oldBlockLF)) {
  console.log('未命中 tee 块')
  process.exit(1)
}

s = s.replace(oldBlock, '      const dir = dirname(teePath)')
s = s.replace(oldBlockLF, '      const dir = dirname(teePath)')

// 补导入
if (!s.includes("from 'node:path'")) {
  const lines = s.split(NL)
  let insertAt = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      insertAt = i
      break
    }
    if (lines[i].trim() !== '' && !lines[i].startsWith('/') && !lines[i].startsWith('*') && !lines[i].startsWith('//')) {
      insertAt = i
      break
    }
  }
  lines.splice(insertAt, 0, "import { existsSync, mkdirSync, appendFileSync } from 'node:fs'", "import { dirname } from 'node:path'")
  s = lines.join(NL)
}

// fs. 前缀调用改为裸函数名
s = s.replace(/if \(!fs\.existsSync\(dir\)\) fs\.mkdirSync\(dir, \{ recursive: true \}\)/g, 'if (!existsSync(dir)) mkdirSync(dir, { recursive: true })')
s = s.replace(/fs\.appendFileSync\(teePath,/g, 'appendFileSync(teePath,')

writeFileSync(p, s)
console.log('已改: ' + p)
