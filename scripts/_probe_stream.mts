import http from 'node:http'
import axios from 'axios'

const server = http.createServer((req, res) => {
  res.writeHead(400, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'tool calls and tool results do not match' } }))
})

await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
const port = (server.address() as { port: number }).port

try {
  await axios.post(`http://127.0.0.1:${port}/v1/chat/completions`, { a: 1 }, { responseType: 'stream' })
} catch (e) {
  const err = e as { response?: { data?: unknown } }
  const d = err.response?.data as {
    on?: unknown
    readableLength?: number
    readableEnded?: boolean
    _readableState?: Record<string, unknown>
  }
  console.log('构造器:', (d as { constructor?: { name: string } })?.constructor?.name)
  console.log('hasOn:', typeof d?.on)
  console.log('readableLength:', d?.readableLength)
  console.log('readableEnded:', d?.readableEnded)
  console.log('_readableState keys:', d?._readableState ? Object.keys(d._readableState).join(',') : 'none')
  console.log('buffer:', JSON.stringify(d?._readableState?.buffer))

  // 尝试异步读取
  if (typeof d?.on === 'function') {
    const chunks: Buffer[] = []
    const got = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve('(超时)'), 1500)
      d.on('data', (c: Buffer) => chunks.push(c))
      d.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')) })
      d.on('error', () => { clearTimeout(timer); resolve('(错误)') })
    })
    console.log('\n异步读取结果:', got)
  }
}

server.close()
