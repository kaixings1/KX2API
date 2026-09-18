/**
 * ModelScope API auth test
 *
 * 用法：MODELSCOPE_API_KEY=ms-xxx npx tsx src/engine/__tests__/modelscope-auth.test.ts
 *
 * ⚠️ 密钥从环境变量读取，**不要写死在源码里** —— 该文件受 git 跟踪，
 * 硬编码的 key 会永久留在仓库历史中（即使后来删除也仍可被检出）。
 */

import axios from 'axios'

const API_KEY = process.env.MODELSCOPE_API_KEY ?? ''
const BASE_URL = 'https://api-inference.modelscope.cn/v1/chat/completions'
const MODEL = 'deepseek-ai/DeepSeek-V4-Flash'

if (!API_KEY) {
  console.error('缺少 MODELSCOPE_API_KEY 环境变量；示例：')
  console.error('  MODELSCOPE_API_KEY=ms-xxx npx tsx src/engine/__tests__/modelscope-auth.test.ts')
  process.exit(1)
}

async function test() {
  const tests = [
    { name: 'Bearer token', headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } },
    { name: 'X-ModelScope-Token', headers: { 'X-ModelScope-Token': API_KEY, 'Content-Type': 'application/json' } },
    { name: 'token query param', url: `${BASE_URL}?token=${API_KEY}`, headers: { 'Content-Type': 'application/json' } },
  ]

  for (const t of tests) {
    console.log(`\n=== ${t.name} ===`)
    try {
      const url = t.url || BASE_URL
      const r = await axios.post(url, {
        model: MODEL, max_tokens: 10, stream: false,
        messages: [{ role: 'user', content: 'hi' }],
      }, { headers: t.headers, timeout: 15000 })
      console.log('OK:', r.status, JSON.stringify(r.data).slice(0, 200))
    } catch (e: any) {
      console.log('Failed:', e.response?.status, JSON.stringify(e.response?.data).slice(0, 200))
    }
  }
}

test().catch(e => console.error('Fatal:', e))
