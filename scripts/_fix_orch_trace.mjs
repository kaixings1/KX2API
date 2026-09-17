import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/orchestrator/orchestrator.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

// onTraceStart 是可选回调，调用结果类型为 string | undefined；
// 而 onTraceEnd 要求 traceId: string。原代码直接传 traceId（可能 undefined）。
// 语义上「没有开启 trace 就没有 traceId」，因此只在拿到 traceId 时才回调。
const re1 =
  /      this\.deps\.onTraceEnd\?\.\(traceId, result\.summary \?\? '', \[`mode:\$\{this\.config\.mode\}`\]\)/

if (!re1.test(s)) {
  console.log('未命中 onTraceEnd 调用')
  process.exit(1)
}

s = s.replace(
  re1,
  '      if (traceId) {' + NL +
  "        this.deps.onTraceEnd?.(traceId, result.summary ?? '', [`mode:${this.config.mode}`])" + NL +
  '      }',
)

const re2 = /      this\.deps\.onTraceFail\?\.\(traceId, errMsg\)/
if (!re2.test(s)) {
  console.log('未命中 onTraceFail 调用')
  process.exit(1)
}
s = s.replace(re2, '      if (traceId) this.deps.onTraceFail?.(traceId, errMsg)')

writeFileSync(p, s)
console.log('已改: ' + p)
