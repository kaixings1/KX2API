import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/glm.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const CRLF = s.includes('\r\n')
const NL = CRLF ? '\r\n' : '\n'

// 1) 删掉我上一步插入的错误块（它引用了尚未声明的 baseChunk）
const bad =
  '      // flushChunks 需在下方日志里读取，故先解析（原先声明在使用之后，会触发 TDZ）' + NL +
  '      const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []' + NL
if (!s.includes(bad)) {
  console.log('未命中上一步的错误插入块')
  process.exit(1)
}
s = s.replace(bad, '')

// 2) 删掉原位置的两行（baseChunk + flushChunks 声明）
const orig =
  '      const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)' + NL +
  '      const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []' + NL
if (!s.includes(orig)) {
  console.log('未命中原始声明两行')
  process.exit(1)
}
s = s.replace(orig, '')

// 3) 在「小结本次流」注释之前，正确地把两行一起提前
const anchor = '      // 小结本次流：网页原生工具 / 代理注入工具 / 无工具' + NL
if (!s.includes(anchor)) {
  console.log('未命中小结锚点')
  process.exit(1)
}

const insert =
  '      // baseChunk / flushChunks 需在下方日志分支里读取，故先解析；' + NL +
  '      // 原实现把声明放在日志之后，会命中块级作用域 TDZ（TS2448/TS2454）。' + NL +
  '      const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)' + NL +
  '      const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []' + NL

s = s.replace(anchor, insert + anchor)

writeFileSync(p, s)
console.log('已改: ' + p)
