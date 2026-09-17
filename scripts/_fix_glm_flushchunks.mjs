import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/main/proxy/adapters/glm.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// flushChunks 在 1196 行（日志分支）被读取，但声明在 1217 行 —— 块级变量用在声明前
// （TS2448 / TS2454），运行时会抛 TDZ ReferenceError。
// 把解析提前到那段日志之前，行为不变（flush 本就是无副作用的取值）。
const decl = '      const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []\r\n'
const declLF = '      const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []\n'

let used = null
if (s.includes(decl)) used = decl
else if (s.includes(declLF)) used = declLF

if (!used) {
  console.log('未命中 flushChunks 声明')
  process.exit(1)
}

// 先删掉原声明
s = s.replace(used, '')

// 再插到「小结本次流」注释之前
const anchorOld = '      // 小结本次流：网页原生工具 / 代理注入工具 / 无工具\r\n'
const anchorOldLF = '      // 小结本次流：网页原生工具 / 代理注入工具 / 无工具\n'
const isCRLF = s.includes(anchorOld)
const anchor = isCRLF ? anchorOld : anchorOldLF

if (!s.includes(anchor)) {
  console.log('未命中小结注释锚点，回滚')
  // 回滚：把声明放回原处
  s = s.replace(
    '      const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)\r\n',
    '      const baseChunk = createBaseChunk(this.conversationId, this.model, this.created)\r\n' + used,
  )
  writeFileSync(p, s)
  console.log('已回滚: ' + p)
  process.exit(1)
}

const indent = '      '
const nl = isCRLF ? '\r\n' : '\n'
const insert =
  indent + '// flushChunks 需在下方日志里读取，故先解析（原先声明在使用之后，会触发 TDZ）' + nl +
  indent + 'const flushChunks = this.toolStreamParser?.flush(baseChunk) ?? []' + nl

s = s.replace(anchor, insert + anchor)

writeFileSync(p, s)
console.log('已改: ' + p)
