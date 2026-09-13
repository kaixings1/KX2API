/**
 * StepFun Token Parse Debug Script
 */

const fs = require('fs')
const path = require('path')

const headersFile = path.join(__dirname, 'stepfun_connect_headers.json')
const captured = JSON.parse(fs.readFileSync(headersFile, 'utf-8'))

const token = captured.cookies?.['Oasis-Token'] || ''

console.log('=== 模拟 extractTokenPayloads ===')
console.log('Token length:', token.length)
console.log('')

const segments = token.includes('...') ? token.split('...') : token.split('.')
console.log('split by "..." ->', segments.length, 'segments')

const results = []
for (const jwt of segments) {
  console.log('\nProcessing segment:', jwt.slice(0, 50) + '...')
  const parts = jwt.split('.')
  console.log('  Split by "." ->', parts.length, 'parts')

  for (const part of parts) {
    console.log('\n  Part:', part.slice(0, 60) + (part.length > 60 ? '...' : ''))
    console.log('  Part length:', part.length)

    try {
      const padded = part + '='.repeat((4 - (part.length % 4)) % 4)
      const decoded = Buffer.from(padded, 'base64url').toString('utf-8')
      console.log('  Decoded:', decoded.slice(0, 200))
      if (decoded.startsWith('{')) {
        const payload = JSON.parse(decoded)
        console.log('  Parsed JSON:', JSON.stringify(payload))
        const appId = payload?.app_id || payload?.appId
        const deviceId = payload?.device_id || payload?.deviceId
        if (appId || deviceId) {
          results.push({ appId, deviceId, raw: payload })
          console.log('  -> Has app_id/device_id:', appId, deviceId)
        } else {
          console.log('  -> No app_id or device_id in this payload')
        }
      }
    } catch (e) {
      console.log('  Decode error:', e.message)
    }
  }
}

console.log('\n=== extractTokenPayloads 结果 ===')
console.log('提取到的 payloads:', JSON.stringify(results, null, 2))
console.log('')
console.log('使用的 app_id (最后一个有 app_id 的 payload):', results.length > 0 ? results[results.length - 1].appId : 'NONE')

// ========== 正确解析方式 ==========
console.log('\n=== 正确解析方式（手动） ===')
const correctSegments = token.split('...')
let userPayload = null
let devicePayload = null

correctSegments.forEach((seg, i) => {
  const firstBrace = seg.indexOf('{')
  const lastBrace = seg.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const jsonStr = seg.slice(firstBrace, lastBrace + 1)
    try {
      const payload = JSON.parse(jsonStr)
      console.log(`Segment ${i}:`, JSON.stringify(payload))
      if (payload.app_id && !payload.device_id) {
        userPayload = payload
      }
      if (payload.device_id) {
        devicePayload = payload
      }
    } catch (e) {
      console.log(`Segment ${i}: parse error: ${e.message}`)
    }
  }
})

console.log('\nUser payload app_id:', userPayload?.app_id)
console.log('Device payload app_id:', devicePayload?.app_id)

// ========== Token 过期分析 ==========
console.log('\n=== Token 过期分析 ===')
const now = Math.floor(Date.now() / 1000)
console.log('当前时间戳:', now, '(', new Date(now * 1000).toISOString(), ')')

if (userPayload?.exp) {
  console.log('User payload exp:', userPayload.exp, '(', new Date(userPayload.exp * 1000).toISOString(), ')')
  console.log('User payload 过期:', userPayload.exp < now, '剩余:', userPayload.exp - now, '秒')
}
if (devicePayload?.exp) {
  console.log('Device payload exp:', devicePayload.exp, '(', new Date(devicePayload.exp * 1000).toISOString(), ')')
  console.log('Device payload 过期:', devicePayload.exp < now, '剩余:', devicePayload.exp - now, '秒')
}

// localStorage
const deviceStorage = captured.localStorage?.['device-storage']
if (deviceStorage) {
  try {
    const state = JSON.parse(deviceStorage)
    console.log('\nlocalStorage tokenExpireAt:', state?.state?.tokenExpireAt, '(', new Date(state?.state?.tokenExpireAt).toISOString(), ')')
  } catch (e) {
    console.log('localStorage parse error:', e.message)
  }
}
