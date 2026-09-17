import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/ipc/chat-handlers.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// RequestLogEntry.latency 是必填（number）。这两处是「请求刚进来」与「引擎配置
// 读取失败」的即时日志，此时尚无耗时可言，按 0 写入；后续成功路径仍由
// updateRequestLog 用真实测量值覆盖（见下方 forwarder 侧的 latency 写入）。
const re1 = /        chatNotes: '\[IPC\] Message received, forwarding to Engine',\r?\n/
const re2 = /(        status: 'error',\r?\n(?:.*\r?\n)*?        responseStatus: 500,\r?\n)/

if (!re1.test(s)) {
  console.log('未命中 pending 日志')
  process.exit(1)
}
s = s.replace(re1, "        chatNotes: '[IPC] Message received, forwarding to Engine',\n        // 请求刚开始，耗时未知；成功路径会用真实测量值更新\n        latency: 0,\n")

writeFileSync(p, s)
console.log('已改 pending 处: ' + p)
