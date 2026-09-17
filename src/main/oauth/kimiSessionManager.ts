/**
 * Kimi Persistent Session Manager
 *
 * Maintains a hidden BrowserWindow with a persistent session partition
 * to keep Kimi login state alive, similar to how browser cookies work.
 *
 * When the JWT token expires, the adapter can read a fresh cookie
 * from this session instead of requiring the user to manually re-login.
 */

import { BrowserWindow, session, Cookie } from 'electron'
import { EventEmitter } from 'events'
import { logManager } from '../logger/manager'

const KIMI_SESSION_PARTITION = 'persist:kimi-login'
const KIMI_API_BASE = 'https://www.kimi.com'
const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes
const KIMI_AUTH_COOKIE_NAME = 'kimi-auth'

export interface KimiSessionManagerEvents {
  'token-found': (token: string) => void
  'token-expired': () => void
  'session-ready': () => void
  'session-error': (error: Error) => void
}

export class KimiSessionManager extends EventEmitter {
  private window: BrowserWindow | null = null
  private session: session | null = null
  private currentToken: string | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  private isReady: boolean = false
  private refreshCount: number = 0
  private maxRefreshCount: number = 3

  constructor() {
    super()
  }

  /**
   * Initialize the persistent Kimi session
   */
  async initialize(): Promise<void> {
    try {
      // Create or get the persistent session
      this.session = session.fromPartition(KIMI_SESSION_PARTITION)

      // Set up cookie change listener
      this.session.cookies.on('changed', async (_event, cookie) => {
        if (cookie.name === KIMI_AUTH_COOKIE_NAME && !cookie.removed) {
          const len = cookie.value?.length || 0
          console.log('[KimiSession] Cookie refreshed:', KIMI_AUTH_COOKIE_NAME, 'value length:', len)
          this.currentToken = cookie.value || null
          if (this.currentToken) {
            this.emit('token-found', this.currentToken)
          }
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
          partition: KIMI_SESSION_PARTITION,
          webSecurity: true,
        },
      })

      // Load Kimi page to maintain session
      await this.window.loadURL(KIMI_API_BASE)

      this.window.webContents.on('did-finish-load', async () => {
        console.log('[KimiSession] Page loaded, checking for cookies...')
        const token = await this.extractToken()
        this.isReady = true
        console.log('[KimiSession] Session ready, token found:', !!token, 'token length:', token?.length || 0)
        logManager.info('[KimiSession] Session ready', { tokenFound: !!token, tokenLength: token?.length || 0 })
        this.emit('session-ready')

        // Start periodic refresh
        this.startPeriodicRefresh()
      })

      this.window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error('[KimiSession] Failed to load page:', errorCode, errorDescription)
        logManager.error('[KimiSession] Failed to load page', { errorCode, errorDescription: String(errorDescription) })
        this.emit('session-error', new Error(`加载 Kimi 页面失败：${errorDescription}`))
      })

      console.log('[KimiSession] Initialized with partition:', KIMI_SESSION_PARTITION)
    } catch (error) {
      console.error('[KimiSession] Initialization failed:', error)
      this.emit('session-error', error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Extract the current token from cookies
   */
  async extractToken(): Promise<string | null> {
    if (!this.session) return null

    try {
      const cookies = await this.session.cookies.get({})
      const kimiAuthCookie = cookies.find(c => c.name === KIMI_AUTH_COOKIE_NAME)

      if (kimiAuthCookie?.value) {
        this.currentToken = kimiAuthCookie.value
        console.log('[KimiSession] Extracted token, length:', this.currentToken.length)
        return this.currentToken
      }

      console.log('[KimiSession] No kimi-auth cookie found, cookies available:', cookies.map(c => c.name).join(', '))
      return null
    } catch (error) {
      console.error('[KimiSession] Failed to extract token:', error)
      return null
    }
  }

  /**
   * Get the current token
   */
  getToken(): string | null {
    return this.currentToken
  }

  /**
   * Check if the session is ready
   */
  ready(): boolean {
    return this.isReady
  }

  /**
   * Refresh the session by reloading the Kimi page
   */
  async refreshSession(): Promise<string | null> {
    if (!this.window || this.window.isDestroyed()) {
      console.log('[KimiSession] Window not available, cannot refresh')
      return null
    }

    this.refreshCount++
    console.log('[KimiSession] Refreshing session (attempt', this.refreshCount, '/', this.maxRefreshCount, ')')

    try {
      await this.window.reload()
      // Wait a bit for the page to load and cookies to be set
      await new Promise(resolve => setTimeout(resolve, 2000))
      return await this.extractToken()
    } catch (error) {
      console.error('[KimiSession] Refresh failed:', error)
      return null
    }
  }

  /**
   * Start periodic session refresh
   */
  private startPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }

    this.refreshTimer = setInterval(async () => {
      const token = await this.extractToken()
      if (token) {
        // Token is still valid, reset refresh count
        this.refreshCount = 0
      } else {
        // Token might have expired, try refreshing
        if (this.refreshCount < this.maxRefreshCount) {
          const newToken = await this.refreshSession()
          if (newToken) {
            this.emit('token-found', newToken)
          } else {
            this.emit('token-expired')
          }
        } else {
          console.log('[KimiSession] Max refresh attempts reached, user needs to re-login')
          this.emit('token-expired')
        }
      }
    }, REFRESH_INTERVAL)
  }

  /**
   * Stop the session manager
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }

    if (this.window && !this.window.isDestroyed()) {
      this.window.close()
    }
    this.window = null
    this.session = null
    this.currentToken = null
    this.isReady = false
    this.refreshCount = 0
  }
}

/**
 * Singleton instance
 */
export const kimiSessionManager = new KimiSessionManager()
export default kimiSessionManager
