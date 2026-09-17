import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/store/types.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// Account 上缺 lastStatusCheck，但 accounts.ts 与 ipc/handlers.ts 共 3 处都在写它
// （「最近一次状态检查时间」，用于展示/节流）。Provider 上已有同名字段，这里补齐 Account。
const re = /  \/\*\* Last used time \(timestamp\) \*\/\r?\n  lastUsed\?: number\r?\n/

if (!re.test(s)) {
  console.log('未命中 lastUsed')
  process.exit(1)
}

s = s.replace(
  re,
  (m) =>
    m +
    (m.includes('\r\n') ? '  /** Last status check time (timestamp) */\r\n  lastStatusCheck?: number\r\n' : '  /** Last status check time (timestamp) */\n  lastStatusCheck?: number\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
