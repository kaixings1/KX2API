/**
 * ModelScope API auth test
 */

import axios from 'axios'

const API_KEY = 'ms-e0186bce3a8b49eda2f33d60c84a1492'
const BASE_URL = 'https://api-inference.modelscope.cn/v1/chat/completions'
const MODEL = 'deepseek-ai/DeepSeek-V4-Flash'

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
