import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/api/client.ts'
let s = readFileSync(p, 'utf-8')
const before = s

// 同步读 _readableState.buffer 取不到内容（axios 内部已持有读取端）。
// 实测：对流做一次异步读取可以拿到完整错误正文（响应体很小，代价可忽略）。
const start = s.indexOf('function extractErrorBodyPreview(data: unknown): string {'.replace('data: unknown): string', 'data: unknown): Promise<string>'))
// 上面的 indexOf 必然失败，改用标记定位
const marker = '/**\n * 从 axios 错误里安全取出「响应正文预览」。'
const startIdx = s.includes(marker)
  ? s.indexOf(marker)
  : s.indexOf(marker.replace(/\n/g, '\r\n'))

if (startIdx < 0) {
  console.log('未命中辅助函数注释锚点')
  process.exit(1)
}

// 该函数的结束位置：下一个顶层 `\n\n` 之后的 `export async function sendMessageStream`
const endMarker = 'export async function sendMessageStream('
const endIdx = s.indexOf(endMarker, startIdx)
if (endIdx < 0) {
  console.log('未命中 sendMessageStream 锚点')
  process.exit(1)
}

const CRLF = s.includes('\r\n')
const NL = CRLF ? '\r\n' : '\n'

const newFn = [
  '/**',
  ' * 从 axios 错误里安全取出「响应正文预览」。',
  ' *',
  ' * 为什么不能直接 JSON.stringify：',
  ' * - `responseType: "stream"` 时 `err.response.data` 是活的 IncomingMessage，',
  ' *   它经 `Socket._httpMessage` ↔ `ClientRequest.socket` 形成循环引用，',
  ' *   `JSON.stringify` 会抛 TypeError，**把原始错误替换掉**，真实失败原因丢失。',
  ' *',
  ' * 为什么是 async：',
  ' * - 流对象上同步读 `_readableState.buffer` 取不到内容（读取端已被 axios 持有），',
  ' *   必须做一次异步读取。错误响应体通常只有几十字节，代价可忽略；',
  ' *   读不到就退化为提示文案，绝不让日志本身抛错。',
  ' */',
  'async function extractErrorBodyPreview(data: unknown): Promise<string> {',
  "  if (data === null || data === undefined) return '(空)'",
  "  if (typeof data === 'string') return data.slice(0, 500)",
  '',
  '  const maybeStream = data as {',
  '    on?: unknown',
  '    destroy?: () => void',
  '  }',
  "  if (typeof maybeStream.on === 'function') {",
  '    try {',
  '      const text = await new Promise<string>((resolve) => {',
  '        const chunks: Buffer[] = []',
  "        const timer = setTimeout(() => resolve(''), 1500)",
  "        const stream = data as NodeJS.EventEmitter & { on: (e: string, cb: (c?: unknown) => void) => void }",
  "        stream.on('data', (c) => { if (c) chunks.push(Buffer.from(c as Buffer)) })",
  "        stream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')) })",
  "        stream.on('error', () => { clearTimeout(timer); resolve('') })",
  '      })',
  "      if (text) return text.slice(0, 500)",
  '    } catch {',
  '      // 读取失败不影响主流程：下面的兜底文案同样能表达「有错误、详情在流里」',
  '    }',
  "    return '[流式响应体：未能读取错误详情，请参考上游状态码]'",
  '  }',
  '',
  '  // 普通对象：仅当可安全序列化时才序列化',
  "  if (typeof data === 'object') {",
  '    try {',
  '      return JSON.stringify(data).slice(0, 500)',
  '    } catch {',
  "      return `[${(data as object).constructor?.name ?? '对象'}：无法序列化]`",
  '    }',
  '  }',
  '',
  '  return String(data).slice(0, 500)',
  '}',
  '',
  '',
].join(NL)

s = s.slice(0, startIdx) + newFn + s.slice(endIdx)

// 调用点补 await
s = s.replace(
  'const bodyPreview = extractErrorBodyPreview(rawBody)',
  'const bodyPreview = await extractErrorBodyPreview(rawBody)',
)

writeFileSync(p, s)
console.log('已改: ' + p)
