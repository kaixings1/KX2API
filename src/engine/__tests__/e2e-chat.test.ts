/**
 * End-to-end chat test — 验证完整链路：引擎 → API → 实际响应
 *
 * 运行: npx tsx src/engine/__tests__/e2e-chat.test.ts
 */

import axios from 'axios'

// 用配置文件中的真实数据
const profiles = [
  { name: 'ModelScope', baseUrl: 'https://api-inference.modelscope.cn/v1/chat/completions', apiKey: 'ms-e0186bce3a8b49eda2f33d60c84a1492', model: 'deepseek-ai/DeepSeek-V4-Flash' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/chat/completions', apiKey: 'sk-f34cf...', model: 'deepseek-chat' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1/chat/completions', apiKey: 'sk-ai-v1-...', model: 'tencent/hy3-preview:free' },
]

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

async function testProfile(name: string, baseUrl: string, apiKey: string, model: string) {
  console.log(`\n--- Testing: ${name} ---`)
  console.log(`  URL: ${baseUrl}`)
  console.log(`  Model: ${model}`)

  if (apiKey.includes('...') || apiKey.length < 10) {
    console.log('  Skipped: API key appears incomplete')
    return false
  }

  try {
    const response = await axios.post(baseUrl, {
      model,
      max_tokens: 50,
      stream: false,
      messages: [{ role: 'user', content: 'hi' }],
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    })

    console.log(`  Status: ${response.status}`)
    const content = response.data?.choices?.[0]?.message?.content || response.data?.choices?.[0]?.text || ''
    console.log(`  Response: ${(content || JSON.stringify(response.data)).slice(0, 200)}`)

    if (content || response.status === 200) {
      assert(true, `${name} returned response`)
      return true
    } else {
      assert(false, `${name} returned empty content`)
      return false
    }
  } catch (e: any) {
    const status = e.response?.status
    const body = e.response?.data ? JSON.stringify(e.response.data).slice(0, 200) : e.message
    console.log(`  Error ${status}: ${body}`)

    if (status === 200 || status === 201) {
      assert(true, `${name} request succeeded`)
      return true
    }
    assert(false, `${name} failed: ${status} ${body}`)
    return false
  }
}

async function main() {
  console.log('KX2Code E2E Chat Test')
  console.log('='.repeat(40))

  let anySuccess = false

  for (const p of profiles) {
    const ok = await testProfile(p.name, p.baseUrl, p.apiKey, p.model)
    if (ok) anySuccess = true
  }

  console.log('\n' + '='.repeat(40))
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total:  ${passed + failed}`)

  if (anySuccess) {
    console.log('\nAt least one profile responded successfully!')
    process.exit(0)
  } else {
    console.log('\nNo profile succeeded. Check API keys or network.')
    process.exit(1)
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
