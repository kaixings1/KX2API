/**
 * Direct StepFun API test — see what the API actually returns
 *
 * Usage: Set STEPFUN_API_KEY and STEPFUN_BASE_URL env vars
 *   STEPFUN_API_KEY=your_key STEPFUN_BASE_URL=https://api.stepfun.com/step_plan/v1/chat/completions npx tsx stepfun-direct.test.ts
 */

import axios from 'axios'

const config = {
  apiKey: process.env.STEPFUN_API_KEY || '',
  baseUrl: process.env.STEPFUN_BASE_URL || 'https://api.stepfun.com/step_plan/v1/chat/completions',
  model: 'step-3.7-flash',
}

if (!config.apiKey) {
  console.log('Please set STEPFUN_API_KEY environment variable')
  process.exit(1)
}

async function test() {
  console.log('=== Non-streaming ===')
  try {
    const r1 = await axios.post(config.baseUrl, {
      model: config.model,
      max_tokens: 50,
      stream: false,
      messages: [{ role: 'user', content: 'Say hi in 3 words' }],
    }, {
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    })
    console.log('Status:', r1.status)
    console.log('Body:', JSON.stringify(r1.data).slice(0, 500))
  } catch (e: any) {
    console.log('Error status:', e.response?.status)
    console.log('Error body:', JSON.stringify(e.response?.data).slice(0, 300))
    console.log('Message:', e.message)
  }

  console.log('\n=== Streaming ===')
  try {
    const r2 = await axios.post(config.baseUrl, {
      model: config.model,
      max_tokens: 50,
      stream: true,
      messages: [{ role: 'user', content: 'Say hi in 3 words' }],
    }, {
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
      responseType: 'text',
    })
    console.log('Status:', r2.status)
    console.log('Data (first 500):', (r2.data || '').slice(0, 500))
  } catch (e: any) {
    console.log('Error status:', e.response?.status)
    console.log('Error body:', JSON.stringify(e.response?.data).slice(0, 300))
    console.log('Message:', e.message)
  }
}

test().catch((e) => console.error('Fatal:', e))
