import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/subagent/subAgentManager.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// traceId 是可选的（startTrace 可能还没执行到就抛错），而 failTrace 要求 string。
// 语义上「没有 tracer 就没有可失败的 trace」，故加存在性判断。
s = s.replace(
  '      this.failTrace(traceId, errMsg);',
  '      if (traceId) this.failTrace(traceId, errMsg);',
)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
} else {
  console.log('无改动')
}
