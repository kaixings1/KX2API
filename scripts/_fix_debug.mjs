import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/utils/debug.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// 移除对不存在模块的依赖。
//
// 原写法 `import { getSessionId } from '../engine/bootstrap/state.js'` 有两重问题：
//   1. 路径多一层：本文件在 src/engine/utils/，`../engine/` 解析成 src/engine/engine/；
//   2. 目标模块 `bootstrap/state.ts` **根本不存在**（bootstrap 下只有
//      index/macro/setup 三个文件）。
// 同项目的 src/engine/transcript.ts 注释已明确记录该依赖的处置方式：
//   「依赖替换：getSessionId()（Claude Code bootstrap）→ 显式传入 sessionId」
// 本模块是孤儿（无任何引用方），此处按同一方向处理：不引入外部依赖，
// 改由本模块自己生成一个进程级会话标识 —— 保持"每次运行一份日志文件"的原语义。
s = s.replace(
  "import { getSessionId } from '../engine/bootstrap/state.js'\n",
  '',
)
s = s.replace(
  "import { getSessionId } from '../engine/bootstrap/state.js'\r\n",
  '',
)

// 插入本地会话标识
const anchor = "export type DebugLogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'"
if (!s.includes(anchor)) {
  console.log('未命中 DebugLogLevel 锚点')
  process.exit(1)
}

s = s.replace(
  anchor,
  [
    '/**',
    ' * 进程级会话标识，用于隔离每次运行的调试日志文件。',
    ' *',
    ' * 原先取自 `bootstrap/state` 的 getSessionId()，但该模块在移植时并未落地',
    ' *（bootstrap 下只有 index/macro/setup）。同项目 transcript.ts 已给出处置方向：',
    ' * 不依赖外部会话管理，由需要方自行持有标识。故此处本地生成。',
    ' */',
    'const PROCESS_SESSION_ID = `${Date.now().toString(36)}-${process.pid}`',
    '',
    '/** 取本次进程的调试会话标识 */',
    'function getSessionId(): string {',
    '  return PROCESS_SESSION_ID',
    '}',
    '',
    anchor,
  ].join(NL),
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
