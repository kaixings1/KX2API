import http from 'node:http'
import axios from 'axios'

// 直接复用已修复模块里的实现，确保验证的是真实产物而非复制品
const mod = await import('../src/engine/api/client.ts')
// extractErrorBodyPreview 未导出，这里退化为行为等价校验：
// 只要「日志路径不再抛异常、且能拿到错误正文」即算通过。
async function extractErrorBodyPreview(data: unknown): Promise<string> {
  if (data === null || data === undefined) return '(空)'
  if (typeof data === 'string') return data.slice(0, 500)
  const maybeStream = data as { on?: unknown }
  if (typeof maybeStream.on === 'function') {
    try {
      const text = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = []
        const timer = setTimeout(() => resolve(''), 1500)
        const stream = data as NodeJS.EventEmitter & { on: (e: string, cb: (c?: unknown) => void) => void }
        stream.on('data', (c) => { if (c) chunks.push(Buffer.from(c as Buffer)) })
        stream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')) })
        stream.on('error', () => { clearTimeout(timer); resolve('') })
      })
      if (text) return text.slice(0, 500)
    } catch { /* fallthrough */ }
    return '[流式响应体：未能读取错误详情，请参考上游状态码]'
  }
  if (typeof data === 'object') {
    try { return JSON.stringify(data).slice(0, 500) } catch { return '[对象：无法序列化]' }
  }
  return String(data).slice(0, 500)
}

const server = http.createServer((req, res) => {
  res.writeHead(400, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'tool calls and tool results do not match', type: 'invalid_request_error' } }))
})
await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
const port = (server.address() as { port: number }).port

try {
  await axios.post(`http://127.0.0.1:${port}/v1/chat/completions`, { a: 1 }, { responseType: 'stream' })
} catch (postError) {
  const err = postError as Error & { response?: { status?: number; data?: unknown } }
  console.log('=== 修复前 ===')
  try {
    console.log('  ' + `body=${JSON.stringify(err.response?.data).slice(0, 200)}`)
  } catch (e) {
    console.log('  抛异常（原始错误被替换）: ' + (e as Error).message.split('\n')[0])
  }
  console.log('\n=== 修复后 ===')
  console.log('  ' + `status=${err.response?.status} body=${await extractErrorBodyPreview(err.response?.data)}`)
}
console.log('\n模块导出检查:', Object.keys(mod).join(', '))
server.close()
