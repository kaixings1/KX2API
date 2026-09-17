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
// The exact endpoint the adapter calls. Cookies are resolved against this URL
// so path-scoped affinity cookies match the route they belong to.
const CHAT_STREAM_URL = 'https://chat.stepfun.com/api/agent/capy.agent.v1.AgentService/ChatStream'
const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
const OASIS_TOKEN_COOKIE = 'Oasis-Token'
const OASIS_WEBID_COOKIE = 'Oasis-Webid'
// Cookies whose rotation must push fresh credentials to the adapter.
const WATCHED_COOKIES = new Set([OASIS_TOKEN_COOKIE, OASIS_WEBID_COOKIE, 'INGRESSCOOKIE', 'WS-AFFINITY'])

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
  private currentCookieHeader: string = ''
  private isReady: boolean = false
  private refreshTimer: NodeJS.Timeout | null = null
  private checkTimer: NodeJS.Timeout | null = null
  /** Cookie changed 日志防抖缓存（同 cookie 名 N ms 内只记首次，避免 affinity 轮换刷屏） */
  private lastCookieLogAt: Record<string, number> = {}
  /** Credentials updated 日志防抖（affinity 高频轮换时避免日志刷屏，状态更新不受影响） */
  private lastCredsLogAt: number = 0
  private static readonly COOKIE_LOG_DEBOUNCE_MS = 1000

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
      this.session.setCertificateVerifyProc((_request: Electron.CertificateVerifyProcRequest, callback: (verificationResult: number) => void) => {
        callback(0)
      })

      this.session.on('certificate-error', (_event: Electron.Event, _webContents: Electron.WebContents, _url: string, _error: string, _certificate: Electron.Certificate, callback: (isTrusted: boolean) => void) => {
        callback(0)
      })

      // Listen for cookie changes. Affinity cookies rotate on their own
      // schedule, so they must trigger a re-extract too — otherwise the adapter
      // keeps sending the cookie that was current when the token last changed.
      this.session.cookies.on('changed', async (_event: Electron.Event, cookie: Cookie) => {
        if (WATCHED_COOKIES.has(cookie.name)) {
          // 防抖：同 cookie 名短时间内的重复变更只记首次，避免
          // INGRESSCOOKIE/WS-AFFINITY 等 affinity cookie 在多路径上轮换刷屏。
          const now = Date.now()
          if (now - (this.lastCookieLogAt[cookie.name] ?? 0) >= StepFunSessionManager.COOKIE_LOG_DEBOUNCE_MS) {
            this.lastCookieLogAt[cookie.name] = now
            console.log(`[StepFunSession] Cookie changed: ${cookie.name} path=${cookie.path} (length: ${cookie.value?.length || 0})`)
          }
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
      // A flat Record<string,string> cannot represent this session: chat.stepfun.com
      // stores FOUR cookies named INGRESSCOOKIE, distinguished only by path
      // (/api/agent/(.*), /api/(.*), /api/user/(.*), /passport/(.*)), each bound to a
      // different backend node. Flattening them left whichever came last, so
      // ChatStream received the affinity cookie of an unrelated route and the
      // gateway answered permission_denied / need sign in.
      //
      // RFC 6265 requires sending EVERY cookie whose path prefix matches the
      // request, longest path first — ChatStream legitimately carries two
      // INGRESSCOOKIE values. So we emit a pre-built Cookie header string
      // rather than a name→value map, which structurally cannot hold duplicates.
      // Query by domain, then do the path matching ourselves.
      //
      // cookies.get({ url }) would look right, but Chromium treats a cookie
      // path as a literal prefix. StepFun stores these paths in regex form
      // ("/api/agent/(.*)"), so a URL query matches nothing at all and the
      // session silently yields zero cookies.
      const all = await this.session.cookies.get({ domain: 'chat.stepfun.com' })

      const requestPath = new URL(CHAT_STREAM_URL).pathname
      const matchesPath = (cookiePath: string, reqPath: string): boolean => {
        // Normalise the stored regex-ish form down to its literal prefix.
        const literal = (cookiePath || '/').replace(/\(\.\*\)$/, '').replace(/\(\?.*?\)/g, '') || '/'
        return reqPath.startsWith(literal)
      }

      // Longest path first, matching browser ordering.
      const ordered = [...all]
        .filter(c => c.value && matchesPath(c.path || '/', requestPath))
        .sort((a, b) => (b.path || '/').length - (a.path || '/').length)

      const cookieHeader = ordered.map(c => `${c.name}=${c.value}`).join('; ')

      const scalar: Record<string, string> = {}
      for (const c of ordered) scalar[c.name] = c.value

      // Auth cookies live at path "/" so they are part of `ordered`, but read
      // them from the full set so a path mismatch can never hide the token.
      const tokenCookie = all.find((c: Electron.Cookie) => c.name === OASIS_TOKEN_COOKIE)?.value || scalar[OASIS_TOKEN_COOKIE] || ''
      const webIdCookie = all.find((c: Electron.Cookie) => c.name === OASIS_WEBID_COOKIE)?.value || scalar[OASIS_WEBID_COOKIE] || ''

      if (!tokenCookie) {
        console.warn('[StepFunSession] No Oasis-Token cookie in partition; user must log in')
      }

      const token = tokenCookie
      const webId = webIdCookie

      // Gateway affinity cookies rotate far more often than the Oasis-Token.
      const affinityChanged = this.hasAffinityChanged(scalar)

      if (token && (token !== this.currentToken || webId !== this.currentWebId || affinityChanged)) {
        this.currentToken = token
        this.currentWebId = webId
        this.currentCookies = scalar
        this.currentCookieHeader = cookieHeader
        // 状态照常更新（token-updated 必须每次都发），但 console 日志做防抖，
        // 避免 affinity cookie 高频轮换时同一条「Credentials updated」疯狂刷屏。
        const now = Date.now()
        if (now - (this.lastCredsLogAt ?? 0) >= StepFunSessionManager.COOKIE_LOG_DEBOUNCE_MS) {
          this.lastCredsLogAt = now
          console.log(`[StepFunSession] Credentials updated: token=${token.length > 0} webId=${webId.length > 0} cookies=${ordered.length} affinityChanged=${affinityChanged} names=[${ordered.map(c => c.name).join(',')}]`)
        }
        this.emit('token-updated', token, webId, { Cookie: cookieHeader })
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
   * Detect rotation of the gateway affinity cookies.
   *
   * INGRESSCOOKIE / WS-AFFINITY encode a backend-node binding plus an expiry
   * timestamp. The edge gateway uses them to route the request to the node that
   * holds the session; once they expire the request is rejected before it ever
   * reaches the agent service.
   */
  private hasAffinityChanged(next: Record<string, string>): boolean {
    const keys = ['INGRESSCOOKIE', 'WS-AFFINITY']
    for (const key of keys) {
      if ((next[key] || '') !== (this.currentCookies[key] || '')) return true
    }
    return false
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
   * Get all current cookies as a name→value map.
   *
   * Lossy for duplicate names (the four path-scoped INGRESSCOOKIE entries
   * collapse to one). Prefer getCookieHeader() when building a request.
   */
  getCookies(): Record<string, string> {
    return { ...this.currentCookies }
  }

  /**
   * Get the Cookie header exactly as the browser would send it to ChatStream,
   * including every path-matched cookie in longest-path-first order.
   */
  getCookieHeader(): string {
    return this.currentCookieHeader
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
    this.currentCookieHeader = ''
    this.isReady = false
  }
}

/**
 * Singleton instance
 */
export const stepfunSessionManager = new StepFunSessionManager()
export default stepfunSessionManager
