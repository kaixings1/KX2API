import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/semanticSearch.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 6 处 `const fs = require('fs')` / `require('fs').xxx`：
// ESM 产物里 require 未定义 → 一旦该模块被接入运行链路就会抛 "require is not defined"
// （现由 try/catch 吞掉，表现为「索引永远加载/保存不了」）。
// 改用顶部静态导入 node:fs。
const n1 = (s.match(/const fs = require\('fs'\)/g) || []).length
s = s.replace(/\s*const fs = require\('fs'\)\r?\n/g, '\n')
s = s.replace(/require\('fs'\)\.existsSync\(([^)]*)\)/g, 'existsSync($1)')
s = s.replace(/this\.indexFileNow\(require\('fs'\), /g, 'this.indexFileNow(fsModule, ')

// 补导入（若尚未导入 fs）
if (!/import \* as fsModule from 'node:fs'/.test(s)) {
  s = s.replace(
    /^(import[\s\S]*?\r?\n)(?!import)/m,
    (m) => m + "import * as fsModule from 'node:fs'" + NL +
      "import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'" + NL,
  )
}

writeFileSync(p, s)
console.log(`已改: ${p}（移除 ${n1} 处 const fs = require）`)
