/**
 * Cookie Session Manager - 通用网页会话保持器
 *
 * 为每个支持的服务商创建一个持久的 BrowserWindow（独立 session partition），
 * 用户只需在隐藏窗口中登录一次，之后自动监听 cookie 变化并注入到代理请求中。
 *
 * 支持的认证方式：
 * - cookie: 直接从 session.cookies 读取
 * - localStorage: 通过 executeJavaScript 读取
 * - networkHeader: 通过 webRequest.onBeforeSendHeaders 拦截
 */

import { BrowserWindow, session, Cookie, type WebContents } from 'electron'
import { EventEmitter } from 'events'
import { ProviderType } from './types'
import { getTokenExtractionConfig } from './tokenExtractionConfig'
import { logManager } from '../logger/manager'

export interface CookieSessionEvents {
  'cookie-changed': (providerType: ProviderType, cookies: Record<string, string>) => void
  'localstorage-changed': (providerType: ProviderType, data: Record<string, string>) => void
  'session-ready': (providerType: ProviderType) => void
  'session-error': (providerType: ProviderType, error: Error) => void
  'login-required': (providerType: ProviderType) => void
}

export interface CookieSessionConfig {
  providerType: ProviderType
  loginUrl: string
  cookieNames: string[]
  localStorageKeys?: string[]
  headerPattern?: { header: string; pattern: RegExp }
  targetDomains: string[]
  successUrlPatterns?: RegExp[]
  windowTitle?: string
  /** 是否在启动时自动打开登录窗口 */
  autoLogin?: boolean
}

const SESSION_PARTITION_PREFIX = 'persist:provider-'
const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
const COOKIE_WATCH_DEBOUNCE = 500 // ms

/**
 * Generic Cookie Session Manager
 * Manages persistent browser sessions for all providers
 */
export class CookieSessionManager extends EventEmitter {
  private sessions: Map<ProviderType, ProviderSession> = new Map()
  private refreshTimers: Map<ProviderType, NodeJS.Timeout> = new Map()
  private enabledProviders: ProviderType[] = []

  constructor() {
    super()
  }

  /**
   * Initialize sessions for specified providers
   */
  async initialize(providers: ProviderType[]): Promise<void> {
    this.enabledProviders = providers
    for (const providerType of providers) {
      await this.createSession(providerType)
    }
    console.log('[CookieSession] Initialized for:', providers.join(', '))
  }

  /**
   * Create a persistent session for a provider
   */
  private async createSession(providerType: ProviderType): Promise<void> {
    const config = getTokenExtractionConfig(providerType)
    if (!config) {
      console.log(`[CookieSession] No config for ${providerType}, skipping`)
      return
    }

    const partition = SESSION_PARTITION_PREFIX + providerType

    try {
      // Create persistent session
      const ses = session.fromPartition(partition)

      // Bypass SSL certificate verification for cookie sessions
      // This is needed because the local proxy intercepts HTTPS traffic
      // and re-signs certificates, which Electron doesn't trust by default
      ses.setCertificateVerifyProc((_request, callback) => {
        callback(0)
      })

      // Also auto-approve certificate errors during page navigation
      ses.on('certificate-error', (_event, _webContents, _url, _error, _certificate, callback) => {
        callback(0)
      })

      // Set up cookie change listener
      const cookieNames = config.tokenSources
        .filter(t => t.type === 'cookie')
        .map(t => t.key)

      ses.cookies.on('changed', async (_event, cookie: Cookie) => {
        if (cookieNames.includes(cookie.name) && !cookie.removed) {
          await this.onCookieChanged(providerType, cookie.name, cookie.value)
        }
      })

      // Create hidden BrowserWindow
      const window = new BrowserWindow({
        width: 400,
        height: 500,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition,
          webSecurity: true,
        },
      })

      // Prevent MaxListenersExceededWarning from accumulated page load listeners
      window.webContents.setMaxListeners(20)

      // Intercept network headers for token extraction
      if (config.tokenSources.some(t => t.type === 'networkHeader')) {
        window.webContents.on('did-start-navigation', () => {
          // Will be handled by webRequest
        })
      }

      // Set up page load event handlers BEFORE loading the page
      window.webContents.on('did-finish-load', async () => {
        console.log(`[CookieSession] ${providerType} page loaded`)
        logManager.info('[CookieSession] Session ready', { provider: providerType })

        // Extract initial cookies/localStorage
        const creds = await this.extractCredentials(providerType, ses, window.webContents)
        if (this.hasAnyCredential(creds)) {
          this.emit('session-ready', providerType)
          this.emit('cookie-changed', providerType, creds)
        }

        // Start periodic refresh
        this.startPeriodicRefresh(providerType, ses, window.webContents)
      })

      window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error(`[CookieSession] ${providerType} load failed:`, errorCode, errorDescription)
        logManager.error('[CookieSession] Page load failed', {
          provider: providerType,
          errorCode,
          errorDescription: String(errorDescription),
        })
        this.emit('session-error', providerType, new Error(errorDescription))
      })

      // Load provider page in background (non-blocking)
      // The session is already functional (cookie listeners are set up),
      // page load just pre-warms existing cookies/localStorage
      window.loadURL(config.loginUrl).catch((error) => {
        console.error(`[CookieSession] ${providerType} background load error:`, error)
      })

      // Monitor localStorage changes via polling (Electron doesn't have localStorage events)
      const localStorageKeys = config.tokenSources
        .filter(t => t.type === 'localStorage')
        .map(t => t.key)

      if (localStorageKeys.length > 0) {
        const lsInterval = setInterval(async () => {
          try {
            if (window.isDestroyed()) {
              clearInterval(lsInterval)
              return
            }
            const data = await this.extractLocalStorage(window.webContents, localStorageKeys)
            if (this.hasAnyLocalStorage(data)) {
              this.emit('localstorage-changed', providerType, data)
            }
          } catch {
            // ignore
          }
        }, 10000) // poll every 10s
      }

      this.sessions.set(providerType, {
        providerType,
        session: ses,
        window,
        partition,
        config,
        cookies: {},
        localStorage: {},
        lastExtractTime: 0,
      })

      console.log(`[CookieSession] Session created for ${providerType} (${partition})`)
    } catch (error) {
      console.error(`[CookieSession] Failed to create session for ${providerType}:`, error)
      this.emit('session-error', providerType, error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Handle cookie change event
   */
  private async onCookieChanged(providerType: ProviderType, name: string, value: string): Promise<void> {
    const sess = this.sessions.get(providerType)
    if (!sess) return

    sess.cookies[name] = value
    sess.lastExtractTime = Date.now()

    // Emit all cookies for the provider
    const allCreds = await this.getCredentials(providerType)
    this.emit('cookie-changed', providerType, allCreds)
    console.log(`[CookieSession] ${providerType}: cookie "${name}" changed (length: ${value.length})`)
  }

  /**
   * Extract all credentials from session (cookies + localStorage)
   */
  private async extractCredentials(
    providerType: ProviderType,
    ses: session,
    webContents: WebContents
  ): Promise<Record<string, string>> {
    const config = getTokenExtractionConfig(providerType)
    if (!config) return {}

    const creds: Record<string, string> = {}

    // Extract cookies
    try {
      const cookies = await ses.cookies.get({})
      for (const source of config.tokenSources.filter(t => t.type === 'cookie')) {
        const cookie = cookies.find(c => c.name === source.key)
        if (cookie?.value) {
          creds[source.alias || source.key] = cookie.value
        }
      }
    } catch (e) {
      console.error(`[CookieSession] ${providerType} cookie extraction error:`, e)
    }

    // Extract localStorage
    const localStorageKeys = config.tokenSources.filter(t => t.type === 'localStorage').map(t => t.key)
    if (localStorageKeys.length > 0 && !webContents.isDestroyed()) {
      try {
        const lsData = await this.extractLocalStorage(webContents, localStorageKeys)
        Object.assign(creds, lsData)
      } catch (e) {
        console.error(`[CookieSession] ${providerType} localStorage extraction error:`, e)
      }
    }

    return creds
  }

  /**
   * Extract localStorage keys via executeJavaScript
   */
  private async extractLocalStorage(
    webContents: WebContents,
    keys: string[]
  ): Promise<Record<string, string>> {
    if (webContents.isDestroyed()) return {}

    const script = keys.map(k => `JSON.stringify(localStorage.getItem(${JSON.stringify(k)}))`).join(',')
    const result = await webContents.executeJavaScript(`(() => { try { return [${script}]; } catch { return []; } })()`)

    const data: Record<string, string> = {}
    keys.forEach((key, i) => {
      if (result[i] !== null && result[i] !== undefined) {
        data[key] = result[i]
      }
    })
    return data
  }

  /**
   * Check if any cookie credential exists
   */
  private hasAnyCredential(creds: Record<string, string>): boolean {
    return Object.values(creds).some(v => v && v.length > 0)
  }

  /**
   * Check if any localStorage credential exists
   */
  private hasAnyLocalStorage(data: Record<string, string>): boolean {
    return Object.values(data).some(v => v && v.length > 0)
  }

  /**
   * Start periodic session refresh
   */
  private startPeriodicRefresh(
    providerType: ProviderType,
    ses: session,
    webContents: WebContents
  ): void {
    // Clear existing timer
    const existing = this.refreshTimers.get(providerType)
    if (existing) clearInterval(existing)

    const timer = setInterval(async () => {
      const sess = this.sessions.get(providerType)
      if (!sess?.window || sess.window.isDestroyed()) {
        clearInterval(timer)
        return
      }

      try {
        const creds = await this.extractCredentials(providerType, ses, webContents)
        if (this.hasAnyCredential(creds)) {
          this.emit('cookie-changed', providerType, creds)
        }
      } catch {
        // silently ignore refresh errors
      }
    }, REFRESH_INTERVAL)

    this.refreshTimers.set(providerType, timer)
  }

  /**
   * Get current credentials for a provider
   */
  async getCredentials(providerType: ProviderType): Promise<Record<string, string>> {
    const sess = this.sessions.get(providerType)
    if (!sess) return {}

    const config = getTokenExtractionConfig(providerType)
    if (!config) return {}

    const creds: Record<string, string> = { ...sess.cookies }

    // Refresh localStorage
    const localStorageKeys = config.tokenSources.filter(t => t.type === 'localStorage').map(t => t.key)
    if (localStorageKeys.length > 0 && !sess.window.isDestroyed()) {
      try {
        const lsData = await this.extractLocalStorage(sess.window.webContents, localStorageKeys)
        Object.assign(creds, lsData)
      } catch {
        // ignore
      }
    }

    return creds
  }

  /**
   * Check if a provider session is ready (has credentials)
   */
  async isSessionReady(providerType: ProviderType): Promise<boolean> {
    const creds = await this.getCredentials(providerType)
    return this.hasAnyCredential(creds)
  }

  /**
   * Wipe every trace of a previous login for this provider.
   *
   * Both partitions are `persist:` prefixed, so cookies, localStorage and the
   * IndexedDB behind them survive restarts. That is what made re-login
   * impossible: the login window reopened holding the old session, the page
   * finished loading already authenticated, and the flow reported success
   * before the user could enter a phone number.
   *
   * Closing any open window first avoids a live webContents writing the old
   * cookies straight back after they are cleared.
   */
  async clearLogin(providerType: ProviderType): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Tear down the live session and its window, if present.
      const existing = this.sessions.get(providerType)
      if (existing) {
        try {
          if (existing.window && !existing.window.isDestroyed()) {
            existing.window.destroy()
          }
        } catch (error) {
          console.error(`[CookieSession] Failed to destroy window for ${providerType}:`, error)
        }
        this.sessions.delete(providerType)
      }

      // 2. Wipe both partitions: the persistent one and the login one.
      const partitions = [
        SESSION_PARTITION_PREFIX + providerType,
        SESSION_PARTITION_PREFIX + providerType + '-login',
      ]

      for (const partition of partitions) {
        const ses = session.fromPartition(partition)
        await ses.clearStorageData()
        await ses.clearCache()
        console.log(`[CookieSession] Cleared storage for ${partition}`)
      }

      // 3. Tell listeners this provider now has no credentials.
      this.emit('cookie-changed', providerType, {})
      console.log(`[CookieSession] Login state cleared for ${providerType}`)

      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to clear login state'
      console.error(`[CookieSession] clearLogin failed for ${providerType}:`, error)
      return { success: false, error: msg }
    }
  }

  /**
   * Open login window for a provider (user-facing)
   */
  async openLoginWindow(providerType: ProviderType): Promise<BrowserWindow | null> {
    const config = getTokenExtractionConfig(providerType)
    if (!config) return null

    // Reuse existing session's window if available, or create new
    const sess = this.sessions.get(providerType)
    if (sess && !sess.window.isDestroyed()) {
      // Show existing window for login
      sess.window.show()
      sess.window.focus()
      await sess.window.loadURL(config.loginUrl)
      return sess.window
    }

    // Create new visible window for login
    const partition = SESSION_PARTITION_PREFIX + providerType + '-login'
    const ses = session.fromPartition(partition)

    // Bypass SSL certificate verification for cookie sessions
    ses.setCertificateVerifyProc((_request, callback) => {
      callback(0)
    })

    // Also auto-approve certificate errors during page navigation
    ses.on('certificate-error', (_event, _webContents, _url, _error, _certificate, callback) => {
      callback(0)
    })

    const window = new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition,
        webSecurity: true,
      },
    })

    await window.loadURL(config.loginUrl)

    window.webContents.on('did-finish-load', async () => {
      const ses = session.fromPartition(partition)
      const creds = await this.extractCredentials(providerType, ses, window.webContents)
      if (this.hasAnyCredential(creds)) {
        this.emit('session-ready', providerType)
        this.emit('cookie-changed', providerType, creds)
        // Migrate to persistent partition
        await this.createSession(providerType)
      }
    })

    window.on('closed', () => {
      console.log(`[CookieSession] Login window closed for ${providerType}`)
    })

    return window
  }

  /**
   * Get all sessions status
   */
  getStatus(): Record<ProviderType, { ready: boolean; cookieCount: number }> {
    const status: Record<string, { ready: boolean; cookieCount: number }> = {}
    for (const [ptype, sess] of this.sessions) {
      const cookieCount = Object.keys(sess.cookies).length
      status[ptype] = {
        ready: cookieCount > 0,
        cookieCount,
      }
    }
    return status as Record<ProviderType, { ready: boolean; cookieCount: number }>
  }

  /**
   * Destroy all sessions
   */
  destroy(): void {
    for (const [providerType, sess] of this.sessions) {
      const timer = this.refreshTimers.get(providerType)
      if (timer) clearInterval(timer)
      if (sess.window && !sess.window.isDestroyed()) {
        sess.window.close()
      }
    }
    this.sessions.clear()
    this.refreshTimers.clear()
    console.log('[CookieSession] All sessions destroyed')
  }
}

interface ProviderSession {
  providerType: ProviderType
  session: session
  window: BrowserWindow
  partition: string
  config: ReturnType<typeof getTokenExtractionConfig>
  cookies: Record<string, string>
  localStorage: Record<string, string>
  lastExtractTime: number
}

/**
 * Singleton instance
 */
export const cookieSessionManager = new CookieSessionManager()
export default cookieSessionManager
