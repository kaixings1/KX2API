/**
 * In-App Login Manager
 * Manages in-app browser window for OAuth login and token extraction
 */

import { BrowserWindow, session, Session } from 'electron'
import { EventEmitter } from 'events'
import { ProviderType } from './types'
import { TokenExtractionConfig, getTokenExtractionConfig, TokenSource } from './tokenExtractionConfig'

export interface InAppLoginResult {
  success: boolean
  credentials?: Record<string, string>
  error?: string
}

export interface TokenFoundEvent {
  key: string
  value: string
}

export interface InAppLoginOptions {
  providerId: string
  providerType: ProviderType
  timeout?: number
  proxyMode?: 'system' | 'none'
}

const DEFAULT_TIMEOUT = 300000 // 5 minutes
const MIN_LOGIN_TIME = 5000 // Minimum time before checking tokens (5 seconds)

export class InAppLoginManager extends EventEmitter {
  private loginWindow: BrowserWindow | null = null
  private loginSession: Session | null = null
  private foundTokens: Map<string, string> = new Map()
  private config: TokenExtractionConfig | null = null
  private isCompleted: boolean = false
  private timeoutId: NodeJS.Timeout | null = null
  private resolvePromise: ((result: InAppLoginResult) => void) | null = null
  private loginStartTime: number = 0
  private lastTokenCheckTime: number = 0
  private options: InAppLoginOptions | null = null

  constructor() {
    super()
  }

  private getTokenKey(source: TokenSource): string {
    return source.alias || source.key
  }

  async startLogin(options: InAppLoginOptions): Promise<InAppLoginResult> {
    if (this.loginWindow) {
      return {
        success: false,
        error: 'A login window is already open',
      }
    }

    this.config = getTokenExtractionConfig(options.providerType)
    if (!this.config) {
      return {
        success: false,
        error: `No token extraction config found for provider: ${options.providerType}`,
      }
    }

    this.foundTokens.clear()
    this.isCompleted = false
    this.loginStartTime = Date.now()
    this.lastTokenCheckTime = 0
    this.options = options

    return new Promise((resolve) => {
      this.resolvePromise = resolve

      this.timeoutId = setTimeout(() => {
        this.complete({
          success: false,
          error: 'Login timeout',
        })
      }, options.timeout || DEFAULT_TIMEOUT)

      this.emit('status', { status: 'starting', message: 'Opening login window...' })

      this.createLoginWindow()
      this.setupTokenInterception()
    })
  }

  private createLoginWindow(): void {
    if (!this.config) return

    const partition = `persist:oauth-${Date.now()}`
    this.loginSession = session.fromPartition(partition)

    // Bypass SSL certificate verification for login sessions
    this.loginSession.setCertificateVerifyProc((_request, callback) => {
      callback(0)
    })
    this.loginSession.on('certificate-error', (_event, _webContents, _url, _error, _certificate, callback) => {
      callback(0)
    })

    if (this.options?.proxyMode === 'none') {
      this.loginSession.setProxy({ mode: 'direct' }).catch((error) => {
        console.error('[InAppLogin] Failed to set direct proxy:', error)
      })
    }

    this.loginWindow = new BrowserWindow({
      width: 500,
      height: 700,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition,
        webSecurity: true,
        javascript: true,
      },
      title: this.config.windowTitle || 'Login',
      autoHideMenuBar: true,
    })

    this.loginWindow.once('ready-to-show', () => {
      this.loginWindow?.show()
      this.emit('status', { status: 'ready', message: 'Login window ready - please log in' })
    })

    this.loginWindow.on('closed', () => {
      if (!this.isCompleted) {
        this.complete({
          success: false,
          error: 'Login window was closed',
        })
      }
    })

    this.loginWindow.loadURL(this.config.loginUrl).catch((error) => {
      this.complete({
        success: false,
        error: `Failed to load login page: ${error.message}`,
      })
    })
  }

  private setupTokenInterception(): void {
    if (!this.loginSession || !this.config) return

    // Intercept response headers to capture Set-Cookie headers
    // This is needed for HttpOnly + Secure cookies that may not be accessible via cookies.get()
    this.loginSession.webRequest.onHeadersReceived((details, callback) => {
      if (this.isCompleted) {
        callback({})
        return
      }

      const setCookieHeaders = details.responseHeaders?.['set-cookie'] || details.responseHeaders?.['Set-Cookie']
      if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
        for (const cookieHeader of setCookieHeaders) {
          console.log('[InAppLogin] Set-Cookie header:', cookieHeader.split(';')[0]?.trim()?.split('=')[0] + '=[REDACTED]')
          
          const cookieParts = cookieHeader.split(';')
          const nameValue = cookieParts[0]?.trim()
          if (nameValue) {
            const equalIndex = nameValue.indexOf('=')
            if (equalIndex > 0) {
              const name = nameValue.substring(0, equalIndex)
              let value = nameValue.substring(equalIndex + 1)
              
              // Remove surrounding quotes from the value (RFC 6265 allows quoted cookie values)
              if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1)
                console.log('[InAppLogin] Removed quotes from cookie value:', name)
              }
              
              for (const source of this.config!.tokenSources) {
                if (source.type === 'cookie' && name === source.key) {
                  console.log('[InAppLogin] Found target cookie in Set-Cookie header:', name)
                  if (this.isValidToken(value)) {
                    console.log('[InAppLogin] Cookie token is valid from Set-Cookie header')
                    this.emit('tokenFound', { key: this.getTokenKey(source), value: value })
                  }
                }
              }
            }
          }
        }
      }

      callback({})
    })

    this.loginSession.webRequest.onBeforeSendHeaders((details, callback) => {
      if (this.isCompleted) {
        callback({ requestHeaders: details.requestHeaders })
        return
      }

      if (!this.hasMinTimePassed()) {
        callback({ requestHeaders: details.requestHeaders })
        return
      }

      const authHeader = details.requestHeaders['Authorization'] || details.requestHeaders['authorization']
      if (authHeader) {
        for (const source of this.config!.tokenSources) {
          if (source.type === 'networkHeader') {
            let token = authHeader
            if (source.extractPattern) {
              const match = authHeader.match(new RegExp(source.extractPattern))
              if (match && match[1]) {
                token = match[1]
              }
            } else if (authHeader.startsWith('Bearer ')) {
              token = authHeader.substring(7)
            }
            if (this.isValidToken(token)) {
              this.emit('tokenFound', { key: source.key, value: token })
            }
          }
        }
      }

      callback({ requestHeaders: details.requestHeaders })
    })

    this.loginSession.cookies.on('changed', async (_event, cookie, _cause, removed) => {
      if (this.isCompleted || removed) return

      console.log('[InAppLogin] Cookie changed:', { name: cookie.name, value: cookie.value ? '[REDACTED]' : 'null', removed })

      if (!this.hasMinTimePassed()) {
        console.log('[InAppLogin] Min time not passed, skipping cookie check')
        return
      }

      for (const source of this.config!.tokenSources) {
        if (source.type === 'cookie' && cookie.name === source.key) {
          console.log('[InAppLogin] Cookie matches source key:', source.key)
          if (this.isValidToken(cookie.value)) {
            console.log('[InAppLogin] Cookie token is valid, emitting tokenFound')
            this.emit('tokenFound', { key: this.getTokenKey(source), value: cookie.value })
          } else {
            console.log('[InAppLogin] Cookie token is invalid:', cookie.value ? '[REDACTED]' : 'null')
          }
        }
      }

      console.log('[InAppLogin] Checking all cookies after change')
      await this.checkForTokens()
    })

    this.loginWindow?.webContents.on('did-finish-load', () => {
      console.log('[InAppLogin] Page finished loading, starting token checks')
      this.delayedTokenCheck()
    })

    this.loginWindow?.webContents.on('did-navigate-in-page', () => {
      console.log('[InAppLogin] Page navigated, starting delayed token check')
      this.delayedTokenCheck()
    })

    // [StepFun] Capture all API requests to discover chat.stepfun.com endpoints
    if (this.config && (this.config.loginUrl.includes('stepfun.com') || this.config.loginUrl.includes('chat.stepfun.com'))) {
      this.loginSession.webRequest.onCompleted({ urls: ['*://chat.stepfun.com/*'] }, (details) => {
        if (this.isCompleted) return

        const url = details.url
        const method = details.method || 'GET'
        const statusCode = details.statusCode

        // Filter out static resources
        const isStaticResource = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)(\?|$)/i.test(url) ||
          url.includes('/_next/static/') ||
          url.includes('/_next/image/') ||
          url.includes('/favicon') ||
          url.includes('/manifest')

        if (!isStaticResource) {
          console.log(`[InAppLogin][StepFun API] ${method} ${url} → ${statusCode}`)
        }
      })
    }
  }

  private hasMinTimePassed(): boolean {
    return Date.now() - this.loginStartTime >= MIN_LOGIN_TIME
  }

  private delayedTokenCheck(): void {
    const now = Date.now()
    if (now - this.lastTokenCheckTime < 2000) return
    this.lastTokenCheckTime = now

    setTimeout(() => {
      if (this.isCompleted) return
      if (!this.loginWindow || this.loginWindow.isDestroyed()) return
      if (this.loginWindow.webContents.isDestroyed()) return
      if (this.hasMinTimePassed()) {
        this.checkForTokens()
      }
    }, 1000)
  }

  private isValidToken(value: string): boolean {
    if (!value || value.length < 5) {
      return false
    }

    // StepFun: the Oasis-Token is two base64url JWTs joined by "...". Validate
    // it properly rather than falling through to the permissive rules below,
    // which accepted page-chrome cookies like "sidebar_state=false" and made
    // the window report success seconds after opening, before any login.
    if (value.includes('...') || (value.startsWith('eyJ') && value.includes('.'))) {
      return this.validateOasisToken(value)
    }

    // JWE format (5 parts) - used by Perplexity and some other providers
    if (value.startsWith('eyJ')) {
      const parts = value.split('.')
      if (parts.length === 5) {
        return value.length >= 100
      }
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
          if (payload.email && payload.email.includes('@guest.com')) return false
          return !!(payload.app_id || payload.sub || payload.exp || payload.id || payload.user_id || payload.uid || payload.email)
        } catch {
          return false
        }
      }
    }

    if (value.length >= 64 && /^[a-zA-Z0-9_\-+/*]+$/.test(value)) return true
    if (value.length >= 32 && /^[a-zA-Z0-9_\-+/*]+$/.test(value)) return true
    if (value.length >= 20 && /^[a-zA-Z0-9_\-+/]+=*$/.test(value)) return true

    // Short opaque values (device ids, user ids). Kept, but note this is why
    // callers must not treat any single match as a completed login on its own.
    return value.length >= 5 && !/\s/.test(value)
  }

  /**
   * Validate a StepFun Oasis-Token.
   *
   * The token is `<jwt>...<jwt>`; the first payload carries the account state
   * (activated, exp, oasis_id) and the second identifies the device (app_id,
   * device_id, platform).
   *
   * Two conditions matter, both learned from the adapter rejecting sessions the
   * login flow had reported as good:
   *   - activated must be true. A login page can mint an unactivated token that
   *     no business endpoint will accept.
   *   - it must not be expired.
   */
  private validateOasisToken(value: string): boolean {
    const segments = value.includes('...') ? value.split('...') : [value]
    let sawPayload = false
    let activated: boolean | null = null
    let expiresAt: number | null = null

    for (const part of segments) {
      const bits = part.split('.')
      if (bits.length < 3) continue
      try {
        const payload = JSON.parse(Buffer.from(bits[1], 'base64url').toString('utf-8'))
        sawPayload = true
        if (typeof payload.activated === 'boolean') activated = payload.activated
        if (typeof payload.exp === 'number' && payload.exp > 0) {
          expiresAt = expiresAt === null ? payload.exp : Math.max(expiresAt, payload.exp)
        }
      } catch {
        // not a JSON payload; keep looking
      }
    }

    if (!sawPayload) return false

    if (activated === false) {
      console.log('[InAppLogin] Oasis-Token rejected: activated=false (login not finished)')
      return false
    }

    if (expiresAt !== null && expiresAt < Math.floor(Date.now() / 1000)) {
      console.log('[InAppLogin] Oasis-Token rejected: expired')
      return false
    }

    return true
  }

  private async checkForTokens(): Promise<void> {
    if (!this.loginWindow || this.isCompleted || !this.config) return

    if (this.loginWindow.isDestroyed()) {
      console.log('[InAppLogin] Window is destroyed, skipping token check')
      return
    }

    const webContents = this.loginWindow.webContents
    if (webContents.isDestroyed()) {
      console.log('[InAppLogin] webContents is destroyed, skipping token check')
      return
    }

    const localStorageSources = this.config.tokenSources.filter((s) => s.type === 'localStorage')
    const cookieSources = this.config.tokenSources.filter((s) => s.type === 'cookie')

    if (localStorageSources.length === 0 && cookieSources.length === 0) return

    console.log('[InAppLogin] Checking tokens, localStorage:', localStorageSources.map(s => s.key), 'cookies:', cookieSources.map(s => s.key))

    try {
      for (const source of localStorageSources) {
        if (webContents.isDestroyed() || this.isCompleted) {
          console.log('[InAppLogin] webContents destroyed or login completed, stopping token check')
          return
        }
        const script = `
          (function() {
            try {
              const value = localStorage.getItem('${source.key}');
              console.log('[InAppLogin] localStorage.getItem("${source.key}"):', value);
              return value || null;
            } catch (e) {
              console.error('[InAppLogin] Error reading localStorage:', e);
              return null;
            }
          })()
        `
        const value = await webContents.executeJavaScript(script)
        console.log('[InAppLogin] Got value from localStorage:', source.key, value ? value.substring(0, 50) + '...' : 'null')

        if (source.key === 'user_detail_agent' && value) {
          try {
            const parsed = JSON.parse(value)
            const realUserID = parsed.realUserID || parsed.id
            if (realUserID) {
              console.log('[InAppLogin] Found realUserID from user_detail_agent:', realUserID)
              this.emit('tokenFound', { key: 'realUserID', value: String(realUserID) })
            }
          } catch (e) {
            console.error('[InAppLogin] Error parsing user_detail_agent:', e)
          }
          continue
        }

        // StepFun device id. It is stored under "deviceId" and often arrives
        // double-quoted (the client writes it with JSON.stringify), so strip
        // the quotes before treating it as a credential. Emitted under the
        // alias the account store expects.
        if (source.key === 'deviceId' || source.alias === 'web_id') {
          if (!value) continue
          const cleaned = String(value).trim().replace(/^"|"$/g, '')
          if (cleaned) {
            console.log('[InAppLogin] Found device id from localStorage:', source.key, cleaned.slice(0, 20))
            this.emit('tokenFound', { key: source.alias || source.key, value: cleaned })
          }
          continue
        }

        let tokenValue = value
        if (value && value.startsWith('{') && value.endsWith('}')) {
          try {
            const parsed = JSON.parse(value)
            if (parsed.value) {
              tokenValue = parsed.value
              console.log('[InAppLogin] Extracted token from JSON:', tokenValue.substring(0, 50) + '...')
            }
          } catch (e) {
            console.error('[InAppLogin] Error parsing JSON token:', e)
          }
        }

        if (tokenValue && typeof tokenValue === 'string' && this.isValidToken(tokenValue)) {
          console.log('[InAppLogin] Token found and valid from localStorage:', source.key)
          const emitKey = source.key === '_token' ? 'token' : source.key
          this.emit('tokenFound', { key: emitKey, value: tokenValue })
        }
      }

      for (const source of cookieSources) {
        if (!this.loginSession) continue

        const allCookies = await this.loginSession.cookies.get({})
        console.log('[InAppLogin] All cookies count:', allCookies.length)
        console.log('[InAppLogin] All cookies:', allCookies.map(c => `${c.name}=[REDACTED]`))
        
        const targetDomains = this.config?.targetDomains || []
        let cookiesToSearch = allCookies
        
        for (const domain of targetDomains) {
          try {
            const domainCookies = await this.loginSession.cookies.get({ domain })
            console.log(`[InAppLogin] Domain cookies for ${domain}:`, domainCookies.map(c => c.name))
            for (const dc of domainCookies) {
              if (!cookiesToSearch.find(c => c.name === dc.name)) {
                cookiesToSearch.push(dc)
              }
            }
          } catch (e) {
            console.log(`[InAppLogin] Error getting cookies for domain ${domain}:`, e)
          }
        }
        
        console.log('[InAppLogin] Combined cookies to search:', cookiesToSearch.map(c => c.name))

        const cookie = cookiesToSearch.find(c => c.name === source.key)
        if (cookie) {
          console.log('[InAppLogin] Found cookie:', source.key, cookie.value ? cookie.value.substring(0, 50) + '...' : 'null')

          if (cookie.value && this.isValidToken(cookie.value)) {
            console.log('[InAppLogin] Token found and valid from cookie:', source.key, 'emitting tokenFound event')
            const allCookiesObj: Record<string, string> = {}
            for (const c of cookiesToSearch) {
              if (c.value) {
                allCookiesObj[c.name] = c.value
              }
            }
            this.emit('tokenFound', { key: this.getTokenKey(source), value: cookie.value, allCookies: allCookiesObj })
          } else {
            console.log('[InAppLogin] Cookie token is invalid:', source.key, cookie.value ? cookie.value.substring(0, 50) : 'null')
          }
        } else {
          console.log('[InAppLogin] Cookie not found:', source.key)
        }
      }
    } catch (error) {
      console.error('[InAppLogin] Error in checkForTokens:', error)
    }
  }

  completeWithSuccess(credentials: Record<string, string>): void {
    this.complete({
      success: true,
      credentials,
    })
  }

  private complete(result: InAppLoginResult): void {
    if (this.isCompleted) return
    this.isCompleted = true

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.close()
    }

    this.cleanup()

    if (this.resolvePromise) {
      this.resolvePromise(result)
      this.resolvePromise = null
    }

    this.emit('complete', result)
  }

  private cleanup(): void {
    if (this.loginSession) {
      try {
        this.loginSession.webRequest.onBeforeSendHeaders(() => {})
        this.loginSession.cookies.removeAllListeners()
      } catch (error) {
        console.error('[InAppLogin] Error cleaning up session:', error)
      }
      this.loginSession = null
    }

    this.loginWindow = null
    this.config = null
  }

  cancel(): void {
    if (!this.isCompleted) {
      this.complete({
        success: false,
        error: 'Login cancelled by user',
      })
    }
  }

  isWindowOpen(): boolean {
    return this.loginWindow !== null && !this.loginWindow.isDestroyed()
  }

  destroy(): void {
    this.cancel()
    this.removeAllListeners()
  }
}

export const inAppLoginManager = new InAppLoginManager()

export default InAppLoginManager
