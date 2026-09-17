/**
 * 验证：responseType:'stream' 的 axios 错误对象上做 JSON.stringify 会抛什么。
 * 用真实的本地 HTTP 服务返回 400 来复现，不依赖外部网络。
 */
import http from 'node:http'
import axios from 'axios'

const server = http.createServer((req, res) => {
  res.writeHead(400, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'tool calls and tool results do not match' } }))
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
  console.log('--- 原始错误 message:', err.message)
  console.log('--- err.response.data 构造器:', (err.response?.data as { constructor?: { name: string } })?.constructor?.name)

  console.log('\n[1] 复刻 client.ts:598 的日志写法：')
  try {
    const s = `status=${err.response?.status ?? 'n/a'} body=${JSON.stringify(err.response?.data).slice(0, 500)}`
    console.log('    OK ->', s.slice(0, 120))
  } catch (e) {
    console.log('    抛异常 ->', (e as Error).message.split('\n')[0])
    console.log('    ^^^ 这就是用户看到的 "Converting circular structure to JSON"')
  }

  console.log('\n[2] 安全写法（只看字符串/可序列化时）：')
  const d = err.response?.data
  console.log('    OK ->', typeof d === 'string' ? d.slice(0, 120) : `[${(d as object)?.constructor?.name}] 非字符串，跳过序列化`)
}

server.close()
