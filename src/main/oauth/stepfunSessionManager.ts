/**
 * StepFun Persistent Session Manager
 *
 * Maintains a hidden BrowserWindow with a persistent session partition
 * to keep StepFun login state alive. The web session token (Oasis-Token)
 * expires after a few hours, but the browser session can auto-refresh
 * via periodic page reloads, similar to how a real browser tab keeps you logged in.
 *
 * This eliminates the need for users to repeatedly log in.
 */

import { BrowserWindow, session, Cookie } from 'electron'
import { EventEmitter } from 'events'
import { logManager } from '../logger/manager'

const STEPFUN_SESSION_PARTITION = 'persist:stepfun-login'
const STEPFUN_CHAT_URL = 'https://chat.stepfun.com/'
const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
const OASIS_TOKEN_COOKIE = 'Oasis-Token'
const OASIS_WEBID_COOKIE = 'Oasis-Webid'

export interface StepFunSessionEvents {
  'token-updated': (token: string, webId: string, cookies: Record<string, string>) => void
  'session-ready': () => void
  'session-error': (error: Error) => void
}

export class StepFunSessionManager extends EventEmitter {
  private window: BrowserWindow | null = null
  private session: session | null = null
  private currentToken: string = ''
  private currentWebId: string = ''
  private currentCookies: Record<string, string> = {}
  private isReady: boolean = false
  private refreshTimer: NodeJS.Timeout | null = null
  private checkTimer: NodeJS.Timeout | null = null

  constructor() {
    super()
  }

  /**
   * Initialize the persistent StepFun session
   */
  async initialize(): Promise<void> {
    try {
      this.session = session.fromPartition(STEPFUN_SESSION_PARTITION)

      // Bypass SSL certificate verification
      this.session.setCertificateVerifyProc((_request, callback) => {
        callback(0)
      })

      this.session.on('certificate-error', (_event, _webContents, _url, _error, _certificate, callback) => {
        callback(0)
      })

      // Listen for cookie changes
      this.session.cookies.on('changed', async (_event, cookie: Cookie) => {
        if (cookie.name === OASIS_TOKEN_COOKIE || cookie.name === OASIS_WEBID_COOKIE) {
          console.log(`[StepFunSession] Cookie changed: ${cookie.name} (length: ${cookie.value?.length || 0})`)
          await this.extractCredentials()
        }
      })

      // Create hidden BrowserWindow
      this.window = new BrowserWindow({
        width: 400,
        height: 500,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: STEPFUN_SESSION_PARTITION,
          webSecurity: true,
        },
      })

      this.window.webContents.setMaxListeners(20)

      this.window.webContents.on('did-finish-load', async () => {
        console.log('[StepFunSession] Chat page loaded')
        await this.extractCredentials()
        if (!this.isReady) {
          this.isReady = true
          this.emit('session-ready')
        }
        this.startPeriodicRefresh()
      })

      this.window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error('[StepFunSession] Page load failed:', errorCode, errorDescription)
        logManager.error('[StepFunSession] Page load failed', { errorCode, errorDescription: String(errorDescription) })
        this.emit('session-error', new Error(errorDescription))
      })

      // Load chat page to maintain session
      await this.window.loadURL(STEPFUN_CHAT_URL)

      // Also periodically check for credential updates
      this.startPeriodicCheck()

      console.log('[StepFunSession] Initialized with partition:', STEPFUN_SESSION_PARTITION)
    } catch (error) {
      console.error('[StepFunSession] Initialization failed:', error)
      this.emit('session-error', error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Extract current credentials from the session
   */
  private async extractCredentials(): Promise<void> {
    if (!this.session) return

    try {
      const cookies = await this.session.cookies.get({})
      const cookieMap: Record<string, string> = {}
      for (const c of cookies) {
        if (c.value) {
          cookieMap[c.name] = c.value
        }
      }

      const token = cookieMap[OASIS_TOKEN_COOKIE] || ''
      const webId = cookieMap[OASIS_WEBID_COOKIE] || ''

      if (token && (token !== this.currentToken || webId !== this.currentWebId)) {
        this.currentToken = token
        this.currentWebId = webId
        this.currentCookies = cookieMap
        console.log(`[StepFunSession] Credentials updated: token=${token.length > 0} webId=${webId.length > 0} cookies=${Object.keys(cookieMap).length}`)
        this.emit('token-updated', token, webId, cookieMap)
      }
    } catch (error) {
      console.error('[StepFunSession] Failed to extract credentials:', error)
    }
  }

  /**
   * Start periodic page reload to keep session alive
   */
  private startPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }

    this.refreshTimer = setInterval(async () => {
      if (!this.window || this.window.isDestroyed()) return

      try {
        console.log('[StepFunSession] Periodic refresh: reloading chat page')
        await this.window.reload()
      } catch (error) {
        console.error('[StepFunSession] Refresh failed:', error)
      }
    }, REFRESH_INTERVAL)
  }

  /**
   * Start periodic credential check (for cookie changes that don't trigger the 'changed' event)
   */
  private startPeriodicCheck(): void {
    this.checkTimer = setInterval(async () => {
      await this.extractCredentials()
    }, REFRESH_INTERVAL / 2)
  }

  /**
   * Get the current token
   */
  getToken(): string {
    return this.currentToken
  }

  /**
   * Get the current webId
   */
  getWebId(): string {
    return this.currentWebId
  }

  /**
   * Get all current cookies
   */
  getCookies(): Record<string, string> {
    return { ...this.currentCookies }
  }

  /**
   * Check if the session has credentials
   */
  hasCredentials(): boolean {
    return this.currentToken.length > 0 && this.currentWebId.length > 0
  }

  /**
   * Check if the session is ready
   */
  ready(): boolean {
    return this.isReady
  }

  /**
   * Force reload the page to refresh the session
   */
  async refresh(): Promise<void> {
    if (!this.window || this.window.isDestroyed()) return
    try {
      await this.window.reload()
      await new Promise(resolve => setTimeout(resolve, 2000))
      await this.extractCredentials()
    } catch (error) {
      console.error('[StepFunSession] Manual refresh failed:', error)
    }
  }

  /**
   * Stop the session manager
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.close()
    }
    this.window = null
    this.session = null
    this.currentToken = ''
    this.currentWebId = ''
    this.currentCookies = {}
    this.isReady = false
  }
}

/**
 * Singleton instance
 */
export const stepfunSessionManager = new StepFunSessionManager()
export default stepfunSessionManager
