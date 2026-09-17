import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/glm.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const CRLF = s.includes('\r\n')
const NL = CRLF ? '\r\n' : '\n'

// 上一步 lastIndexOf 删错了位置：删掉的是另一处（1071 附近）的 flushChunks 声明，
// 导致该处 flushChunks 未定义（TS2304）。此处恢复它，并修正被带歪的缩进。
const broken =
  '            const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)' + NL +
  '                  for (const outChunk of flushChunks) {' + NL

if (!s.includes(broken)) {
  console.log('未命中损坏块')
  process.exit(1)
}

const fixed =
  '            const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)' + NL +
  '            const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []' + NL +
  '            for (const outChunk of flushChunks) {' + NL

s = s.replace(broken, fixed)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
