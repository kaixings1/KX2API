import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/stream.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// emitToolCalls 现为三参（第三参是 push 回调），此处调用漏传（TS2554）。
const re =
  /                  \/\/ We found complete tool calls!\r?\n                  emitToolCalls\(toolCalls, transformedData\)\r?\n/

if (!re.test(s)) {
  console.log('未命中调用点')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '                  // We found complete tool calls!',
    '                  emitToolCalls(toolCalls, transformedData, d => this.push(d))',
    '',
  ].join('\n'),
)

writeFileSync(p, s)
console.log('已改: ' + p)
