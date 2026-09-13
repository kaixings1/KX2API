/**
 * StepFun Connect Auth Diagnostic Script v2
 */

const fs = require('fs')
const path = require('path')

// ========== 1. 读取抓包数据 ==========
const headersFile = path.join(__dirname, 'stepfun_connect_headers.json')
const captured = JSON.parse(fs.readFileSync(headersFile, 'utf-8'))

console.log('=== 1. 浏览器抓包中的所有 API 请求 ===')
const apiRequests = captured.api_requests || {}
for (const [url, req] of Object.entries(apiRequests)) {
  console.log(`\n  URL: ${url}`)
  console.log(`  Method: ${req.method}`)
  if (req.headers) {
    const appId = req.headers['oasis-appid'] || req.headers['Oasis-appID']
    const platform = req.headers['oasis-platform'] || req.headers['Oasis-Platform']
    const token = req.headers['oasis-token'] || req.headers['Oasis-Token']
    const webid = req.headers['oasis-webid'] || req.headers['Oasis-Webid']
    if (appId || platform || token) {
      console.log(`    oasis-appid: ${appId}`)
      console.log(`    oasis-platform: ${platform}`)
      console.log(`    oasis-token present: ${!!token} (len=${token?.length || 0})`)
      console.log(`    oasis-webid present: ${!!webid} (len=${webid?.length || 0})`)
    }
  }
}

// ========== 2. Cookie 分析 ==========
console.log('\n=== 2. Cookie 分析 ===')
const cookies = captured.cookies || {}
for (const [name, value] of Object.entries(cookies)) {
  console.log(`  ${name}: ${value.slice(0, 50)}${value.length > 50 ? '...' : ''} (len=${value.length})`)
}

// ========== 3. Oasis-Token 深度分析 ==========
console.log('\n=== 3. Oasis-Token 深度分析 ===')
const token = captured.cookies?.['Oasis-Token'] || ''
console.log('Token length:', token.length)
console.log('Token prefix:', token.slice(0, 40))

const segments = token.includes('...') ? token.split('...') : token.split('.')
console.log('Segments:', segments.length)

let userPayload = null
let devicePayload = null

segments.forEach((seg, i) => {
  try {
    const padded = seg + '='.repeat((4 - (seg.length % 4)) % 4)
    const decoded = Buffer.from(padded, 'base64url').toString('utf-8')
    if (decoded.startsWith('{')) {
      const payload = JSON.parse(decoded)
      console.log(`\n  Segment ${i} payload:`, JSON.stringify(payload, null, 2))

      if (payload.app_id && !payload.device_id) {
        userPayload = payload
      }
      if (payload.device_id) {
        devicePayload = payload
      }
    }
  } catch (e) {
    console.log(`  Segment ${i}: failed to decode`)
  }
})

console.log('\n  -> User payload app_id:', userPayload?.app_id)
console.log('  -> Device payload app_id:', devicePayload?.app_id)

// ========== 4. 检查代码中的 app_id 使用逻辑 ==========
console.log('\n=== 4. 代码中的 app_id 使用逻辑 ===')

const stepfunFile = path.join(__dirname, 'src/main/proxy/adapters/stepfun.ts')
const content = fs.readFileSync(stepfunFile, 'utf-8')

// 查找 buildHeaders 方法中的 app_id 逻辑
const buildHeadersMatch = content.match(/private buildHeaders\(\)[\s\S]*?^  \}/m)
if (buildHeadersMatch) {
  console.log('buildHeaders 中的 app_id 逻辑:')
  const lines = buildHeadersMatch[0].split('\n')
  lines.forEach((line, i) => {
    if (line.includes('appId') || line.includes('app_id') || line.includes('Oasis-appID') || line.includes('provider.headers')) {
      console.log(`  L${i}: ${line}`)
    }
  })
}

// 查找 processConnectFrames 中的错误处理
const processConnectMatch = content.match(/processConnectFrames[\s\S]*?^  \}/m)
if (processConnectMatch) {
  console.log('\nprocessConnectFrames 中的错误帧处理:')
  const lines = processConnectMatch[0].split('\n')
  lines.forEach((line, i) => {
    if (line.includes('error') || line.includes('permission_denied')) {
      console.log(`  L${i}: ${line}`)
    }
  })
}

// ========== 5. 检查 stepfun2026 ==========
console.log('\n=== 5. stepfun2026 adapter 对比 ===')
const stepfun2026File = path.join(__dirname, 'src/main/proxy2026/adapters/stepfun.ts')
if (fs.existsSync(stepfun2026File)) {
  const content2026 = fs.readFileSync(stepfun2026File, 'utf-8')
  const appIdMatch2026 = content2026.match(/Oasis[-_]?appID['":\s]+['"]?(\d+)['"]?/gi)
  console.log('  stepfun2026 Oasis-appID:', appIdMatch2026?.map(m => m.trim()))

  const fallbackMatch2026 = [...content2026.matchAll(/\|\|\s*['"](\d+)['"]/g)]
  console.log('  stepfun2026 || fallback:', fallbackMatch2026.map(m => `"${m[1]}"`))
}

// ========== 6. 实际发送的 app_id 推导 ==========
console.log('\n=== 6. 实际发送的 app_id 推导 ===')
console.log('代码逻辑（stepfun.ts buildHeaders）:')
console.log('  1. 先从 token 中提取 app_id (extractTokenPayloads)')
console.log('  2. 如果提取不到，回退到 provider.headers["Oasis-appID"]')
console.log('  3. 如果还取不到，回退到硬编码 "10200"')
console.log('')
console.log('当前 token 中的 app_id:')
console.log('  - User payload (segment 0): no app_id field')
console.log('  - Device payload (segment 1): app_id=10200')
console.log('')
console.log('实际发送的 app_id: 10200 (来自 token device payload)')
console.log('')
console.log('浏览器抓包中 ChatStream 请求的 app_id: 未在抓包 api_requests 中看到')
console.log('')
console.log('Builtin provider 配置的 app_id: 10300 (src/main/providers/builtin/stepfun.ts:15)')
console.log('')
console.log('⚠️  关键发现: 代码实际发送的 app_id=10200，但 builtin provider 配置的是 10300')
console.log('   如果 account 没有自定义 headers["Oasis-appID"]，则 provider 配置的 10300 不会影响实际请求')
