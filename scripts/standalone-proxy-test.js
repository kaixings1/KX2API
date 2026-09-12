#!/usr/bin/env node
/**
 * 独立代理服务器测试脚本
 * 在无 Electron 运行时的环境下，通过 mock 启动完整的代理服务器
 * 供浏览器进行真实的 HTTP 代理测试
 *
 * 用法: node scripts/standalone-proxy-test.js
 */

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const PROJECT_ROOT = path.join(__dirname, '..')
const CHUNKS_DIR = path.join(PROJECT_ROOT, 'out', 'main', 'chunks')
const BUNDLE_PATH = path.join(PROJECT_ROOT, 'out', 'main', 'index.js')

// ─── 0. 检查构建产物 ────────────────────────────────────────────────────────
if (!fs.existsSync(BUNDLE_PATH)) {
  console.error('[TestProxy] Build output not found. Run "npm run build" first.')
  process.exit(1)
}

const chunkFiles = fs.readdirSync(CHUNKS_DIR).filter(f => f.endsWith('.js'))
if (chunkFiles.length === 0) {
  console.error('[TestProxy] No chunk files found in', CHUNKS_DIR)
  process.exit(1)
}
const chunkFile = path.join(CHUNKS_DIR, chunkFiles[0])

// ─── 1. 注册 electron mock ──────────────────────────────────────────────────
const mockSafeStorage = {
  isEncryptionAvailable() { return false },
  encryptString(data) { return Buffer.from(data, 'utf-8') },
  decryptString(buffer) { return buffer.toString('utf-8') },
}

const mockElectron = {
  app: {
    getPath(name) {
      if (name === 'home' || name === 'userData' || name === 'appData')
        return path.join(os.homedir(), '.chat2api')
      if (name === 'temp') return os.tmpdir()
      if (name === 'exe') return process.execPath
      return os.homedir()
    },
    getVersion() { return '1.4.0' },
    getName() { return 'kx2api' },
    on() { return mockElectron.app },
    once() { return mockElectron.app },
    quit() { process.exit(0) },
    exit(code) { process.exit(code || 0) },
    isReady() { return true },
    whenReady() { return Promise.resolve() },
    commandLine: { appendSwitch() {}, removeSwitch() {} },
    requestSingleInstanceLock() { return true },
    setLoginItemSettings() {},
    getLoginItemSettings() { return { openAtLogin: false } },
    isPackaged: false,
    allowRendererProcessReuse: true,
  },
  safeStorage: mockSafeStorage,
  BrowserWindow: class MockBrowserWindow {
    constructor() {}
    on() { return this }
    once() { return this }
    loadFile() { return Promise.resolve() }
    loadURL() { return Promise.resolve() }
    show() {}
    hide() {}
    close() {}
    isDestroyed() { return false }
    getTitle() { return 'KX2API' }
    setTitle() {}
    setSize() {}
    getSize() { return [1200, 800] }
    setPosition() {}
    getPosition() { return [0, 0] }
    maximize() {}
    isMaximized() { return false }
    minimize() {}
    isMinimized() { return false }
    webContents() {
      return {
        executeJavaScript() { return Promise.resolve(null) },
        on() {}, once() {},
        openDevTools() {}, closeDevTools() {},
      }
    }
  },
  ipcMain: { on() {}, once() {}, handle() {}, handleOnce() {}, removeHandler() {}, removeAllListeners() {} },
  screen: {
    getDisplayNearestPoint() { return { workAreaSize: { width: 1920, height: 1080 } } },
    getPrimaryDisplay() { return { workAreaSize: { width: 1920, height: 1080 } } },
  },
  dialog: {
    showMessageBox() { return Promise.resolve({ response: 0 }) },
    showOpenDialog() { return Promise.resolve({ canceled: true, filePaths: [] }) },
    showSaveDialog() { return Promise.resolve({ canceled: true, filePath: '' }) },
  },
  net: {
    request(options) {
      const http = require('node:http')
      const https = require('node:https')
      const { URL } = require('node:url')
      const transport = new URL(options.url).protocol === 'https:' ? https : http

      const req = transport.request(options.url, {
        method: options.method || 'GET',
        headers: options.headers || {},
      }, (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          try { options.on('response')(response) } catch (e) {}
        })
        response.on('error', (err) => {
          try { options.on('error')(err) } catch (e) {}
        })
      }).on('error', (err) => {
        try { options.on('error')(err) } catch (e) {}
      })

      return {
        setHeader(k, v) { options.headers[k] = v },
        getHeader(k) { return options.headers[k] },
        write(data) { req.write(data) },
        end() { req.end() },
        abort() { req.destroy() },
        on(event, fn) {
          if (event === 'response' || event === 'error') options.on = fn
          else req.on(event, fn)
        },
        once(event, fn) { req.once(event, fn) },
      }
    },
  },
  clipboard: { writeText() {}, readText() { return '' } },
  shell: { openExternal() { return Promise.resolve() }, openPath() { return Promise.resolve('') } },
  globalShortcut: { register() { return true }, unregister() {}, unregisterAll() {} },
  powerMonitor: { on() { return { remove() {} } } },
  Notification: class { constructor() {} show() {} on() {} once() {} },
  Menu: { buildFromTemplate() { return { items: [] } } },
  MenuItem: class { constructor() {} click() {} },
  getAppPath() { return PROJECT_ROOT },
}

// 注册到 require 缓存
let electronPath
try {
  electronPath = require.resolve('electron')
} catch {
  electronPath = path.join(PROJECT_ROOT, 'node_modules', 'electron')
}
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: mockElectron }

// ─── 2. 替换 electron-store chunk ────────────────────────────────────────────
const backupPath = chunkPath = chunkFile + '.bak'
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(chunkFile, backupPath)
}

fs.writeFileSync(chunkFile, `
"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const node_path = require("node:path");
const node_os = require("node:os");
const node_fs = require("node:fs");

class MockStore {
  constructor(options = {}) {
    this._defaults = (options.defaults) || {}
    this._data = Object.assign({}, this._defaults)
    this._watchers = new Map()
    if (options.name) {
      this._dir = options.cwd || node_path.join(node_os.homedir(), ".chat2api")
      this._file = node_path.join(this._dir, options.name + ".json")
      this._load()
    }
  }
  _load() {
    try {
      if (node_fs.existsSync(this._file)) {
        this._data = Object.assign({}, this._defaults, JSON.parse(node_fs.readFileSync(this._file, "utf-8")))
      }
    } catch (e) { this._data = Object.assign({}, this._defaults) }
  }
  _save() {
    try {
      if (!node_fs.existsSync(this._dir)) node_fs.mkdirSync(this._dir, { recursive: true })
      node_fs.writeFileSync(this._file, JSON.stringify(this._data, null, 2), "utf-8")
    } catch (e) {}
  }
  get(key, defaultValue) {
    const keys = String(key).split(".")
    let result = this._data
    for (const k of keys) {
      if (result && typeof result === "object" && k in result) result = result[k]
      else return defaultValue
    }
    return result !== undefined ? result : defaultValue
  }
  set(key, value) {
    const keys = String(key).split(".")
    const lastKey = keys.pop()
    let target = this._data
    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== "object") target[k] = {}
      target = target[k]
    }
    const prev = target[lastKey]
    target[lastKey] = value
    this._save()
    const watcher = this._watchers.get(key)
    if (watcher) watcher(value, prev)
    return this
  }
  has(key) { return this.get(key) !== undefined }
  delete(key) {
    const keys = String(key).split(".")
    const lastKey = keys.pop()
    let target = this._data
    for (const k of keys) {
      if (!(k in target)) return false
      target = target[k]
    }
    const had = lastKey in target
    if (had) { delete target[lastKey]; this._save() }
    return had
  }
  clear() { this._data = Object.assign({}, this._defaults); this._save(); return this }
  get size() { return Object.keys(this._data).length }
  get path() { return this._file || "" }
  onDidChange(key, fn) { this._watchers.set(key, fn); return { onDidChange() {} } }
}

exports.default = MockStore
`)

// 清理 chunk require 缓存
for (const key of Object.keys(require.cache)) {
  if (key.includes('chunks') && key.endsWith('.js')) delete require.cache[key]
}

console.log(`[TestProxy] Mocked electron-store chunk: ${path.basename(chunkFile)}`)

// ─── 3. 加载 bundle ────────────────────────────────────────────────────────
console.log('[TestProxy] Loading proxy server bundle...')

let ProxyServerClass = null
let storeManagerExport = null

try {
  const prevEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  const bundle = require(BUNDLE_PATH)
  process.env.NODE_ENV = prevEnv

  // 从全局变量获取（由 proxy/index.ts 中的 globalThis.ProxyServer = ProxyServer 导出）
  if (global.ProxyServer && typeof global.ProxyServer === 'function') {
    ProxyServerClass = global.ProxyServer
    console.log('[TestProxy] Found ProxyServer via global export')
  }
  if (global.proxyServer) {
    console.log('[TestProxy] Found proxyServer singleton via global export')
  }

  // 回退：遍历 module.children 和 require.cache
  if (!ProxyServerClass) {
    const allMods = [...module.children, ...Object.values(require.cache)]
    for (const mod of allMods) {
      try {
        const ex = mod.exports || {}
        for (const key of Object.keys(ex)) {
          const val = ex[key]
          if (val && val.prototype && val.prototype.constructor === val) {
            const src = String(val)
            if (src.includes('ProxyServer') || src.includes('proxyStatusManager')) {
              ProxyServerClass = val
              console.log(`[TestProxy] Found ProxyServer in module: ${key}`)
              break
            }
          }
        }
        if (ProxyServerClass) break
      } catch (e) { /* skip */ }
    }
  }

  // 查找 storeManager
  for (const mod of [...module.children, ...Object.values(require.cache)]) {
    try {
      const ex = mod.exports || {}
      if (ex.addProvider && ex.getConfig && !storeManagerExport) {
        storeManagerExport = ex
        console.log('[TestProxy] Found storeManager export')
      }
    } catch (e) { /* skip */ }
  }

} catch (err) {
  console.error('[TestProxy] Failed to load bundle:', err.message)
  console.error(err.stack)
  process.exit(1)
}

if (!ProxyServerClass) {
  console.error('[TestProxy] ERROR: Could not find ProxyServer class')
  console.error('[TestProxy] Check that src/main/proxy/index.ts has the global export')
  process.exit(1)
}

// ─── 4. 初始化 store ────────────────────────────────────────────────────────
async function initStore () {
  // storeManager 已通过 bundle 中的 global.storeManager = storeManager 导出
  const mgr = global.storeManager
  if (!mgr) {
    console.warn('[TestProxy] WARNING: global.storeManager not found - proxy may fail on first request')
    console.warn('[TestProxy] Configure providers via: POST http://<ip>:8080/v0/management/providers')
    return
  }

  try {
    await mgr.initialize()
    console.log('[TestProxy] Store initialized successfully')

    // 启用 Management API 以便测试
    mgr.updateConfig({
      managementApi: {
        enableManagementApi: true,
        managementApiSecret: 'test-secret-123',
      },
    })
    console.log('[TestProxy] Management API enabled (secret: test-secret-123)')

    const cfg = mgr.getConfig()
    console.log(`[TestProxy] Providers: ${(cfg.providers || []).length}, Accounts: ${(cfg.accounts || []).length}`)
    console.log(`[TestProxy] API Key auth: ${cfg.enableApiKey ? 'enabled' : 'disabled'}`)
    console.log(`[TestProxy] Management API: ${cfg.managementApi?.enableManagementApi ? 'enabled' : 'disabled'}`)
  } catch (err) {
    console.error('[TestProxy] Store init failed:', err.message)
  }
}

// ─── 5. 启动代理 ────────────────────────────────────────────────────────────
async function startProxy() {
  const PORT = 8080
  const HOST = '0.0.0.0'

  console.log(`\n[TestProxy] Starting proxy on ${HOST}:${PORT}...`)

  const server = new ProxyServerClass()
  const ok = await server.start(PORT, HOST)
  if (!ok) {
    console.error('[TestProxy] Failed to start (port in use?)')
    process.exit(1)
  }

  const status = server.getStatus()
  console.log('\n' + '='.repeat(65))
  console.log('  Proxy Server RUNNING')
  console.log('='.repeat(65))
  console.log(`  Address:  http://0.0.0.0:${PORT}`)
  console.log(`  Local:    http://127.0.0.1:${PORT}`)
  console.log('')
  console.log('  API Endpoints:')
  console.log(`    POST /v1/chat/completions`)
  console.log(`    GET  /v1/models`)
  console.log(`    GET  /health`)
  console.log(`    GET  /stats`)
  console.log(`    POST /v0/management/providers   (add provider)`)
  console.log(`    POST /v0/management/accounts    (add account)`)
  console.log('')
  console.log('  Browser HTTP proxy config:')
  console.log(`    Server: <this-machine-ip>`)
  console.log(`    Port:   ${PORT}`)
  console.log('='.repeat(65))
  console.log('\n  Press Ctrl+C to stop\n')

  process.on('SIGINT', async () => {
    console.log('\n[TestProxy] Stopping...')
    await server.stop()
    console.log('[TestProxy] Stopped')
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await server.stop().catch(() => {})
    process.exit(0)
  })
}

// ─── 6. 主流程 ──────────────────────────────────────────────────────────────
;(async () => {
  console.log('[TestProxy] Starting standalone proxy test...')
  console.log(`[TestProxy] Chunk: ${chunkFiles[0]}`)
  console.log('')
  await initStore()
  await startProxy()
})().catch((err) => {
  console.error('[TestProxy] Fatal:', err)
  process.exit(1)
})
