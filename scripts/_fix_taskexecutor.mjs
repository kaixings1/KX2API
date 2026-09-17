import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/tasks/taskExecutor.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 第 31 行的 onEvent 类型写错了：参数写成了 TaskExecutorOptions['onEvent']（回调本身），
// 于是「把回调当事件传」——与 interface 里声明的形状完全不符（TS2322/TS2345）。
// 统一用同一份事件类型。
s = s.replace(
  "  readonly onEvent?: (event: TaskExecutorOptions['onEvent']) => void\n",
  "  readonly onEvent?: (event: AgentEvent & { logEntry: { time: number; event: string; detail?: string } }) => void\n",
)
s = s.replace(
  "  readonly onEvent?: (event: TaskExecutorOptions['onEvent']) => void\r\n",
  "  readonly onEvent?: (event: AgentEvent & { logEntry: { time: number; event: string; detail?: string } }) => void\r\n",
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
