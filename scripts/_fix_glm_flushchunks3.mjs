import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/glm.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const CRLF = s.includes('\r\n')
const NL = CRLF ? '\r\n' : '\n'

// 删掉遗留在原位置（日志分支之后）的重复声明两行
const dup =
  '      const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)' + NL +
  '      const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []' + NL

const count = s.split(dup).length - 1
if (count !== 2) {
  console.log(`预期出现 2 次，实际 ${count} 次，中止`)
  process.exit(1)
}

// 只删第 2 次出现（保留前面提前声明的那份）
const idx = s.lastIndexOf(dup)
s = s.slice(0, idx) + s.slice(idx + dup.length)

if (s !== before) {
  writeFileSync(p, s)
  console.log('已改: ' + p)
}
