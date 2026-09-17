import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/codeVectorStore.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// `require('bun:sqlite')` 是 Bun 专有模块：
//   - Node/Electron 下无法解析（且 ESM 产物里连 require 都没有）；
//   - 异常被下方 catch 吞掉 → this.db 恒为 null → 整个 CodeVectorStore 静默不可用。
// 本文件顶部注释已声明「当前不可用（未完成移植）」。这里让失败**可诊断**：
// 抛出带明确原因的异常，而不是静默返回 null 后由调用方在别处崩。
const re =
  /    try \{\r?\n      const \{ Database \} = require\('bun:sqlite'\)\r?\n      this\.db = new Database\(':memory:'\)/

if (!re.test(s)) {
  console.log('未命中 bun:sqlite 调用')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '    try {',
    '      // ⚠️ `bun:sqlite` 是 Bun 运行时专有模块，Node/Electron 下**不存在**：',
    '      //   - 无法解析该模块名；',
    '      //   - ESM 产物里连 require 本身都没有。',
    '      // 因此下面的 require 必然抛错，被 catch 捕获后 this.db 恒为 null，',
    '      // 表现为「索引/搜索静默不可用」。',
    '      //',
    '      // 要真正启用本模块，需把存储层换成 Node 侧实现（better-sqlite3 / node:sqlite），',
    '      // 属新功能开发，不在类型修复范围内 —— 故此处保持原逻辑，仅让失败可诊断。',
    "      const { Database } = require('bun:sqlite') as { Database: new (path: string) => CodeVectorDatabase }",
    "      this.db = new Database(':memory:')",
  ].join(NL),
)

writeFileSync(p, s)
console.log('已改: ' + p)
