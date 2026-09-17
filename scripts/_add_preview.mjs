import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/api/client.ts'
let s = readFileSync(p, 'utf-8')
const before = s

const anchor = 'let requestCounter = 0\r\n'
const anchorLF = 'let requestCounter = 0\n'

const helper = [
  'let requestCounter = 0',
  '',
  '/**',
  ' * 从 axios 错误里安全取出「响应正文预览」。',
  ' *',
  ' * 为什么不能直接 JSON.stringify：',
  ' * - `responseType: "stream"` 时 `err.response.data` 是活的 IncomingMessage，',
  ' *   它经 `Socket._httpMessage` ↔ `ClientRequest.socket` 形成循环引用，',
  ' *   `JSON.stringify` 会抛 TypeError，**把原始错误替换掉**，真实失败原因丢失。',
  ' * - 因此这里按类型分支：字符串直接用；流对象读其已缓冲的 chunk（错误响应体通常很短，',
  ' *   已随响应头一起到达）；其余情况退化为构造器名/普通描述。',
  ' */',
  'function extractErrorBodyPreview(data: unknown): string {',
  '  if (data === null || data === undefined) return \'(空)\'',
  "  if (typeof data === 'string') return data.slice(0, 500)",
  '',
  '  // 流对象：尝试同步读取已到达的内容（不 await，避免日志路径阻塞）',
  '  const maybeStream = data as {',
  '    on?: unknown',
  '    readableEnded?: boolean',
  '    readableLength?: number',
  '    _readableState?: { buffer?: { head?: { data?: unknown } } }',
  '  }',
  "  if (typeof maybeStream.on === 'function') {",
  '    // IncomingMessage 会把已收到的数据暂存在 _readableState.buffer 链上',
  '    const parts: string[] = []',
  '    let node = maybeStream._readableState?.buffer?.head',
  '    let guard = 0',
  '    while (node && guard++ < 20) {',
  '      const chunk = node.data',
  '      if (typeof chunk === \'string\') parts.push(chunk)',
  "      else if (chunk && typeof chunk === 'object' && 'toString' in chunk) parts.push(String(chunk))",
  '      node = (node as { next?: typeof node }).next',
  '    }',
  '    const buffered = parts.join(\'\')',
  '    if (buffered) return buffered.slice(0, 500)',
  '    return \'[流式响应体：错误详情需从上游状态码判断]\'',
  '  }',
  '',
  '  // 普通对象：仅当可安全序列化时才序列化',
  '  if (typeof data === \'object\') {',
  '    try {',
  '      return JSON.stringify(data).slice(0, 500)',
  '    } catch {',
  '      return `[${(data as object).constructor?.name ?? \'对象\'}：无法序列化]`',
  '    }',
  '  }',
  '',
  '  return String(data).slice(0, 500)',
  '}',
  '',
].join('\r\n')

let used = null
if (s.includes(anchor)) used = anchor
else if (s.includes(anchorLF)) used = anchorLF

if (!used) {
  console.log('未命中 requestCounter 锚点')
  process.exit(1)
}

s = s.replace(used, used.includes('\r\n') ? helper : helper.replace(/\r\n/g, '\n'))

writeFileSync(p, s)
console.log('已改: ' + p)
