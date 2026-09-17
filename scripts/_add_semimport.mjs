import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/semanticSearch.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 该文件原本没有任何 import（靠 require('fs') 就地取）。
// 改为静态导入 node:fs —— ESM 产物里 require 未定义，原写法一旦被调用即抛错。
const anchor = '// ============================================================================' + NL + '// Types' + NL + '// ============================================================================'

if (!s.includes(anchor)) {
  console.log('未命中 Types 注释块')
  process.exit(1)
}

s = s.replace(
  anchor,
  [
    "import { existsSync } from 'node:fs'",
    "import * as fs from 'node:fs'",
    '',
    anchor,
  ].join(NL),
)

// 上一步把 `this.indexFileNow(require('fs'), ...)` 改成了 fsModule，统一为 fs
s = s.replace('this.indexFileNow(fsModule, ', 'this.indexFileNow(fs, ')

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
