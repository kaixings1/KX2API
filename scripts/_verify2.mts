import http from 'node:http'
import axios from 'axios'

// 与修复版 client.ts 中一致的提取逻辑（复制过来验证行为）
function extractErrorBodyPreview(data: unknown): string {
  if (data === null || data === undefined) return '(空)'
  if (typeof data === 'string') return data.slice(0, 500)

  const maybeStream = data as {
    on?: unknown
    _readableState?: { buffer?: { head?: { data?: unknown; next?: unknown } } }
  }
  if (typeof maybeStream.on === 'function') {
    const parts: string[] = []
    let node = maybeStream._readableState?.buffer?.head
    let guard = 0
    while (node && guard++ < 20) {
      const chunk = node.data
      if (typeof chunk === 'string') parts.push(chunk)
      else if (chunk && typeof chunk === 'object' && 'toString' in chunk) parts.push(String(chunk))
      node = (node as { next?: typeof node }).next
    }
    const buffered = parts.join('')
    if (buffered) return buffered.slice(0, 500)
    return '[流式响应体：错误详情需从上游状态码判断]'
  }

  if (typeof data === 'object') {
    try {
      return JSON.stringify(data).slice(0, 500)
    } catch {
      return `[${(data as object).constructor?.name ?? '对象'}：无法序列化]`
    }
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
  await axios.post(
    `http://127.0.0.1:${port}/v1/chat/completions`,
    { a: 1 },
    { responseType: 'stream', timeout: 5000 },
  )
} catch (postError) {
  const err = postError as Error & { response?: { status?: number; data?: unknown } }
  console.log('=== 修复前（旧写法）===')
  try {
    console.log('  ' + `status=${err.response?.status ?? 'n/a'} body=${JSON.stringify(err.response?.data).slice(0, 500)}`)
  } catch (e) {
    console.log('  抛异常: ' + (e as Error).message.split('\n')[0])
  }

  console.log('\n=== 修复后（extractErrorBodyPreview）===')
  console.log(`  status=${err.response?.status ?? 'n/a'} body=${extractErrorBodyPreview(err.response?.data)}`)
}

server.close()
