#!/usr/bin/env node
/**
 * 代理服务器集成测试
 * 自动启动 proxy，执行测试，然后停止
 */
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')

const BUNDLE_PATH = path.join(__dirname, '..', 'out', 'main', 'index.js')

async function waitForServer (port, timeout = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
          resolve(res)
        })
        req.on('error', reject)
        req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')) })
      })
      return true
    } catch (e) {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  return false
}

async function testEndpoint (method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8080,
      path: urlPath,
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data, headers: res.headers })
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function testEndpointWithAuth (method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8080,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-secret-123',
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data, headers: res.headers })
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function main () {
  console.log('[Test] Starting proxy server...')
  const child = spawn(process.execPath, [path.join(__dirname, 'standalone-proxy-test.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  })

  let proxyReady = false

  child.stdout.on('data', (data) => {
    const text = data.toString()
    process.stdout.write(text)
    if (text.includes('Proxy Server RUNNING')) {
      proxyReady = true
    }
  })
  child.stderr.on('data', (data) => {
    process.stderr.write(data.toString())
  })

  // Wait for server to be ready
  console.log('[Test] Waiting for server to start...')
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000))
    if (proxyReady) break
  }

  if (!proxyReady) {
    console.error('[Test] Server did not start in time')
    child.kill('SIGTERM')
    process.exit(1)
  }

  console.log('\n[Test] Server is up, running tests...\n')

  // Test 1: Health endpoint
  console.log('[Test] GET /health')
  try {
    const health = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:8080/health', (res) => {
        let body = ''
        res.on('data', (d) => { body += d })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }).on('error', reject)
    })
    console.log(`  Status: ${health.status} | Body: ${health.body}`)
  } catch (err) {
    console.log(`  FAILED: ${err.message}`)
  }

  // Test 2: Models endpoint
  console.log('[Test] GET /v1/models')
  try {
    const models = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:8080/v1/models', (res) => {
        let body = ''
        res.on('data', (d) => { body += d })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }).on('error', reject)
    })
    console.log(`  Status: ${models.status} | Body: ${models.body.substring(0, 200)}`)
  } catch (err) {
    console.log(`  FAILED: ${err.message}`)
  }

  // Test 3: Stats endpoint
  console.log('[Test] GET /stats')
  try {
    const stats = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:8080/stats', (res) => {
        let body = ''
        res.on('data', (d) => { body += d })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }).on('error', reject)
    })
    console.log(`  Status: ${stats.status} | Body: ${stats.body}`)
  } catch (err) {
    console.log(`  FAILED: ${err.message}`)
  }

  // Test 4: Add a provider via management API
  console.log('\n[Test] POST /v0/management/providers (add DeepSeek provider)')
  let providerId = null
  try {
    const providerResult = await testEndpointWithAuth('POST', '/v0/management/providers', {
      name: 'test-deepseek',
      type: 'deepseek',
      authType: 'token',
      apiEndpoint: 'https://api.deepseek.com',
      apiKey: 'sk-test-key-for-testing',
      supportedModels: ['deepseek-chat', 'deepseek-coder'],
    })
    console.log(`  Status: ${providerResult.status}`)
    console.log(`  Body: ${providerResult.body.substring(0, 300)}`)
    const providerData = JSON.parse(providerResult.body)
    if (providerData.success) providerId = providerData.data.id
  } catch (err) {
    console.log(`  FAILED: ${err.message}`)
  }

  // Test 5: Add an account to the provider
  if (providerId) {
    console.log(`\n[Test] POST /v0/management/accounts (add account to ${providerId})`)
    try {
      const accountResult = await testEndpointWithAuth('POST', '/v0/management/accounts', {
        providerId: providerId,
        name: 'test-account-1',
        credentials: { apiKey: 'sk-test-key-for-testing' },
      })
      console.log(`  Status: ${accountResult.status}`)
      console.log(`  Body: ${accountResult.body.substring(0, 300)}`)
    } catch (err) {
      console.log(`  FAILED: ${err.message}`)
    }
  } else {
    console.log('\n[Test] SKIP account creation (provider creation failed)')
  }

  // Test 6: Chat completion (will proxy to deepseek, may fail without real key)
  console.log('\n[Test] POST /v1/chat/completions (end-to-end test)')
  try {
    const chatResult = await testEndpoint('POST', '/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hello, can you help me?' }],
    })
    console.log(`  Status: ${chatResult.status}`)
    console.log(`  Body: ${chatResult.body.substring(0, 300)}`)
  } catch (err) {
    console.log(`  FAILED: ${err.message}`)
  }

  // Test 7: Check stats after requests
  console.log('\n[Test] GET /stats')
  try {
    const stats = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:8080/stats', (res) => {
        let body = ''
        res.on('data', (d) => { body += d })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }).on('error', reject)
    })
    console.log(`  Status: ${stats.status}`)
    console.log(`  Body: ${stats.body}`)
  } catch (err) {
    console.log(`  FAILED: ${err.message}`)
  }

  console.log('\n[Test] Tests complete. Stopping proxy server...')
  child.kill('SIGTERM')
  setTimeout(() => {
    try { child.kill('SIGKILL') } catch (e) {}
    process.exit(0)
  }, 2000)
}

main().catch(err => {
  console.error('[Test] Fatal:', err)
  process.exit(1)
})
