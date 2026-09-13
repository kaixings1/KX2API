/**
 * StepFun Connect Auth Diagnostic Script
 *
 * 目的：把 Connect 请求的认证链路完全展开，确认：
 *   1. 实际发出的 app_id 来自哪里
 *   2. token 是否已过期
 *   3. 哪些值是硬编码的
 *   4. 请求体格式是否与浏览器一致
 *
 * 用法：node diagnose_stepfun_auth.js
 */

const fs = require('fs')
const path = require('path')

// ========== 1. 从抓包数据中读取真实的浏览器请求 ==========
const headersFile = path.join(__dirname, 'stepfun_connect_headers.json')
const captured = JSON.parse(fs.readFileSync(headersFile, 'utf-8'))

console.log('=== 1. 浏览器抓包中的实际请求头 ===')
const browserHeaders = captured.api_requests?.['https://chat.stepfun.com/api/agent/capy.agent.v1.AgentService/ChatStream']?.headers
if (browserHeaders) {
  console.log('oasis-appid:', browserHeaders['oasis-appid'] || browserHeaders['Oasis-appID'])
  console.log('oasis-platform:', browserHeaders['oasis-platform'] || browserHeaders['Oasis-Platform'])
  console.log('canary:', browserHeaders['canary'] || browserHeaders['Canary'])
  console.log('connect-protocol-version:', browserHeaders['connect-protocol-version'] || browserHeaders['Connect-Protocol-Version'])
  console.log('origin:', browserHeaders['Origin'])
  console.log('referer:', browserHeaders['Referer'])
}

// ========== 2. 分析 Oasis-Token 内容 ==========
console.log('\n=== 2. Oasis-Token 分析 ===')
const token = captured.cookies?.['Oasis-Token'] || captured.localStorage?.['oasis-token'] || ''
if (token) {
  const segments = token.includes('...') ? token.split('...') : token.split('.')
  console.log('Token segments count:', segments.length)
  segments.forEach((seg, i) => {
    try {
      const padded = seg + '='.repeat((4 - (seg.length % 4)) % 4)
      const decoded = Buffer.from(padded, 'base64url').toString('utf-8')
      if (decoded.startsWith('{')) {
        const payload = JSON.parse(decoded)
        console.log(`  Segment ${i}:`, JSON.stringify(payload))
        if (payload.exp) {
          const expDate = new Date(payload.exp * 1000)
          const now = new Date()
          const expired = payload.exp < Math.floor(Date.now() / 1000)
          console.log(`    -> exp=${payload.exp} (${expDate.toISOString()}) expired=${expired}`)
        }
        if (payload.app_id) {
          console.log(`    -> app_id=${payload.app_id}`)
        }
        if (payload.device_id) {
          console.log(`    -> device_id=${payload.device_id}`)
        }
        if (payload.oasis_id) {
          console.log(`    -> oasis_id=${payload.oasis_id}`)
        }
      }
    } catch (e) {
      // skip
    }
  })
}

// ========== 3. 分析 web_id ==========
console.log('\n=== 3. Web-ID 分析 ===')
const webId = captured.cookies?.['Oasis-Webid'] || captured.localStorage?.['deviceId']?.replace(/"/g, '') || ''
console.log('Web-ID:', webId)
console.log('Web-ID length:', webId.length)

// ========== 4. 对比代码中的硬编码值 ==========
console.log('\n=== 4. 代码中的硬编码值 ===')

const filesToCheck = [
  'src/main/providers/builtin/stepfun.ts',
  'src/main/proxy/adapters/stepfun.ts',
  'src/main/proxy2026/adapters/stepfun.ts',
]

for (const file of filesToCheck) {
  const fullPath = path.join(__dirname, file)
  if (!fs.existsSync(fullPath)) {
    console.log(`  ${file}: NOT FOUND`)
    continue
  }
  const content = fs.readFileSync(fullPath, 'utf-8')

  // 搜索所有硬编码的 app_id
  const appIdMatches = [...content.matchAll(/Oasis[-_]?appID['":\s]+['"]?(\d+)['"]?/gi)]
  const oasisAppIdMatches = [...content.matchAll(/['"]Oasis-appID['"]:\s*['"]?(\d+)['"]?/gi)]
  const connectProtoMatches = [...content.matchAll(/Connect-Protocol-Version['":\s]+['"]?(\d+)['"]?/gi)]
  const canaryMatches = [...content.matchAll(/Canary['":\s]+['"]?(\w+)['"]?/gi)]
  const platformMatches = [...content.matchAll(/Oasis[-_]?Platform['":\s]+['"]?(\w+)['"]?/gi)]
  const originMatches = [...content.matchAll(/Origin['":\s]+['"]?(https?:\/\/[^'"]+)['"]?/gi)]

  console.log(`\n  ${file}:`)
  if (appIdMatches.length > 0) {
    console.log('    Oasis-appID 硬编码:')
    appIdMatches.forEach(m => console.log(`      line: ...${m[0].trim()}...`))
  }
  if (oasisAppIdMatches.length > 0) {
    console.log('    Oasis-appID header 硬编码:')
    oasisAppIdMatches.forEach(m => console.log(`      line: ...${m[0].trim()}...`))
  }
  if (connectProtoMatches.length > 0) {
    console.log('    Connect-Protocol-Version 硬编码:')
    connectProtoMatches.forEach(m => console.log(`      line: ...${m[0].trim()}...`))
  }
  if (canaryMatches.length > 0) {
    console.log('    Canary 硬编码:')
    canaryMatches.forEach(m => console.log(`      line: ...${m[0].trim()}...`))
  }
  if (platformMatches.length > 0) {
    console.log('    Platform 硬编码:')
    platformMatches.forEach(m => console.log(`      line: ...${m[0].trim()}...`))
  }
  if (originMatches.length > 0) {
    console.log('    Origin 硬编码:')
    originMatches.forEach(m => console.log(`      line: ...${m[0].trim()}...`))
  }

  // 搜索 fallback 逻辑
  const fallbackMatches = [...content.matchAll(/\|\|\s*['"](\d+)['"]/g)]
  if (fallbackMatches.length > 0) {
    console.log('    || fallback 值:')
    fallbackMatches.forEach(m => console.log(`      fallback to: "${m[1]}"`))
  }
}

// ========== 5. 总结 ==========
console.log('\n=== 5. 诊断结论 ===')
const tokenAppId = extractAppIdFromToken(token)
const browserAppId = browserHeaders?.['oasis-appid'] || browserHeaders?.['Oasis-appID']

console.log(`Token 中提取的 app_id: ${tokenAppId || '无法提取'}`)
console.log(`浏览器发出的 app_id: ${browserAppId || '抓包中未找到'}`)
console.log(`Builtin provider 配置的 app_id: 10300 (src/main/providers/builtin/stepfun.ts:15)`)
console.log(`代码 fallback 的 app_id: 10200 (stepfun.ts WEB_HEADERS 硬编码)`)

if (tokenAppId && browserAppId && tokenAppId !== browserAppId) {
  console.log('\n*** 警告: Token app_id 与浏览器实际发出的 app_id 不一致! ***')
}
if (tokenAppId === '10300') {
  console.log('\n*** Token app_id = 10300，与 builtin provider 配置一致 ***')
}
if (tokenAppId === '10200') {
  console.log('\n*** Token app_id = 10200，与 WEB_HEADERS fallback 一致 ***')
}

function extractAppIdFromToken(token) {
  if (!token) return null
  const segments = token.includes('...') ? token.split('...') : token.split('.')
  for (const seg of segments) {
    try {
      const padded = seg + '='.repeat((4 - (seg.length % 4)) % 4)
      const decoded = Buffer.from(padded, 'base64url').toString('utf-8')
      if (decoded.startsWith('{')) {
        const payload = JSON.parse(decoded)
        if (payload.app_id) return String(payload.app_id)
        if (payload.appId) return String(payload.appId)
      }
    } catch (e) { /* skip */ }
  }
  return null
}
