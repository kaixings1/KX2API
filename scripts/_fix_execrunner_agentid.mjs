import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/agents/ExecutorRunner.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// event.agentId 是可选（AgentExecutionEvent 由多处产出），而 sendError 需要必填。
// sendEvent 本身是「把某个执行者的进展推给窗口」，有 agentId 才谈得上路由；
// 这里在入口统一收窄，缺失即不推送（避免把 undefined 当 agentId 发给渲染层）。
const re =
  /async function sendEvent\(event: AgentExecutionEvent\): Promise<void> \{\r?\n  if \(!mainWindow \|\| mainWindow\.isDestroyed\(\)\) return\r?\n/

if (!re.test(s)) {
  console.log('未命中 sendEvent 开头')
  process.exit(1)
}

s = s.replace(
  re,
  [
    'async function sendEvent(event: AgentExecutionEvent): Promise<void> {',
    '  if (!mainWindow || mainWindow.isDestroyed()) return',
    '  // agentId 是事件路由依据；缺失说明事件不由本执行器产生，直接忽略',
    '  if (!event.agentId) return',
    '',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
