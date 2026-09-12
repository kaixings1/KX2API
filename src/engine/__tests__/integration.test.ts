/**
 * src/engine/__tests__/integration.test.ts — 端到端集成测试
 *
 * 模拟完整的 API 请求流程，验证：
 * 1. ProfileManager 读取配置
 * 2. engine-bridge 初始化引擎
 * 3. API client 构建正确的 URL
 * 4. 实际 HTTP 请求（如果能通）
 */

import { ProfileManager } from '../../main/profiles/manager.ts'
import { createEngine, getEngine } from '../core.ts'
import { sendMessageStream } from '../api/client.ts'
import type { Message } from '../api/client.ts'

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

async function testProfileToEngine() {
  console.log('\n--- Profile → Engine Config ---')

  const pm = new ProfileManager()
  const active = pm.getActive()
  assert(active !== null, 'Active profile exists')
  if (!active) return

  console.log(`  Active: ${active.name}`)
  console.log(`  baseUrl: ${active.baseUrl}`)
  console.log(`  model: ${active.model}`)
  console.log(`  apiKey: ${active.apiKey.slice(0, 8)}...`)

  // 模拟 engine-bridge 初始化
  const engineConfig = {
    apiKey: active.apiKey,
    provider: (active.provider === 'custom' ? 'openai' : active.provider) as 'openai' | 'anthropic',
    model: active.model,
    baseUrl: active.baseUrl || undefined,
    maxTokens: 4096,
  }

  createEngine(engineConfig)
  const engine = getEngine()
  const config = engine.getConfig()

  console.log(`  Engine config:`, {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey?.slice(0, 8) + '...',
  })

  assert(config.provider === engineConfig.provider, 'Engine provider matches profile')
  assert(config.model === engineConfig.model, 'Engine model matches profile')
  assert(config.baseUrl === engineConfig.baseUrl, 'Engine baseUrl matches profile')
  assert(config.apiKey === engineConfig.apiKey, 'Engine apiKey matches profile')
}

async function testApiRequest() {
  console.log('\n--- API Request Test ---')

  const pm = new ProfileManager()
  const active = pm.getActive()
  if (!active) {
    console.log('  Skipped: no active profile')
    return
  }

  // 用当前激活配置发一条真实请求
  const messages: Message[] = [
    { role: 'user', content: 'Say hi in 3 words', timestamp: Date.now() }
  ]

  let gotResponse = false
  let gotError = false
  const errorMsg: string[] = []

  try {
    await sendMessageStream(
      {
        provider: active.provider === 'custom' ? 'openai' : active.provider,
        apiKey: active.apiKey,
        model: active.model,
        baseUrl: active.baseUrl,
        maxTokens: 100,
      },
      messages,
      {
        onText: (text) => {
          gotResponse = true
          console.log(`  [Stream] ${text.slice(0, 100)}`)
        },
        onToolUse: () => {},
        onDone: (fullText) => {
          console.log(`  [Done] Full length: ${fullText.length}`)
        },
        onError: (err) => {
          gotError = true
          errorMsg.push(err)
          console.log(`  [Error] ${err}`)
        },
      }
    )
  } catch (e) {
    gotError = true
    errorMsg.push((e as Error).message)
    console.log(`  [Fatal] ${(e as Error).message}`)
  }

  if (gotResponse) {
    assert(true, 'Got streaming response')
    assert(!gotError, 'No error')
  } else if (gotError) {
    console.log(`  Error detail: ${errorMsg.join(', ')}`)
    assert(false, `Request failed: ${errorMsg[0]}`)
  } else {
    assert(false, 'No response and no error (timeout?)')
  }
}

async function testAllProfileUrls() {
  console.log('\n--- All Profile URL Check ---')

  const pm = new ProfileManager()
  const profiles = pm.list()

  for (const p of profiles) {
    const raw = (p.baseUrl || '').replace(/\/$/, '')
    const hasEndpoint = raw.includes('/chat/completions')
    const endpoint = hasEndpoint ? raw : raw + '/v1/chat/completions'
    console.log(`  [${p.name}] ${endpoint}`)
  }

  assert(profiles.length > 0, `Found ${profiles.length} profiles`)
}

// ---- main ----

async function main() {
  console.log('KX2Code Integration Test Suite')
  console.log('='.repeat(40))

  try {
    await testAllProfileUrls()
    await testProfileToEngine()
    await testApiRequest()

    console.log('\n' + '='.repeat(40))
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${failed}`)
    console.log(`Total:  ${passed + failed}`)

    if (failed > 0) {
      console.log('\nSome tests failed!')
      process.exit(1)
    } else {
      console.log('\nAll tests passed!')
      process.exit(0)
    }
  } catch (e) {
    console.error('\n[Fatal]', e)
    process.exit(1)
  }
}

main()
