import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/ipc/chat-handlers.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const re =
  /        chatNotes: '\[IPC\] Engine not ready',\r?\n        errorMessage: '引擎未初始化',\r?\n/

if (!re.test(s)) {
  console.log('未命中 error 日志')
  process.exit(1)
}

s = s.replace(
  re,
  "        chatNotes: '[IPC] Engine not ready',\n        errorMessage: '引擎未初始化',\n        // 引擎未初始化即失败，没有产生耗时\n        latency: 0,\n",
)

writeFileSync(p, s)
console.log('已改 error 处: ' + p)
