/**
 * StepFun Token Expiry Diagnostic Script
 */

const fs = require('fs')
const path = require('path')

const headersFile = path.join(__dirname, 'stepfun_connect_headers.json')
const captured = JSON.parse(fs.readFileSync(headersFile, 'utf-8'))

const token = captured.cookies?.['Oasis-Token'] || ''
const now = Math.floor(Date.now() / 1000)

console.log('=== Token 过期分析 ===')
console.log('当前时间戳:', now, '(', new Date().toISOString(), ')')
console.log('')

let totalExp = null
let userPayload = null
let devicePayload = null

if (token.includes('...')) {
  const segments = token.split('...')
  console.log('Token 格式: 多段拼接 (用 ... 分隔)')
  console.log('Segments count:', segments.length)

  segments.forEach((seg, i) => {
    try {
      const padded = seg + '='.repeat((4 - (seg.length % 4)) % 4)
      const decoded = Buffer.from(padded, 'base64url').toString('utf-8')
      console.log(`\nSegment ${i}:`)

      if (decoded.startsWith('ey') && decoded.includes('.')) {
        // JWT 格式
        const jwtParts = decoded.split('.')
        console.log('  Format: JWT')
        jwtParts.forEach((part, j) => {
          if (j === 1) {
            try {
              const p = Buffer.from(part, 'base64url').toString('utf-8')
              const payload = JSON.parse(p)
              console.log('  Payload:', JSON.stringify(payload))
              if (payload.exp) {
                console.log(`  exp=${payload.exp} (${new Date(payload.exp * 1000).toISOString()})`)
                console.log(`  expired=${payload.exp < now}`)
                console.log(`  剩余秒数=${payload.exp - now}`)
                totalExp = totalExp === null ? payload.exp : Math.max(totalExp, payload.exp)
              }
              if (payload.app_id) console.log(`  app_id=${payload.app_id}`)
              if (payload.device_id) console.log(`  device_id=${payload.device_id}`)
              if (payload.oasis_id) console.log(`  oasis_id=${payload.oasis_id}`)
              if (payload.activated !== undefined) console.log(`  activated=${payload.activated}`)
              if (payload.banned !== undefined) console.log(`  banned=${payload.banned}`)
              if (payload.role_in_organization !== undefined) console.log(`  role=${payload.role_in_organization}`)
            } catch (e) {
              console.log('  Payload decode failed:', e.message)
            }
          }
        })
      } else if (decoded.startsWith('{')) {
        console.log('  Format: Raw JSON')
        console.log('  Content:', decoded)
        try {
          const payload = JSON.parse(decoded)
          if (payload.exp) {
            console.log(`  exp=${payload.exp} (${new Date(payload.exp * 1000).toISOString()})`)
            console.log(`  expired=${payload.exp < now}`)
            totalExp = totalExp === null ? payload.exp : Math.max(totalExp, payload.exp)
          }
          if (payload.app_id) console.log(`  app_id=${payload.app_id}`)
          if (payload.device_id) console.log(`  device_id=${payload.device_id}`)
        } catch (e) {
          console.log('  JSON parse failed:', e.message)
        }
      } else {
        console.log('  Unknown format, starts with:', decoded.slice(0, 50))
      }
    } catch (e) {
      console.log(`\nSegment ${i}: decode error: ${e.message}`)
    }
  })
}

console.log('\n=== 总结 ===')
console.log('最新 exp:', totalExp, '(', totalExp ? new Date(totalExp * 1000).toISOString() : 'N/A', ')')
console.log('当前时间:', now, '(', new Date().toISOString(), ')')
if (totalExp) {
  const diff = totalExp - now
  if (diff < 0) {
    console.log(`\n*** TOKEN 已过期 ${Math.abs(diff)} 秒 (${Math.abs(Math.floor(diff/60))} 分钟) ***`)
    console.log('这就是 "need sign in" 错误的原因！')
  } else {
    console.log(`\nToken 还有 ${diff} 秒 (${Math.floor(diff/60)} 分钟) 过期`)
  }
}

// 检查 localStorage 中的 tokenExpireAt
const deviceStorage = captured.localStorage?.['device-storage']
if (deviceStorage) {
  try {
    const state = JSON.parse(deviceStorage)
    const expireAt = state?.state?.tokenExpireAt
    console.log('\nlocalStorage device-storage tokenExpireAt:', expireAt, '(', expireAt ? new Date(expireAt).toISOString() : 'N/A', ')')
  } catch (e) {
    console.log('localStorage device-storage parse error:', e.message)
  }
}
