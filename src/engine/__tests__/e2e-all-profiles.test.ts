/**
 * E2E test — try each profile, find one that actually responds
 */

import { ProfileManager } from '../../main/profiles/manager.ts'
import { createEngine } from '../core.ts'
import { sendMessageStream } from '../api/client.ts'
import type { Message } from '../api/client.ts'

const pm = new ProfileManager()
const profiles = pm.list()

let passed = 0
let failed = 0
let foundWorking = false

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  OK: ${msg}`) }
  else { failed++; console.error(`  FAIL: ${msg}`) }
}

async function testProfile(p: any) {
  console.log(`\n--- [${p.name}] ${p.baseUrl} ---`)

  if (!p.apiKey || p.apiKey.length < 8) {
    console.log('  Skipped: no API key')
    return
  }

  createEngine({
    apiKey: p.apiKey,
    provider: p.provider === 'custom' ? 'openai' : p.provider,
    model: p.model,
    baseUrl: p.baseUrl,
    maxTokens: 4096,
  })

  const messages: Message[] = [{ role: 'user', content: 'hi', timestamp: Date.now() }]
  let gotText = false
  let errorMsg = ''

  try {
    await sendMessageStream(
      {
        provider: p.provider === 'custom' ? 'openai' : p.provider,
        apiKey: p.apiKey,
        model: p.model,
        baseUrl: p.baseUrl,
        maxTokens: 4096,
      },
      messages,
      {
        onText: (text: string) => { gotText = true; console.log(`  Response: ${text.slice(0, 100)}`) },
        onToolUse: () => {},
        onDone: () => {},
        onError: (err: string) => { errorMsg = err },
      }
    )
  } catch (e: any) {
    errorMsg = e.message
  }

  if (gotText) {
    assert(true, `${p.name} returned text`)
    foundWorking = true
  } else if (errorMsg) {
    assert(false, `${p.name}: ${errorMsg}`)
  } else {
    assert(false, `${p.name}: empty response`)
  }
}

async function main() {
  console.log('E2E Profile Test — finding working profile\n')

  for (const p of profiles) {
    await testProfile(p)
  }

  console.log(`\n${'='.repeat(40)}`)
  console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`)

  if (foundWorking) {
    console.log('Found a working profile!')
    process.exit(0)
  } else {
    console.log('No profile returned a response.')
    process.exit(1)
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
