import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/glm.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const CRLF = s.includes('\r\n')
const NL = CRLF ? '\r\n' : '\n'

// error 回调里也要 flush 残留 buffer，但 flushChunks 在它的作用域内未声明。
// 原地补一份（与 close 分支同构：先建 baseChunk，再 flush）。
const re =
  /      \/\/ Flush any remaining tool call buffer\r?\n      for \(const outChunk of flushChunks\) \{/

if (!re.test(s)) {
  console.log('未命中 error 分支 flush 块')
  process.exit(1)
}

s = s.replace(
  re,
  [
    '      // Flush any remaining tool call buffer',
    '      const flushChunks =',
    '        this.toolStreamParser?.flush(createBaseChunk(this.conversationId, this.model, this.created)) ?? []',
    '      for (const outChunk of flushChunks) {',
  ].join(NL),
)

writeFileSync(p, s)
console.log('已改: ' + p)
