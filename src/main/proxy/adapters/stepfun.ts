/**
 * StepFun Adapter
 * Supports two modes:
 *   1. API Key: direct API call to api.stepfun.com (step_plan endpoint for reasoning models)
 *   2. Web session (Oasis-Token + web_id): same-origin proxy like the web frontend
 */

import { net } from 'electron'
import axios from 'axios'
import { Readable, PassThrough } from 'stream'
import { Account, Provider } from '../../store/types'
import { PROTOCOL_PREFIX } from '../toolCalling/protocols/managedXml.ts'
import { stepfunSessionManager } from '../../oauth/stepfunSessionManager'

// step_plan endpoint: supports reasoning models (step-3.7, step-2, step-1o series)
const STEP_PLAN_ENDPOINT = 'https://api.stepfun.com/step_plan/v1/chat/completions'
// Standard v1 endpoint: for non-reasoning models
const API_ENDPOINT = 'https://api.stepfun.com/v1/chat/completions'
const WEB_PROXY_ENDPOINT = 'https://chat.stepfun.com/api/agent/capy.agent.v1.AgentService/ChatStream'

const API_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/event-stream',
  'Content-Type': 'application/json',
}

// Header shape mirrored byte-for-byte from a live CDP capture of
// chat.stepfun.com/api/agent/capy.agent.v1.AgentService/ChatStream.
// Notable omissions that matter:
//   - no `oasis-token` / `oasis-webid` headers (auth is Cookie-only)
//   - no `Origin` header (same-origin request; the browser strips it)
//   - `Referer` is the concrete chat page URL, injected per-request
const WEB_HEADERS: Record<string, string> = {
  'accept': '*/*',
  'accept-encoding': 'identity',
  'content-type': 'application/connect+json',
  'oasis-platform': 'web',
  'oasis-appid': '10200',
  'canary': 'false',
  'connect-protocol-version': '1',
  'oasis-language': 'zh',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua': '"Microsoft Edge";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
  'sec-ch-ua-mobile': '?0',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0',
}

// --- Token parsing helpers ---
// StepFun session tokens come in two formats:
// 1. Standard JWT: header.payload.signature (split by dots)
// 2. Concatenated base64url JSONs: json1 + json2 + ... (no dots)
// The payloads contain app_id and device_id which are needed for headers.

function base64urlDecode(str: string): string | null {
  try {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
    return Buffer.from(padded, 'base64url').toString('utf-8')
  } catch {
    return null
  }
}

function tryDecodeJwtPayload(encoded: string): { appId?: string; deviceId?: string } | null {
  const decoded = base64urlDecode(encoded)
  if (!decoded || !decoded.startsWith('{')) return null
  try {
    const payload = JSON.parse(decoded)
    return {
      appId: payload?.app_id || payload?.appId,
      deviceId: payload?.device_id || payload?.deviceId || payload?.did,
    }
  } catch {
    return null
  }
}

function extractTokenPayloads(
  token: string
): { appId?: string; deviceId?: string }[] {
  const results: { appId?: string; deviceId?: string }[] = []

  // Strategy 0: multi-JWT concatenated by "..." (observed in StepFun session tokens)
  const segments = token.split('...')
  const jwtCandidates = segments.length >= 2 ? segments : [token]

  for (const jwt of jwtCandidates) {
    const parts = jwt.split('.')
    if (parts.length >= 3) {
      const parsed = tryDecodeJwtPayload(parts[1])
      if (parsed) results.push(parsed)
    }
  }

  return results
}

// --- End token parsing helpers ---

interface StepFunMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: any[]
}

interface ChatCompletionRequest {
  model: string
  messages: StepFunMessage[]
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  n?: number
  tools?: any[]
  tool_choice?: any
  frequency_penalty?: number
  stop?: string[]
  reasoning_effort?: string
}

interface StoredCookies {
  [name: string]: string
}

/**
 * A conversation as returned by capy.agent.v1.AgentService.
 *
 * Mirrors the ChatSession message: chat_session_id(1) chat_id(2)
 * display_name(3) latest_message_id(4) meta(5) state(6) type(7)
 * chat_client_type(8) class(9) has_unread_image_result(10)
 * create_time(101) update_time(102).
 *
 * Enums:
 *   State         STATE_UNSPECIFIED, STATE_FAVOR
 *   Type          TYPE_UNSPECIFIED, TYPE_INCOGNITO
 *   ChatClientType CHAT_CLIENT_TYPE_UNSPECIFIED, WEB, APP, DESKTOP
 *   Class         CLASS_UNSPECIFIED, CLASS_STUDIO, CLASS_ARTIFACT, CLASS_KNOWLEDGE_BASE
 */
export interface StepFunChatSession {
  chatSessionId: string
  chatId: string
  displayName: string
  latestMessageId: string
  state: string
  type: string
  chatClientType: string
  class: string
  createTime: string
  updateTime: string
}

// --- Module-level caches ---
interface TokenInfo { tokenHash: string; isValid: boolean; checkedAt: number }
interface SessionInfo {
  chatSessionId: string
  chatId: string
  createdAt: number
  // Identity that owns this session, so it is not reused across accounts.
  oasisId?: string
}
const tokenValidationCache = new Map<string, TokenInfo>()
const sessionCache = new Map<string, SessionInfo>()
const SESSION_TTL_MS = 30 * 60 * 1000
const TOKEN_VALIDATION_TTL_MS = 5 * 60 * 1000

export class StepFunAdapter {
  private provider: Provider
  private account: Account
  private oasisToken: string
  private webId: string
  private allCookies: StoredCookies
  // Cookie header produced by the session manager. Carries the path-scoped
  // INGRESSCOOKIE duplicates that a name→value map cannot represent.
  private sessionCookieHeader: string = ''
  // Cache key for the active conversation, so messageEvent updates land under
  // the same key the caller used to look the session up.
  private currentSessionKey: string = ''
  private isApiKeyMode: boolean
  private chatSessionId: string | null = null
  private chatId: string | null = null
  private cachedAppId: string | null = null

  constructor(provider: Provider, account: Account) {
    console.log('[StepFun][ADAPTER] constructor ENTRY, providerId=', provider.id, 'accountId=', account.id)
    this.provider = provider
    this.account = account
    const rawToken = account.credentials.token || account.credentials.apiKey || account.credentials.OasisToken || ''
    this.oasisToken = rawToken
    this.webId = account.credentials.web_id || account.credentials.webId || ''
    this.allCookies = (account.credentials.cookies || {}) as StoredCookies
    // Detect mode: prefer WEB mode when web session credentials are present,
    // regardless of token format. This handles StepFun tokens that lack JWT
    // structure (no dots) but are valid web session tokens.
    const hasWebSession = !!(this.oasisToken && this.webId)
    const hasJwtStructure = rawToken.includes('...') || (rawToken.includes('.') && rawToken.split('.').length >= 3)
    this.isApiKeyMode = !hasWebSession && !hasJwtStructure && rawToken.length > 0 && !rawToken.startsWith('ey')
    console.log('[StepFun][ADAPTER] constructor EXIT, isApiKeyMode=', this.isApiKeyMode, 'hasWebSession=', hasWebSession, 'tokenPrefix=', rawToken ? rawToken.slice(0, 25) : '', 'webId=', this.webId ? this.webId.slice(0, 20) : '')
    if (this.oasisToken && !this.allCookies['Oasis-Token']) {
      this.allCookies['Oasis-Token'] = this.oasisToken
    }

    // sessionCache is module-level, so it survives across adapter instances.
    // A fresh adapter with different credentials would otherwise pick up a
    // session id that belongs to a previously configured account.
    const incomingOasisId = this.readOasisId()
    if (incomingOasisId) {
      for (const [key, info] of Array.from(sessionCache.entries())) {
        if (info.oasisId && info.oasisId !== incomingOasisId) {
          sessionCache.delete(key)
        }
      }
    }

    console.log('[StepFun][DIAG] adapter init, initial tokenPrefix=', this.oasisToken.slice(0, 30), 'webId=', this.webId.slice(0, 20), 'isApiKeyMode=', this.isApiKeyMode)

    // Subscribe to StepFunSessionManager for live token updates.
    // This ensures the adapter always uses the freshest Oasis-Token
    // even after the browser session refreshes it periodically.
    stepfunSessionManager.on('token-updated', (token: string, webId: string, cookies: Record<string, string>) => {
      this.updateToken(token, webId, cookies)
    })
    // If the session manager already has credentials, adopt them ONLY if
    // they are non-empty. This prevents stale/empty session manager credentials
    // from overriding credentials the user manually configured in settings.
    if (stepfunSessionManager.ready() && stepfunSessionManager.hasCredentials()) {
      const smToken = stepfunSessionManager.getToken()
      const smWebId = stepfunSessionManager.getWebId()
      if (smToken && smToken.length > 10) {
        const cookieHeader = stepfunSessionManager.getCookieHeader()
        console.log('[StepFun][DIAG] session manager offers credentials, tokenLen=', smToken.length,
          'cookieHeaderLen=', cookieHeader.length)
        this.updateToken(smToken, smWebId, { Cookie: cookieHeader })
      } else {
        console.log('[StepFun][DIAG] session manager has empty/stale credentials, keeping user-configured token')
      }
    }
    console.log('[StepFun][DIAG] adapter init FINAL tokenDeviceId=',
      this.readDeviceIdFromToken(this.oasisToken).slice(0, 20) || 'none',
      'webId=', this.webId.slice(0, 20),
      'cookieSource=', this.sessionCookieHeader ? 'session-manager' : 'account-fallback')
  }

  private updateToken(token: string, webId: string, cookies: Record<string, string>): void {
    // The session-manager partition holds its own login, which is frequently a
    // DIFFERENT StepFun account/device from the one the user configured. The
    // token payload carries the device it was minted for; presenting that token
    // with another device's Oasis-Webid makes the server answer
    // CODE_ACCOUNT_NEED_SIGN_IN.
    //
    // So only adopt the pushed credentials when they are self-consistent, and
    // never let them clobber the account's own identity.
    const tokenDeviceId = this.readDeviceIdFromToken(token)
    const accountWebId = this.account.credentials.web_id || this.account.credentials.webId || ''

    if (tokenDeviceId && webId && tokenDeviceId !== webId) {
      console.warn('[StepFun][ADAPTER] session manager credentials inconsistent:',
        'token.device_id=', tokenDeviceId.slice(0, 20),
        'Oasis-Webid=', webId.slice(0, 20),
        '-> ignoring push')
      return
    }

    if (accountWebId && webId && accountWebId !== webId && tokenDeviceId && tokenDeviceId !== accountWebId) {
      console.warn('[StepFun][ADAPTER] session manager belongs to a different account:',
        'account web_id=', accountWebId.slice(0, 20),
        'pushed web_id=', webId.slice(0, 20),
        '-> ignoring push')
      return
    }

    this.oasisToken = token
    if (webId) {
      this.webId = webId
    }
    // The session manager hands over a fully-formed Cookie header (it is the
    // only place that can see the path-scoped INGRESSCOOKIE duplicates). Store
    // it verbatim; buildHeaders prefers it over reconstructing from allCookies.
    if (cookies['Cookie']) {
      this.sessionCookieHeader = cookies['Cookie']
    }
    const { Cookie: _ignore, ...rest } = cookies
    this.allCookies = { ...this.allCookies, ...rest } as StoredCookies
    this.cachedAppId = null
    this.clearSessionCache()
    console.log('[StepFun][ADAPTER] token updated from session manager, tokenLen=', token.length,
      'webIdLen=', webId.length, 'hasCookieHeader=', !!this.sessionCookieHeader,
      'cookieNames=', (this.sessionCookieHeader || '').split('; ').map(p => p.split('=')[0]).join(','))
  }

  /**
   * Read device_id out of an Oasis-Token.
   *
   * The token is two base64url JWTs joined by "..."; the second one's payload
   * carries app_id / device_id / platform.
   */
  private readDeviceIdFromToken(token: string): string {
    const payloads = extractTokenPayloads(token)
    for (const p of payloads) {
      if (p.deviceId) return p.deviceId
    }
    return ''
  }

  /**
   * Read oasis_id out of the active token. Sessions are scoped to this id, so
   * it is used to invalidate cached session ids after a credential change.
   */
  private readOasisId(): string {
    for (const part of this.oasisToken.split('...')) {
      const bits = part.split('.')
      if (bits.length < 3) continue
      try {
        const payload = JSON.parse(Buffer.from(bits[1], 'base64url').toString('utf-8'))
        if (payload?.oasis_id) return String(payload.oasis_id)
      } catch {
        // not a JSON payload
      }
    }
    return ''
  }

  private async acquireToken(): Promise<string> {
    if (!this.oasisToken) throw new Error('StepFun token not configured')
    if (this.isApiKeyMode) return this.oasisToken

    const tokenHash = this.oasisToken.slice(0, 40)
    const cached = tokenValidationCache.get(tokenHash)
    if (cached && cached.isValid && Date.now() - cached.checkedAt < TOKEN_VALIDATION_TTL_MS) {
      return this.oasisToken
    }

    let hasValidPayload = false
    let expiresAt: number | null = null
    let activated: boolean | null = null
    if (this.oasisToken) {
      const segments = this.oasisToken.includes('...') ? this.oasisToken.split('...') : this.oasisToken.split('.')
      for (const seg of segments) {
        if (!seg || seg.length < 4) continue
        try {
          const payloadStr = Buffer.from(seg, 'base64url').toString('utf-8')
          if (payloadStr.startsWith('{')) {
            hasValidPayload = true
            // Track the latest JWT expiry so we can pre-reject expired tokens locally,
            // instead of relying on the server error frame (which was silently dropped).
            try {
              const p = JSON.parse(payloadStr)
              if (typeof p.exp === 'number' && p.exp > 0) {
                expiresAt = expiresAt === null ? p.exp : Math.max(expiresAt, p.exp)
              }
              if (typeof p.activated === 'boolean') {
                activated = p.activated
              }
            } catch { /* non-JSON payload, ignore */ }
          }
        } catch { /* skip */ }
      }
    }

    // An unactivated session can still be minted by the login page but cannot
    // call any business endpoint — the server answers 403
    // CODE_ACCOUNT_NEED_SIGN_IN. Fail early with an actionable message rather
    // than letting every request die at the gateway.
    if (activated === false) {
      console.error('[StepFun][ACQUIRE-TOKEN] token has activated=false; session is not usable')
      const err: any = new Error(
        'StepFun session is not activated. Log in at chat.stepfun.com in a normal browser tab, ' +
        'confirm the page loads your conversation list, then copy a fresh Oasis-Token.'
      )
      err.code = 'account_not_activated'
      throw err
    }

    // Pre-check expiry: if the JWT contains an explicit exp that has already passed,
    // reject immediately with a clear, actionable message rather than hitting the server.
    if (hasValidPayload && expiresAt !== null) {
      const nowSec = Math.floor(Date.now() / 1000)
      if (expiresAt < nowSec) {
        console.error('[StepFun][ACQUIRE-TOKEN] token EXPIRED at', expiresAt, 'now=', nowSec)
        const err: any = new Error('StepFun token expired, please re-login at chat.stepfun.com to get a fresh Oasis-Token')
        err.code = 'token_expired'
        throw err
      }
    }

    // In WEB mode, accept non-JWT session tokens and let the server validate them.
    // Only reject empty tokens.
    const isValid = hasValidPayload || this.oasisToken.length > 0
    tokenValidationCache.set(tokenHash, { tokenHash, isValid, checkedAt: Date.now() })
    if (!isValid) throw new Error('StepFun token format invalid')
    return this.oasisToken
  }

  private getCachedSession(key: string): SessionInfo | null {
    const cached = sessionCache.get(key)
    if (!cached) return null
    if (Date.now() - cached.createdAt > SESSION_TTL_MS) {
      sessionCache.delete(key)
      return null
    }
    // A session id belongs to the account that created it. Reusing one after
    // the credentials change makes the server answer "chat session not found",
    // so treat a different identity as a cache miss.
    if (cached.oasisId && cached.oasisId !== this.readOasisId()) {
      console.log('[StepFun][SESSION] cached session belongs to another account, discarding')
      sessionCache.delete(key)
      return null
    }
    return cached
  }

  private setCachedSession(key: string, sessionInfo: SessionInfo): void {
    sessionCache.set(key, { ...sessionInfo, oasisId: this.readOasisId(), createdAt: Date.now() })
  }

  private clearSessionCache(): void {
    sessionCache.clear()
    this.chatSessionId = null
    this.chatId = null
  }

  /**
   * Create a conversation and return its id.
   *
   * Public entry for the management API; createChatSession stays private
   * because it is also called internally when a stream needs a fresh session.
   */
  async createSession(options: { type?: string; scene?: string; studioId?: string } = {}): Promise<string> {
    await this.acquireToken()
    const headers = this.buildHeaders()
    const id = await this.createChatSession(headers, options)
    if (!id) throw new Error('CreateChatSession did not return a session id')
    return id
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.deleteChatSessions([sessionId])
  }

  /**
   * Delete every stored conversation for this account.
   *
   * Pages through ListChatSessions and deletes in batches; the API takes an
   * array so a single call covers a whole page.
   */
  async deleteAllChats(): Promise<boolean> {
    const collected: string[] = []
    let pageToken = ''

    for (let page = 0; page < 50; page++) {
      const opts: { pageSize: number; pageToken?: string } = { pageSize: 100 }
      if (pageToken) opts.pageToken = pageToken
      const { sessions, nextPageToken } = await this.listChatSessions(opts)
      for (const s of sessions) {
        if (s.chatSessionId) collected.push(s.chatSessionId)
      }
      if (!nextPageToken) break
      pageToken = nextPageToken
    }

    if (collected.length === 0) {
      this.clearSessionCache()
      return true
    }

    let ok = true
    for (let i = 0; i < collected.length; i += 100) {
      const batch = collected.slice(i, i + 100)
      if (!(await this.deleteChatSessions(batch))) ok = false
    }

    this.clearSessionCache()
    console.log('[StepFun][API] deleteAllChats, deleted=', collected.length, 'ok=', ok)
    return ok
  }

  private buildHeaders(): Record<string, string> {
    console.log('[StepFun][ADAPTER] buildHeaders ENTRY, isApiKeyMode=', this.isApiKeyMode)
    if (this.isApiKeyMode) {
      console.log('[StepFun][ADAPTER] buildHeaders EXIT, mode=API_KEY')
      return {
        ...API_HEADERS,
        Authorization: 'Bearer ' + this.oasisToken,
      }
    }

    const headers: Record<string, string> = { ...WEB_HEADERS }

    // Extract app_id from token using flexible parsing (supports JWT and concatenated base64url JSONs)
    let jwtAppId: string | null = this.cachedAppId
    if (!jwtAppId && this.oasisToken) {
      const payloads = extractTokenPayloads(this.oasisToken)
      // Use the LAST payload that has app_id
      for (const p of payloads) {
        if (p.appId) jwtAppId = p.appId
      }
      this.cachedAppId = jwtAppId
    }

    const appId = jwtAppId || this.provider.headers?.['Oasis-appID'] || '10200'

    // The Connect server validates the token signature against the oasis-webid header,
    // which MUST match the device_id embedded in the JWT payload.
    // User-pasted web_id from browser cookies often differs from token's device_id,
    // causing "permission_denied: need sign in". Extract device_id from token as primary.
    let tokenDeviceId: string | null = null
    if (this.oasisToken) {
      const payloads = extractTokenPayloads(this.oasisToken)
      for (const p of payloads) {
        if (p.deviceId) {
          tokenDeviceId = p.deviceId
          break
        }
      }
    }

    headers['oasis-appid'] = appId

    // CRITICAL: the browser sends NO oasis-token / oasis-webid request headers
    // on ChatStream. Auth travels exclusively in the Cookie header (Oasis-Token
    // + Oasis-Webid). Adding oasis-token as a header pushes the gateway onto a
    // different validation path that rejects valid sessions with
    // CODE_ACCOUNT_NEED_SIGN_IN. Confirmed by CDP capture of the live web client.
    // NOTE: no oasis-extra-did. The browser does not send it on ChatStream —
    // only the growth/user endpoints carry it. Sending it here made the gateway
    // take a stricter validation branch and reject the session.
    const extraDid = tokenDeviceId || this.webId || null
    console.log('[StepFun][ADAPTER] buildHeaders EXIT, mode=WEB, appId=', appId,
      'webId=', this.webId ? '[REDACTED]' : 'null',
      'oasisToken=', this.oasisToken ? '[REDACTED]' : 'null',
      'allCookieKeys=[' + Object.keys(this.allCookies).join(',') + ']',
      'jwtAppId=', jwtAppId || 'null')

    // Prefer the session manager's Cookie header: it is built from the live
    // cookie jar with RFC 6265 path matching, so it contains every
    // path-scoped INGRESSCOOKIE the gateway expects for this route.
    if (this.sessionCookieHeader) {
      headers['Cookie'] = this.sessionCookieHeader
      console.log('[StepFun][ADAPTER] buildHeaders EXIT, mode=WEB, appId=', appId,
        'cookieSource=session-manager',
        'cookieLen=', headers['Cookie'].length,
        'cookies=', headers['Cookie'].split('; ').map(p => p.split('=')[0]).join(','))
      return headers
    }

    // Fallback for accounts configured with a manually pasted token: rebuild
    // the header from available pieces. Only one INGRESSCOOKIE can survive here.
    const emitted = new Set<string>()
    const cookiePairs: Array<[string, string]> = []

    const addCookie = (name: string, value: string) => {
      if (!value) return
      const key = name.toLowerCase()
      if (emitted.has(key)) return
      emitted.add(key)
      cookiePairs.push([name, value])
    }

    addCookie('is_pc_desktop', 'false')
    addCookie('i18next', 'zh')
    addCookie('Oasis-Webid', this.webId)
    addCookie('sidebar_state', 'false')
    addCookie('Oasis-Token', this.oasisToken)

    for (const [name, value] of Object.entries(this.allCookies)) {
      addCookie(name, value)
    }

    headers['Cookie'] = cookiePairs.map(([n, v]) => n + '=' + v).join('; ')
    console.log('[StepFun][ADAPTER] buildHeaders EXIT, mode=WEB, appId=', appId,
      'cookieSource=fallback',
      'cookieLen=', headers['Cookie'].length,
      'cookies=', cookiePairs.map(([n]) => n).join(','))
    return headers
  }

  private getEndpoint(): string {
    if (this.isApiKeyMode) {
      console.log('[StepFun][ADAPTER] getEndpoint EXIT, mode=API_KEY, endpoint=step_plan')
      return STEP_PLAN_ENDPOINT
    }

    // Web session mode: always use the platform proxy endpoint
    // The platform API (platform.stepfun.com) handles session-based auth
    // and proxies requests to the backend API
    console.log('[StepFun][ADAPTER] getEndpoint EXIT, mode=WEB')
    return WEB_PROXY_ENDPOINT
  }

  private formatNetworkError(error: Error): string {
    const errorMsg = error.message || String(error)

    if (errorMsg.includes('ERR_CONNECTION_RESET') || errorMsg.includes('net::ERR_CONNECTION_RESET')) {
      return 'Network connection reset. Please check your network connection and try again.'
    }
    if (errorMsg.includes('ERR_CONNECTION_REFUSED') || errorMsg.includes('net::ERR_CONNECTION_REFUSED')) {
      return 'Connection refused. The server may be temporarily unavailable.'
    }
    if (errorMsg.includes('ERR_CONNECTION_TIMED_OUT') || errorMsg.includes('net::ERR_CONNECTION_TIMED_OUT')) {
      return 'Connection timed out. Please check your network and try again.'
    }
    if (errorMsg.includes('ERR_SSL') || errorMsg.includes('SSL')) {
      return 'SSL/TLS handshake failed. Please check your network security settings.'
    }
    if (errorMsg.includes('ERR_NAME_NOT_RESOLVED') || errorMsg.includes('net::ERR_NAME_NOT_RESOLVED')) {
      return 'DNS resolution failed. Please check your network connection.'
    }
    if (errorMsg.includes('ERR_NETWORK_CHANGED') || errorMsg.includes('net::ERR_NETWORK_CHANGED')) {
      return 'Network changed during request. Please try again.'
    }
    if (errorMsg.includes('ERR_INTERNET_DISCONNECTED') || errorMsg.includes('net::ERR_INTERNET_DISCONNECTED')) {
      return 'No internet connection. Please check your network settings.'
    }

    return `Network error: ${errorMsg}. Please check your connection and try again.`
  }

  private buildStepPlanRequest(request: ChatCompletionRequest): any {
    const model = this.mapModel(request.model)

    const body: any = {
      model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content == null ? '' : msg.content,
        ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      })),
      stream: request.stream !== undefined ? request.stream : true,
    }

    if (request.temperature !== undefined && request.temperature !== null) body.temperature = request.temperature
    if (request.top_p !== undefined && request.top_p !== null) body.top_p = request.top_p
    if (request.max_tokens !== undefined && request.max_tokens !== null) body.max_tokens = request.max_tokens
    if (request.stop) body.stop = request.stop
    if (request.reasoning_effort === 'high' || request.reasoning_effort === 'max') {
      body.enable_reasoning = true
    }

    return body
  }

  private mapModel(model: string): string {
    // Direct mapping for known model names (web client model names)
    const directMappings: Record<string, string> = {
      'step-1-8k': 'step-1-8k',
      'step-1-32k': 'step-1-32k',
      'step-1-128k': 'step-1-128k',
      'step-1-256k': 'step-1-256k',
      'step-1o-mini': 'step-1o-mini',
      'step-1o-turbo': 'step-1o-turbo',
      'step-1o-128k': 'step-1o-128k',
      'step-2-mini': 'step-2-mini',
      'step-2-turbo': 'step-2-turbo',
      'step-2-16k': 'step-2-16k',
      'step-3-mini-128k': 'step-3-mini-128k',
      'step-3-turbo-128k': 'step-3-turbo-128k',
      'step-3-flash-128k': 'step-3-flash-128k',
      'step-3.7-mini': 'step-3.7-mini',
      'step-3.7-turbo': 'step-3.7-turbo',
      'step-3.7-max': 'step-3.7-max',
      'step-3.7-flash': 'step-3.7-flash',
      'step-fun-vision': 'step-fun-vision',
      'step-auto': 'step-auto',
      // Legacy aliases
      'Step-1': 'step-1-128k',
      'Step-2': 'step-2-16k',
      'Step-1-128k': 'step-1-128k',
      'Step-1-32k': 'step-1-32k',
      'Step-1-8k': 'step-1-8k',
      'Step-2-16k': 'step-2-16k',
    }

    if (directMappings[model]) {
      return directMappings[model]
    }

    const modelLower = model.toLowerCase()

    // Pattern-based fallback matching
    if (modelLower.includes('step-3.7-mini')) return 'step-3.7-mini'
    if (modelLower.includes('step-3.7-turbo')) return 'step-3.7-turbo'
    if (modelLower.includes('step-3.7-max')) return 'step-3.7-max'
    if (modelLower.includes('step-3.7-flash')) return 'step-3.7-flash'
    if (modelLower.includes('step-3.7')) return 'step-3.7-turbo'
    if (modelLower.includes('step-3-flash')) return 'step-3-flash-128k'
    if (modelLower.includes('step-3-turbo')) return 'step-3-turbo-128k'
    if (modelLower.includes('step-3-mini')) return 'step-3-mini-128k'
    if (modelLower.includes('step-3')) return 'step-3-turbo-128k'
    if (modelLower.includes('step-2-turbo')) return 'step-2-turbo'
    if (modelLower.includes('step-2-mini')) return 'step-2-mini'
    if (modelLower.includes('step-2-16k')) return 'step-2-16k'
    if (modelLower.includes('step-2')) return 'step-2-16k'
    if (modelLower.includes('step-1o-turbo')) return 'step-1o-turbo'
    if (modelLower.includes('step-1o-mini')) return 'step-1o-mini'
    if (modelLower.includes('step-1o-128k')) return 'step-1o-128k'
    if (modelLower.includes('step-1o')) return 'step-1o-mini'
    if (modelLower.includes('step-1-256k')) return 'step-1-256k'
    if (modelLower.includes('step-1-128k')) return 'step-1-128k'
    if (modelLower.includes('step-1-32k')) return 'step-1-32k'
    if (modelLower.includes('step-1-8k')) return 'step-1-8k'
    if (modelLower.includes('step-1')) return 'step-1-128k'
    if (modelLower.includes('step-fun-vision')) return 'step-fun-vision'
    if (modelLower.includes('step-auto')) return 'step-auto'

    // Return original if no mapping found (server will validate)
    return model
  }

  async chatCompletion(request: ChatCompletionRequest, sessionId?: string): Promise<{ success: boolean; status?: number; stream?: Readable; body?: any; headers?: Record<string, string>; error?: string }> {
    if (!this.isApiKeyMode) {
      // Web session mode: use Connect protocol (HTTP streaming)
      await this.acquireToken()
      return this.chatCompletionConnect(request, sessionId)
    }

    // API Key mode: use standard step_plan API (user's configured endpoint)
    return this.chatCompletionStepPlan(request)
  }

  private async chatCompletionStepPlan(request: ChatCompletionRequest, retryCount = 0): Promise<{ success: boolean; status?: number; stream?: Readable; body?: any; headers?: Record<string, string>; error?: string }> {
    console.log('[StepFun][STEP-PLAN] chatCompletionStepPlan ENTRY, model=', request.model, 'retry=', retryCount)

    const requestData = this.buildStepPlanRequest(request)
    const headers = this.buildHeaders()
    const endpoint = this.getEndpoint()

    console.log('[StepFun][STEP-PLAN] endpoint=', endpoint, 'model=', requestData.model)

    const request_ = net.request({
      method: 'POST',
      url: endpoint,
    })

    // SSL verification is bypassed globally via app.commandLine.appendSwitch('ignore-certificate-errors')

    for (const [key, value] of Object.entries(headers)) {
      request_.setHeader(key, value)
    }

    const stream = new PassThrough()
    console.log('[StepFun][STEP-PLAN] about to send request, bodyLen=', JSON.stringify(requestData).length)

    return new Promise((resolve) => {
      let responseReceived = false
      let serverError: string | null = null
      let buffer = Buffer.alloc(0)

      request_.on('response', (response) => {
        responseReceived = true
        const statusCode = response.statusCode
        const responseHeaders: Record<string, string> = {}
        Object.entries(response.headers || {}).forEach(([k, v]) => {
          responseHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v)
        })

        console.log('[StepFun][STEP-PLAN] response status=', statusCode, 'headers=', JSON.stringify(responseHeaders).slice(0, 300))

        if (statusCode && statusCode >= 400) {
          response.on('data', (chunk: Buffer) => {
            serverError = (serverError || '') + chunk.toString()
          })
          response.on('end', () => {
            console.error('[StepFun][STEP-PLAN] error status=', statusCode, 'body=', serverError?.slice(0, 500))
            resolve({
              success: false,
              status: statusCode,
              error: serverError || ('HTTP ' + statusCode),
            })
          })
          return
        }

        response.on('data', (chunk: Buffer) => {
          buffer = Buffer.concat([buffer, chunk])
          // Parse SSE frames from step_plan API
          const text = buffer.toString('utf-8')
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                stream.end()
                return
              }
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta || {}
                // step_plan stream puts output in reasoning/content; content is often empty
                const content = delta.reasoning || delta.reasoning_content || delta.content || parsed.choices?.[0]?.text || ''
                if (content) {
                  // Format as SSE for the stream handler
                  const sseLine = 'data: ' + JSON.stringify({ content }) + '\n\n'
                  stream.write(sseLine, 'utf-8')
                }
                if (parsed.choices?.[0]?.finish_reason === 'stop') {
                  stream.end()
                }
              } catch {
                // skip unparseable SSE data
              }
            }
          }
          // Keep unparsed bytes in buffer
          buffer = Buffer.from(lines[lines.length - 1] || '', 'utf-8')
        })

        response.on('end', () => {
          stream.end()
        })

        response.on('error', (error) => {
          console.error('[StepFun][STEP-PLAN] Response error:', error)
          stream.destroy()
        })

        resolve({
          success: true,
          status: statusCode || 200,
          stream,
          headers: responseHeaders,
          error: serverError ?? undefined,
        })
      })

      request_.on('error', (error) => {
        console.error('[StepFun][STEP-PLAN] Request error:', error)
        stream.destroy()
        const msg = error.message || String(error)
        // Auto-retry SSL handshake failures (transient network errors)
        if ((msg.includes('ERR_SSL') || msg.includes('SSL') || msg.includes('net_error')) && retryCount < 2) {
          console.log('[StepFun][STEP-PLAN] SSL error, retrying...')
          setTimeout(() => {
            return this.chatCompletionStepPlan(request, retryCount + 1).then(resolve)
          }, 1000 * (retryCount + 1))
          return
        }
        resolve({
          success: false,
          error: this.formatNetworkError(error),
        })
      })

      const requestTimeout = setTimeout(() => {
        console.error('[StepFun][STEP-PLAN] Request timed out after 120s')
        ;(request_ as any).destroy()
        resolve({
          success: false,
          error: 'Request timed out. Please check your network and try again.',
        })
      }, 120000)

      request_.on('response', () => clearTimeout(requestTimeout))
      request_.on('error', () => clearTimeout(requestTimeout))

      try {
        request_.write(JSON.stringify(requestData), 'utf-8')
        request_.end()
        console.log('[StepFun][STEP-PLAN] request sent')
      } catch (writeError) {
        clearTimeout(requestTimeout)
        console.error('[StepFun][STEP-PLAN] write/end failed:', writeError)
        resolve({
          success: false,
          error: 'Failed to write request: ' + (writeError instanceof Error ? writeError.message : String(writeError)),
        })
      }
    })
  }

  private async chatCompletionStandardApi(request: ChatCompletionRequest): Promise<{ success: boolean; status?: number; stream?: Readable; body?: any; headers?: Record<string, string>; error?: string }> {
    console.log('[StepFun][STD-API] chatCompletionStandardApi ENTRY, model=', request.model)

    const requestData = {
      model: request.model,
      messages: request.messages,
      stream: request.stream ?? true,
      temperature: request.temperature ?? 0.7,
      top_p: request.top_p ?? 1,
      max_tokens: request.max_tokens ?? 4096,
      tools: request.tools,
      tool_choice: request.tool_choice,
    }
    const headers = this.buildHeaders()
    const endpoint = 'https://api.stepfun.com/v1/chat/completions'

    console.log('[StepFun][STD-API] endpoint=', endpoint, 'model=', requestData.model)

    const request_ = net.request({
      method: 'POST',
      url: endpoint,
    })

    for (const [key, value] of Object.entries(headers)) {
      request_.setHeader(key, value)
    }

    const stream = new PassThrough()

    return new Promise((resolve) => {
      let responseReceived = false
      let serverError: string | null = null

      request_.on('response', (response) => {
        responseReceived = true
        const statusCode = response.statusCode
        const responseHeaders: Record<string, string> = {}
        Object.entries(response.headers || {}).forEach(([k, v]) => {
          responseHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v)
        })

        console.log('[StepFun][STD-API] response status=', statusCode)

        if (statusCode && statusCode >= 400) {
          response.on('data', (chunk: Buffer) => {
            serverError = (serverError || '') + chunk.toString()
          })
          response.on('end', () => {
            console.log('[StepFun][STD-API] error response body=', serverError?.slice(0, 500))
            resolve({ success: false, status: statusCode, error: serverError || `HTTP ${statusCode}` })
          })
          return
        }

        response.on('data', (chunk: Buffer) => {
          stream.write(chunk)
        })
        response.on('end', () => {
          stream.end()
        })
        response.on('error', (error) => {
          console.error('[StepFun][STD-API] Response error:', error)
          stream.destroy()
        })

        resolve({
          success: true,
          status: statusCode || 200,
          stream,
          headers: responseHeaders,
        })
      })

      request_.on('error', (error) => {
        console.error('[StepFun][STD-API] Request error:', error)
        stream.destroy()
        resolve({
          success: false,
          error: this.formatNetworkError(error),
        })
      })

      const requestTimeout = setTimeout(() => {
        console.error('[StepFun][STD-API] Request timed out after 120s')
        ;(request_ as any).destroy()
        resolve({
          success: false,
          error: 'Request timed out. Please check your network and try again.',
        })
      }, 120000)

      request_.on('response', () => clearTimeout(requestTimeout))
      request_.on('error', () => clearTimeout(requestTimeout))

      try {
        request_.write(JSON.stringify(requestData), 'utf-8')
        request_.end()
        console.log('[StepFun][STD-API] request sent')
      } catch (writeError) {
        clearTimeout(requestTimeout)
        console.error('[StepFun][STD-API] write/end failed:', writeError)
        resolve({
          success: false,
          error: 'Failed to write request: ' + (writeError instanceof Error ? writeError.message : String(writeError)),
        })
      }
    })
  }

  private async chatCompletionConnect(
    request: ChatCompletionRequest,
    sessionId?: string,
  ): Promise<{ success: boolean; status?: number; stream?: Readable; body?: any; headers?: Record<string, string>; error?: string }> {
    // console.log('[StepFun][CONNECT] chatCompletionConnect ENTRY, model=', request.model)

    await this.acquireToken()

    const headers = this.buildHeaders()
    const appId = headers['oasis-appid'] || '10200'
    const model = this.mapModel(request.model)

    // Use sessionId for cache lookup if provided (from proxy session manager)
    // Fall back to account-level key for backward compatibility
    const sessionKey = sessionId || this.account.id
    this.currentSessionKey = sessionKey
    const cachedSession = !this.isApiKeyMode ? this.getCachedSession(sessionKey) : null
    let useChatSessionId: string | null = cachedSession?.chatSessionId || this.chatSessionId

    // Tracks whether we already owned a session before this call, which decides
    // whether Referer points at /chats/new or /chats/<id>.
    const hadSessionBeforeRequest = !!useChatSessionId

    // The server rejects ChatStream unless message.chatSessionId names a session
    // it created for this account — an invented id returns
    // permission_denied / need sign in. The web client always calls
    // CreateChatSession first and echoes the returned id, so do the same
    // whenever we do not already hold a server-issued session.
    // A cached id can go stale server-side (expired, or the conversation was
    // deleted). ChatStream only reports that as an in-band error frame after
    // the stream has already been handed to the caller, which is too late to
    // retry. Verify the id first and create a replacement when it is gone.
    if (useChatSessionId && !(await this.chatSessionExists(useChatSessionId, headers))) {
      // console.log('[StepFun][CONNECT] cached session is gone, requesting a new one')
      useChatSessionId = null
      this.chatSessionId = null
      sessionCache.delete(sessionKey)
    }

    if (!useChatSessionId) {
      // createChatSession seeds the cache itself, keyed on currentSessionKey.
      const created = await this.createChatSession(headers)
      if (created) {
        useChatSessionId = created
        // console.log('[StepFun][CONNECT] created chat session:', created)
      } else {
        // console.error('[StepFun][CONNECT] CreateChatSession failed; ChatStream will likely be rejected')
      }
    }

    // Build user message content from messages array
    const userContent = request.messages
      .map((msg) => {
        if (msg.role === 'system') return ''
        const content = msg.content == null ? '' : msg.content
        return content
      })
      .filter(Boolean)
      .join('\n') || ''

    // Build Connect request body
    // chatSessionId MUST be a direct child of message (not inside content)
    // Server signs the request against message.chatSessionId
    const messageBody: any = {
      content: {
        userMessage: {
          qa: {
            content: userContent
          }
        }
      }
    }
    if (useChatSessionId) {
      messageBody.chatSessionId = useChatSessionId
    }

    // config mirrors the web client's defaults (both flags true) unless the
    // caller explicitly downgrades reasoning via reasoning_effort.
    const requestData = {
      message: messageBody,
      config: {
        model,
        enableReasoning: request.reasoning_effort !== 'low' && request.reasoning_effort !== 'none',
        enableSearch: false
      }
    }

    // Encode Connect frame: flag(1 byte) + length(4 bytes BE) + JSON body
    const requestBody = Buffer.from(JSON.stringify(requestData), 'utf-8')
    const connectFrame = Buffer.alloc(5 + requestBody.length)
    connectFrame[0] = 0x00 // data frame flag
    connectFrame.writeUInt32BE(requestBody.length, 1)
    requestBody.copy(connectFrame, 5)

    const connectHeaders = { ...headers }
    connectHeaders['content-type'] = 'application/connect+json'
    connectHeaders['connect-protocol-version'] = '1'
    // The captured flow sends the first message of a fresh conversation while
    // the URL is still /chats/new — the route only changes to /chats/<id>
    // after ChatStream returns. Follow the same order.
    connectHeaders['Referer'] = hadSessionBeforeRequest
      ? `https://chat.stepfun.com/chats/${useChatSessionId}`
      : 'https://chat.stepfun.com/chats/new'

    // DIAG: log header names actually being sent, so the shape can be diffed
    // against a live capture without leaking token material.
    // console.log('[StepFun][CONNECT] header names:', Object.keys(connectHeaders).sort().join(','))
    // console.log('[StepFun][CONNECT] cookie names:', (connectHeaders['Cookie'] || '')
    //   .split('; ').map(p => p.split('=')[0]).join(','))

    const request_ = net.request({
      method: 'POST',
      url: WEB_PROXY_ENDPOINT,
    })

    for (const [key, value] of Object.entries(connectHeaders)) {
      request_.setHeader(key, value)
    }

    const stream = new PassThrough()
    let currentMessageId = ''

    // console.log('[StepFun][CONNECT] about to send request, model=', model, 'frameSize=', connectFrame.length, 'body=', JSON.stringify(requestData).slice(0, 800))

    return new Promise((resolve) => {
      let responseReceived = false
      let serverError: string | null = null
      let buffer = Buffer.alloc(0)

      request_.on('response', (response) => {
        responseReceived = true
        const statusCode = response.statusCode
        const responseHeaders: Record<string, string> = {}
        Object.entries(response.headers || {}).forEach(([k, v]) => {
          responseHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v)
        })

        // console.log('[StepFun][CONNECT] response status=', statusCode, 'headers=', JSON.stringify(responseHeaders).slice(0, 300))

        if (statusCode && statusCode >= 400) {
          response.on('data', (chunk: Buffer) => {
            serverError = (serverError || '') + chunk.toString()
          })
          response.on('end', () => {
            console.error('[StepFun][CONNECT] error status=', statusCode, 'body=', serverError?.slice(0, 500))
            resolve({
              success: false,
              status: statusCode,
              error: serverError || `HTTP ${statusCode}`,
            })
          })
          return
        }

        response.on('data', (chunk: Buffer) => {
          buffer = Buffer.concat([buffer, chunk])
          // console.log('[StepFun][CONNECT] received chunk, len=', chunk.length, 'hex=', chunk.slice(0, 64).toString('hex'))
          const messageIdState = { current: currentMessageId }
          let consumed = this.processConnectFrames(buffer, stream, model, messageIdState)
          currentMessageId = messageIdState.current
          // console.log('[StepFun][CONNECT] binary frames consumed=', consumed, 'bufferRemaining=', buffer.length)
          // Fallback: if binary frame parser consumed nothing, try SSE text parsing
          if (consumed === 0 && buffer.length > 0) {
            consumed = this.parseConnectSSEText(buffer, stream, model, messageIdState)
            currentMessageId = messageIdState.current
          }
          buffer = buffer.slice(consumed)
        })

        response.on('end', () => {
          // Fallback: if binary frames weren't parsed, try SSE text on remaining buffer
          if (buffer.length > 0) {
            const messageIdState = { current: currentMessageId }
            this.parseConnectSSEText(buffer, stream, model, messageIdState)
            currentMessageId = messageIdState.current
          }
          stream.push(null)
          // console.log('[StepFun][CONNECT] stream ended, totalBytes=', buffer.length)
        })

        response.on('error', (error) => {
          console.error('[StepFun][CONNECT] Response error:', error)
          stream.destroy()
        })

        resolve({
          success: true,
          status: statusCode || 200,
          stream,
          headers: responseHeaders,
          error: serverError ?? undefined,
        })
      })

      request_.on('error', async (error) => {
        console.error('[StepFun][CONNECT] Request error:', error)
        stream.destroy()

        // Fallback: if net.request fails due to SSL, try axios instead
        const isSslError = (error.message || '').includes('ERR_SSL') || (error as any).code === -100 || (error as any).code === -101
        if (isSslError) {
          // console.log('[StepFun][CONNECT] SSL error detected, falling back to axios')
          try {
            const axiosResult = await this.chatCompletionConnectAxios(request, model, connectFrame, headers)
            resolve(axiosResult)
            return
          } catch (axiosError) {
            console.error('[StepFun][CONNECT] axios fallback also failed:', axiosError)
          }
        }

        resolve({
          success: false,
          error: this.formatNetworkError(error),
        })
      })

      const requestTimeout = setTimeout(() => {
        console.error('[StepFun][CONNECT] Request timed out after 120s, responseReceived=', responseReceived)
        ;(request_ as any).destroy()
        resolve({
          success: false,
          error: 'Request timed out. Please check your network and try again.',
        })
      }, 120000)

      request_.on('response', () => clearTimeout(requestTimeout))
      request_.on('error', () => clearTimeout(requestTimeout))

      try {
        request_.write(connectFrame, 'binary')
        request_.end()
        // console.log('[StepFun][CONNECT] Connect frame sent, size=', connectFrame.length)
      } catch (writeError) {
        clearTimeout(requestTimeout)
        console.error('[StepFun][CONNECT] write/end failed:', writeError)
        resolve({
          success: false,
          error: 'Failed to write request: ' + (writeError instanceof Error ? writeError.message : String(writeError)),
        })
      }
    })
  }

  /**
   * Call a unary method on capy.agent.v1.AgentService.
   *
   * These endpoints speak Connect over JSON: POST with content-type
   * application/json, a camelCase JSON body, and the same Cookie and oasis-*
   * headers ChatStream uses. Verified against a live capture and against the
   * protobuf schema extracted from the web bundle.
   *
   * Returns the parsed body, or null on any transport or HTTP failure. Pass
   * tolerate[status] = true to treat a specific status as a valid result
   * (GetChatSessionByID answers 404 for a session that no longer exists).
   */
  private async callAgentService(
    method: string,
    body: Record<string, any>,
    headers: Record<string, string>,
    opts: { timeoutMs?: number; tolerate?: number[]; referer?: string } = {},
  ): Promise<{ status: number; data: any; text: string } | null> {
    const url = `${WEB_PROXY_ENDPOINT.replace(/\/AgentService\/.*$/, '/AgentService')}/${method}`
    const tolerate = new Set(opts.tolerate || [])

    return new Promise((resolve) => {
      let settled = false
      const done = (value: { status: number; data: any; text: string } | null) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      const request_ = net.request({ method: 'POST', url })
      for (const [key, value] of Object.entries(headers)) {
        // These calls are plain JSON, not Connect streams.
        if (key.toLowerCase() === 'content-type') continue
        request_.setHeader(key, value)
      }
      request_.setHeader('content-type', 'application/json')
      if (opts.referer) {
        request_.setHeader('Referer', opts.referer)
      }

      request_.on('response', (response) => {
        const statusCode = response.statusCode || 0
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8')
          if ((statusCode < 200 || statusCode >= 300) && !tolerate.has(statusCode)) {
            console.error(`[StepFun][API] ${method} HTTP`, statusCode, text.slice(0, 300))
            return done(null)
          }
          let data: any = null
          try {
            data = text.trim() ? JSON.parse(text) : {}
          } catch {
            data = { raw: text.slice(0, 400) }
          }
          done({ status: statusCode, data, text })
        })
        response.on('error', (error) => {
          console.error(`[StepFun][API] ${method} response error:`, error)
          done(null)
        })
      })

      request_.on('error', (error) => {
        console.error(`[StepFun][API] ${method} request error:`, error)
        done(null)
      })

      const timeout = setTimeout(() => {
        console.error(`[StepFun][API] ${method} timed out`)
        ;(request_ as any).destroy()
        done(null)
      }, opts.timeoutMs ?? 15000)
      request_.on('response', () => clearTimeout(timeout))
      request_.on('error', () => clearTimeout(timeout))

      try {
        request_.write(JSON.stringify(body), 'utf-8')
        request_.end()
      } catch (writeError) {
        console.error(`[StepFun][API] ${method} write failed:`, writeError)
        clearTimeout(timeout)
        done(null)
      }
    })
  }

  /**
   * Create a chat session and return the server-issued session object.
   *
   * The web client calls this before the first message of a new conversation
   * and copies the returned id into message.chatSessionId. Skipping it makes
   * ChatStream fail with permission_denied / need sign in because the id does
   * not belong to any session owned by this account.
   *
   * CreateChatSessionRequest: scene(1) share_id(2) type(3) studio_id(4)
   * class(5) artifact_project_params(6) doc_ids(7) file_ids(8) vip_case(9)
   */
  private async createChatSession(
    headers: Record<string, string>,
    options: { type?: string; scene?: string; studioId?: string } = {},
  ): Promise<string | null> {
    const body: Record<string, any> = {}
    if (options.type) body.type = options.type
    if (options.scene) body.scene = options.scene
    if (options.studioId) body.studioId = options.studioId

    const res = await this.callAgentService('CreateChatSession', body, headers, {
      referer: 'https://chat.stepfun.com/chats/new',
    })
    if (!res) return null

    const session = res.data?.chatSession
    const id = session?.chatSessionId
    if (!id) {
      console.error('[StepFun][API] CreateChatSession returned no session id:', res.text.slice(0, 300))
      return null
    }

    // Seed the cache so the id is reused for follow-up turns.
    const useChatId = session?.chatId || ''
    this.chatSessionId = id
    this.setCachedSession(this.currentSessionKey || this.account.id, {
      chatSessionId: id,
      chatId: useChatId,
      createdAt: Date.now(),
    })
    return id
  }

  /**
   * Check whether a chat session id is still known to the server.
   *
   * Used to avoid sending ChatStream with a stale id: the server reports that
   * case as an in-band error frame ("chat session not found") after the stream
   * has already been returned, leaving no chance to retry. Any transport
   * failure is treated as "assume it exists" so a flaky probe never discards a
   * perfectly good session.
   */
  private async chatSessionExists(sessionId: string, headers: Record<string, string>): Promise<boolean> {
    const res = await this.callAgentService('GetChatSessionByID', { sessionId }, headers, {
      timeoutMs: 10000,
      tolerate: [404],
    })
    // Transport failure: assume the session is fine rather than discarding a
    // good id because of a flaky probe.
    if (!res) return true
    if (res.status === 404) return false

    // A live session answers with {"chatSession":{"chatSessionId":"..."}}.
    const returnedId = res.data?.chatSession?.chatSessionId
    if (returnedId) return String(returnedId) === String(sessionId)

    // A stale id answers HTTP 200 with the error at the TOP level:
    //   {"code":"not_found","message":"chat session not found"}
    // Note the code is not nested under "error", and the message itself
    // contains the word "chatSession" — matching on that string is what made
    // deleted sessions look alive.
    const code = res.data?.code || res.data?.error?.code || res.data?.debug?.code || ''
    if (/not_found/i.test(String(code))) return false
    if (/not found/i.test(String(res.data?.message || ''))) return false

    // Neither a session nor a recognisable error: treat as usable so a shape
    // change never triggers needless session churn.
    return res.status >= 500 || (res.status >= 200 && res.status < 300)
  }

  /**
   * List chat sessions, newest first.
   *
   * ListChatSessionsRequest: page_size(1) page_token(2) state(3) client_types(4)
   * State is STATE_UNSPECIFIED (history) or STATE_FAVOR (starred).
   */
  async listChatSessions(options: {
    pageSize?: number
    pageToken?: string
    favorites?: boolean
  } = {}): Promise<{ sessions: StepFunChatSession[]; nextPageToken: string }> {
    await this.acquireToken()
    const headers = this.buildHeaders()

    const body: Record<string, any> = { pageSize: options.pageSize ?? 50 }
    if (options.pageToken) body.pageToken = options.pageToken
    if (options.favorites) body.state = 'STATE_FAVOR'

    const res = await this.callAgentService('ListChatSessions', body, headers, {
      referer: 'https://chat.stepfun.com/',
    })
    if (!res) return { sessions: [], nextPageToken: '' }

    const sessions = Array.isArray(res.data?.chatSessions) ? res.data.chatSessions : []
    return {
      sessions: sessions.map((s: any) => this.normalizeSession(s)),
      nextPageToken: res.data?.nextPageToken || '',
    }
  }

  /**
   * Fetch a single chat session by id.
   * GetChatSessionByIDRequest: session_id(1)
   */
  async getChatSession(sessionId: string): Promise<StepFunChatSession | null> {
    await this.acquireToken()
    const headers = this.buildHeaders()

    const res = await this.callAgentService('GetChatSessionByID', { sessionId }, headers, {
      tolerate: [404],
      referer: 'https://chat.stepfun.com/',
    })
    if (!res || res.status === 404) return null
    const session = res.data?.chatSession
    return session ? this.normalizeSession(session) : null
  }

  /**
   * Delete one or more chat sessions.
   * DeleteChatSessionRequest: chat_session_ids(1, repeated)
   */
  async deleteChatSessions(sessionIds: string[]): Promise<boolean> {
    if (sessionIds.length === 0) return true
    await this.acquireToken()
    const headers = this.buildHeaders()

    const res = await this.callAgentService('DeleteChatSession', { chatSessionIds: sessionIds }, headers, {
      referer: 'https://chat.stepfun.com/',
    })
    if (!res) return false

    // Drop any cached id that was just deleted, otherwise the next turn would
    // send ChatStream with a session the server no longer knows.
    for (const id of sessionIds) {
      if (this.chatSessionId === id) this.chatSessionId = null
      for (const [key, info] of Array.from(sessionCache.entries())) {
        if (info.chatSessionId === id) sessionCache.delete(key)
      }
    }
    return true
  }

  /**
   * Rename a chat session.
   * UpdateChatSessionRequest wraps a full ChatSession: set chat_session_id and
   * display_name on a partial object and the server updates just those fields.
   */
  async updateChatSession(sessionId: string, displayName: string): Promise<boolean> {
    await this.acquireToken()
    const headers = this.buildHeaders()

    const res = await this.callAgentService(
      'UpdateChatSession',
      { chatSession: { chatSessionId: sessionId, displayName } },
      headers,
      { referer: `https://chat.stepfun.com/chats/${sessionId}` },
    )
    if (!res) return false

    for (const [key, info] of Array.from(sessionCache.entries())) {
      if (info.chatSessionId === sessionId) sessionCache.delete(key)
    }
    return true
  }

  /**
   * Star or unstar a session.
   * FavorChatSessionRequest: chat_session_id(1) state(2)
   */
  async favorChatSession(sessionId: string, favorite: boolean): Promise<boolean> {
    await this.acquireToken()
    const headers = this.buildHeaders()

    const res = await this.callAgentService(
      'FavorChatSession',
      { chatSessionId: sessionId, state: favorite ? 'STATE_FAVOR' : 'STATE_UNSPECIFIED' },
      headers,
      { referer: `https://chat.stepfun.com/chats/${sessionId}` },
    )
    return !!res
  }

  /**
   * Search chat sessions by text.
   * SearchChatSessionsRequest: query(1) state(2) client_types(3)
   */
  async searchChatSessions(query: string): Promise<StepFunChatSession[]> {
    await this.acquireToken()
    const headers = this.buildHeaders()

    const res = await this.callAgentService('SearchChatSessions', { query }, headers, {
      referer: 'https://chat.stepfun.com/',
    })
    if (!res) return []
    const sessions = Array.isArray(res.data?.chatSessions) ? res.data.chatSessions : []
    return sessions.map((s: any) => this.normalizeSession(s))
  }

  /**
   * Convert a wire ChatSession into the shape used by the app.
   * Field names follow capy.agent.v1.ChatSession.
   */
  private normalizeSession(raw: any): StepFunChatSession {
    return {
      chatSessionId: String(raw?.chatSessionId || ''),
      chatId: String(raw?.chatId || ''),
      displayName: String(raw?.displayName || ''),
      latestMessageId: String(raw?.latestMessageId || ''),
      state: raw?.state || 'STATE_UNSPECIFIED',
      type: raw?.type || 'TYPE_UNSPECIFIED',
      chatClientType: raw?.chatClientType || 'CHAT_CLIENT_TYPE_UNSPECIFIED',
      class: raw?.class || 'CLASS_UNSPECIFIED',
      createTime: raw?.createTime || '',
      updateTime: raw?.updateTime || '',
    }
  }

  /**
   * Pull the session id out of a CreateChatSession response.
   *
   * Accepts either a plain JSON body or a Connect frame (flag + BE length +
   * JSON), and looks for the id under the handful of names the API uses.
   */
  private extractSessionId(body: string): string | null {
    const findIn = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null
      const direct = obj.chatSessionId || obj.sessionId || obj.chatSessionID
      if (typeof direct === 'string' && direct) return direct
      if (typeof direct === 'number') return String(direct)
      for (const value of Object.values(obj)) {
        const nested = findIn(value)
        if (nested) return nested
      }
      return null
    }

    const tryParse = (text: string): string | null => {
      const trimmed = text.trim()
      if (!trimmed.startsWith('{')) return null
      try {
        return findIn(JSON.parse(trimmed))
      } catch {
        return null
      }
    }

    // Direct JSON body.
    const direct = tryParse(body)
    if (direct) return direct

    // Connect-framed body: skip the 5-byte header and try each frame.
    const buf = Buffer.from(body, 'utf-8')
    let offset = 0
    while (offset + 5 <= buf.length) {
      const frameLen = buf.readUInt32BE(offset + 1)
      if (offset + 5 + frameLen > buf.length) break
      const payload = buf.slice(offset + 5, offset + 5 + frameLen).toString('utf-8')
      const found = tryParse(payload)
      if (found) return found
      offset += 5 + frameLen
    }

    // Last resort: regex over the raw text.
    const m = body.match(/"(?:chatSessionId|sessionId)"\s*:\s*"(\d+)"/)
    return m ? m[1] : null
  }

  /**
   * Axios fallback for Connect protocol when net.request fails due to SSL.
   * Uses Node.js HTTP stack instead of Chromium net stack.
   */
  private async chatCompletionConnectAxios(
    request: ChatCompletionRequest,
    model: string,
    connectFrame: Buffer,
    connectHeaders: Record<string, string>,
  ): Promise<{ success: boolean; status?: number; stream?: PassThrough; headers?: Record<string, string>; error?: string }> {
    const stream = new PassThrough()
    const httpStream = new PassThrough()

    try {
      const response = await axios.post(WEB_PROXY_ENDPOINT, connectFrame.slice(5), {
        headers: {
          ...connectHeaders,
          'Content-Type': 'application/connect+json',
        },
        responseType: 'stream',
        timeout: 120000,
        validateStatus: () => true,
      })

      const statusCode = response.status
      console.log('[StepFun][CONNECT-AXIOS] response status=', statusCode)

      if (statusCode && statusCode >= 400) {
        let errorBody = ''
        response.data.on('data', (chunk: Buffer) => { errorBody += chunk.toString() })
        await new Promise<void>((resolve) => response.data.on('end', () => resolve()))
        return { success: false, status: statusCode, error: errorBody || `HTTP ${statusCode}` }
      }

      const httpStreamAny = response.data as NodeJS.ReadableStream
      let buffer = Buffer.alloc(0)
      let currentMessageId = ''

      httpStreamAny.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk])
        const messageIdState = { current: currentMessageId }
        let consumed = this.processConnectFrames(buffer, stream, model, messageIdState)
        currentMessageId = messageIdState.current
        if (consumed === 0 && buffer.length > 0) {
          consumed = this.parseConnectSSEText(buffer, stream, model, messageIdState)
          currentMessageId = messageIdState.current
        }
        buffer = buffer.slice(consumed)
      })

      httpStreamAny.on('end', () => {
        if (buffer.length > 0) {
          const messageIdState = { current: currentMessageId }
          this.parseConnectSSEText(buffer, stream, model, messageIdState)
        }
        stream.push(null)
      })

      httpStreamAny.on('error', (error) => {
        console.error('[StepFun][CONNECT-AXIOS] stream error:', error)
        stream.destroy()
      })

      return { success: true, status: statusCode || 200, stream, headers: response.headers as Record<string, string> }
    } catch (error) {
      console.error('[StepFun][CONNECT-AXIOS] request failed:', error)
      stream.destroy()
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Axios fallback failed',
      }
    }
  }

  /**
   * Token-based sliding window queue for incremental tool call extraction.
   *
   * Why: streaming responses arrive in chunks. A tool marker like
   * "<tool name="pwd"><arguments>{}</arguments></tool>" can be split across
   * multiple chunks. The model may also interleave normal text with tool
   * calls (e.g. "hello\n<tool_use>...</tool_use>\nworld").
   *
   * This queue keeps a rolling buffer. On each new content arrival we
   * scan the buffer for the earliest complete tool marker. Text before the
   * marker is emitted as content. The marker is extracted and removed.
   * Any trailing incomplete marker stays in the buffer for the next round.
   */
  private static toolQueue: { buffer: string } = {
    buffer: '',
  }

  private static QUEUE_MAX_CHARS = 5000 // hard cap to prevent unbounded growth

  /**
   * Given a buffer, find the start position of the earliest tool marker
   * (any of the three formats). Returns -1 if no marker start is found.
   */
  private static findFirstMarkerStart(buf: string): number {
    const candidates: number[] = []

    // Format 1: <|KX2API|invoke name="..."
    const prefix = PROTOCOL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const invokeOpenPattern = new RegExp('<' + '\\|' + prefix + '\\|invoke\\s+name="([^"]+)"', 'g')
    const invokeMatch = invokeOpenPattern.exec(buf)
    if (invokeMatch) candidates.push(invokeMatch.index)

    // Format 2: <tool name="..." (not <tool_use>)
    const toolNamePattern = /<tool\s+name="/gi
    let toolNameMatch
    while ((toolNameMatch = toolNamePattern.exec(buf)) !== null) {
      const before = buf.slice(Math.max(0, toolNameMatch.index - 10), toolNameMatch.index)
      if (!before.includes('<tool_use')) {
        candidates.push(toolNameMatch.index)
      }
    }

    // Format 3: <tool_use>
    const toolUseIdx = buf.indexOf('<tool_use>')
    if (toolUseIdx >= 0) candidates.push(toolUseIdx)

    return candidates.length > 0 ? Math.min(...candidates) : -1
  }

  /**
   * Check if there is a complete tool marker starting at the given offset
   * in the buffer. Returns the endIndex (exclusive) and parsed data, or null.
   */
  private static tryParseMarkerAt(buf: string, offset: number): { endIndex: number; name: string; params: Record<string, string> } | null {
    const sub = buf.slice(offset)

    // --- Format 1: <|KX2API|invoke name="...">...<|KX2API|invoke> ---
    const prefix = PROTOCOL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const invokeOpenPattern = new RegExp('<' + '\\|' + prefix + '\\|invoke\\s+name="([^"]+)"')
    const invokeOpenMatch = invokeOpenPattern.exec(sub)
    if (invokeOpenMatch && invokeOpenMatch.index === 0) {
      const closePattern = new RegExp('<' + '\\|' + prefix + '\\|invoke>')
      const closeMatch = closePattern.exec(sub)
      if (closeMatch && closeMatch.index >= invokeOpenMatch.index) {
        const blockEnd = closeMatch.index + closeMatch[0].length
        const block = sub.slice(0, blockEnd)
        const params: Record<string, string> = {}
        const paramRegex = new RegExp(
          '<' + '\\|' + prefix + '\\|parameter\\s+name="([^"]+)"(?:[^>]*)?>(.*?)<' + '\\|' + prefix + '\\|parameter>',
          'g'
        )
        let pm
        while ((pm = paramRegex.exec(block)) !== null) {
          params[pm[1]] = pm[2].trim()
        }
        return { endIndex: offset + blockEnd, name: invokeOpenMatch[1], params }
      }
    }

    // --- Format 2: <tool name="..."><arguments>...</arguments></tool> ---
    const toolOpenMatch = sub.match(/^<tool\s+name="([^"]+)"/i)
    if (toolOpenMatch) {
      const toolCloseIdx = sub.indexOf('</tool>')
      if (toolCloseIdx >= 0) {
        const blockEnd = toolCloseIdx + '</tool>'.length
        const block = sub.slice(0, blockEnd)
        const argsMatch = block.match(/<arguments[^>]*>([\s\S]*?)<\/arguments>/i)
        let argsStr = argsMatch ? argsMatch[1].trim() : '{}'
        const cdataMatch = argsStr.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
        if (cdataMatch) argsStr = cdataMatch[1].trim()
        const parsedArgs = StepFunAdapter.parseJsonArgs(argsStr)
        return { endIndex: offset + blockEnd, name: toolOpenMatch[1], params: parsedArgs }
      }
    }

    // --- Format 3: <tool_use><name>...</name><arguments>...</arguments></tool_use> ---
    if (sub.startsWith('<tool_use>')) {
      const toolUseCloseIdx = sub.indexOf('</tool_use>')
      if (toolUseCloseIdx >= 0) {
        const blockEnd = toolUseCloseIdx + '</tool_use>'.length
        const block = sub.slice(0, blockEnd)
        const inner = block.slice('<tool_use>'.length, blockEnd - '</tool_use>'.length)
        const nameMatch = inner.match(/<name[^>]*>([\s\S]*?)<\/name>/i)
        const argsMatch = inner.match(/<arguments[^>]*>([\s\S]*?)<\/arguments>/i)
        if (nameMatch) {
          const toolName = nameMatch[1].trim()
          const argsStr = argsMatch ? argsMatch[1].trim() : '{}'
          const parsedArgs = StepFunAdapter.parseJsonArgs(argsStr)
          return { endIndex: offset + blockEnd, name: toolName, params: parsedArgs }
        }
      }
    }

    return null
  }

  /**
   * Append new text to the queue and return any newly extractable tool calls
   * plus the display-safe text that should be forwarded to the client.
   *
   * Algorithm:
   *   1. Append newText to buffer
   *   2. Find the earliest marker start position in the entire buffer
   *   3. Try to parse a complete marker at that position
   *   4. If complete: emit text before it as content, extract tool call,
   *      remove consumed portion, repeat from step 2
   *   5. If incomplete: stop, keep everything in buffer for next round
   *   6. If no marker: emit all text as content
   */
  private static processQueue(
    newText: string
  ): {
    extractedCalls: Array<{ name: string; params: Record<string, string> }>
    displayText: string
  } {
    const q = StepFunAdapter.toolQueue
    const prevLen = q.buffer.length
    q.buffer += newText

    // Hard cap: if buffer exceeds max, discard oldest portion
    if (q.buffer.length > StepFunAdapter.QUEUE_MAX_CHARS) {
      const excess = q.buffer.length - StepFunAdapter.QUEUE_MAX_CHARS
      q.buffer = q.buffer.slice(excess)
    }

    const extractedCalls: Array<{ name: string; params: Record<string, string> }> = []
    const contentSegments: string[] = []
    let iterations = 0
    const MAX_ITERATIONS = 20

    while (q.buffer.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++

      const markerStart = StepFunAdapter.findFirstMarkerStart(q.buffer)
      // console.log(`[StepFun][QUEUE] iter=${iterations} bufLen=${q.buffer.length} prevLen=${prevLen} markerStart=${markerStart} bufPreview=${JSON.stringify(q.buffer.slice(Math.max(0, markerStart - 30), markerStart + 80))}`)

      if (markerStart < 0) {
        // No tool marker in buffer at all — all text is safe content
        const allText = q.buffer
        q.buffer = ''
        contentSegments.push(StepFunAdapter.filterProtocolMarkersFromBuffer(allText))
        break
      }

      // Try to parse a complete marker at that position
      const marker = StepFunAdapter.tryParseMarkerAt(q.buffer, markerStart)

      if (!marker) {
        // Marker start found but incomplete — emit text before it (if any),
        // keep the incomplete marker in buffer, then break to wait for more data.
        // The next processQueue call will append new text to the buffer and
        // re-scan, allowing the marker to eventually become complete.
        const preText = q.buffer.slice(0, markerStart)
        const remaining = q.buffer.slice(markerStart)
        // console.log(`[StepFun][QUEUE] incomplete marker at ${markerStart}, emitting ${preText.length} chars, keeping ${remaining.length} in buffer`)
        contentSegments.push(StepFunAdapter.filterProtocolMarkersFromBuffer(preText))
        q.buffer = remaining
        break
      }

      // Complete marker found: emit text before it, extract tool call
      const preText = q.buffer.slice(0, markerStart)
      if (preText) {
        contentSegments.push(StepFunAdapter.filterProtocolMarkersFromBuffer(preText))
      }
      // console.log(`[StepFun][QUEUE] EXTRACTED tool call: name=${marker.name} params=${JSON.stringify(marker.params)}`)
      extractedCalls.push({ name: marker.name, params: marker.params })
      q.buffer = q.buffer.slice(marker.endIndex)
    }

    const finalDisplay = contentSegments.join('') + StepFunAdapter.filterProtocolMarkersFromBuffer(q.buffer)
    // console.log(`[StepFun][QUEUE] RESULT: extractedCalls=${extractedCalls.length} displayLen=${finalDisplay.length} bufferRemaining=${q.buffer.length}`)
    return { extractedCalls, displayText: finalDisplay }
  }

  /**
   * Filter protocol markers from a buffer string (used on remaining queue
   * content after tool extraction). Same logic as filterProtocolMarkers but
   * operates on the queue's residual text.
   */
  private static filterProtocolMarkersFromBuffer(text: string): string {
    const prefix = PROTOCOL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let cleaned = text.replace(new RegExp('<\\|' + prefix + '\\|[^|]*\\|>', 'g'), '')
    cleaned = cleaned.replace(new RegExp('<\\|' + prefix + '\\|[^>]*$', 'g'), '')
    // Strip complete tool markers
    cleaned = cleaned.replace(/<tool(?!_)[^>]*>[\s\S]*?<\/tool>/gi, '')
    cleaned = cleaned.replace(/<tool_use>[\s\S]*?<\/tool_use>/gi, '')
    cleaned = cleaned.replace(/<arguments[^>]*>[\s\S]*?<\/arguments>/gi, '')
    // Strip incomplete tool markers at end of buffer (streaming chunks may
    // arrive with split tags that have not yet closed)
    cleaned = cleaned.replace(/<tool(?!_)[^>]*>[\s\S]*$/gi, '')
    cleaned = cleaned.replace(/<tool_use>[\s\S]*$/gi, '')
    cleaned = cleaned.replace(/<arguments[^>]*>[\s\S]*$/gi, '')
    cleaned = cleaned.replace(/[ \t]+/g, ' ').trim()
    return cleaned
  }

  /**
   * Strip internal protocol markers from response text.
   * Removes <|PREFIX|...|> tags that leak into user-facing output.
   */
  private static filterProtocolMarkers(text: string): string {
    const prefix = PROTOCOL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let cleaned = text.replace(new RegExp('<\\|' + prefix + '\\|[^|]*\\|>', 'g'), '')
    cleaned = cleaned.replace(new RegExp('<\\|' + prefix + '\\|[^>]*$', 'g'), '')
    cleaned = cleaned.replace(/<tool(?!_)[^>]*>[\s\S]*?<\/tool>/gi, '')
    cleaned = cleaned.replace(/<tool_use>[\s\S]*?<\/tool_use>/gi, '')
    cleaned = cleaned.replace(/<arguments[^>]*>[\s\S]*?<\/arguments>/gi, '')
    cleaned = cleaned.replace(/[ \t]+/g, ' ').trim()
    return cleaned
  }

  private static extractToolCalls(text: string): Array<{ name: string; params: Record<string, string> }> {
    const calls: Array<{ name: string; params: Record<string, string> }> = []
    const prefix = PROTOCOL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const invokeRegex = new RegExp('<\\|' + prefix + '\\|invoke\\s+name="([^"]+)"(.*?)<\\/' + prefix + '\\|invoke>')
    let match
    while ((match = invokeRegex.exec(text)) !== null) {
      const params: Record<string, string> = {}
      const paramRegex = new RegExp('<\\|' + prefix + '\\|parameter\\s+name="([^"]+)"(?:[^>]*)?>(.*?)<\\/' + prefix + '\\|parameter>')
      let paramMatch
      while ((paramMatch = paramRegex.exec(match[2])) !== null) {
        params[paramMatch[1]] = paramMatch[2].trim()
      }
      calls.push({ name: match[1], params })
    }

    // StepFun web response format: <tool name="xxx"><arguments>{...}</arguments></tool>
    const toolRegex = /<tool\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/tool>/gi
    let toolMatch
    while ((toolMatch = toolRegex.exec(text)) !== null) {
      const toolName = toolMatch[1]
      const inner = toolMatch[2]
      const argsMatch = inner.match(/<arguments[^>]*>([\s\S]*?)<\/arguments>/i)
      if (!argsMatch) continue
      let argsStr = argsMatch[1].trim()
      const cdataMatch = argsStr.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
      if (cdataMatch) argsStr = cdataMatch[1].trim()
      const parsedArgs = StepFunAdapter.parseJsonArgs(argsStr)
      calls.push({ name: toolName, params: parsedArgs })
    }

    // Claude-style XML format: <tool_use><name>xxx</name><arguments>{...}</arguments></tool_use>
    const toolUseRegex = /<tool_use>([\s\S]*?)<\/tool_use>/gi
    let toolUseMatch
    while ((toolUseMatch = toolUseRegex.exec(text)) !== null) {
      const inner = toolUseMatch[1]
      const nameMatch = inner.match(/<name[^>]*>([\s\S]*?)<\/name>/i)
      const argsMatch = inner.match(/<arguments[^>]*>([\s\S]*?)<\/arguments>/i)
      if (!nameMatch) continue
      const toolName = nameMatch[1].trim()
      const argsStr = argsMatch ? argsMatch[1].trim() : '{}'
      const parsedArgs = StepFunAdapter.parseJsonArgs(argsStr)
      calls.push({ name: toolName, params: parsedArgs })
    }

    return calls
  }

  private static parseJsonArgs(argsStr: string): Record<string, string> {
    const cdataMatch = argsStr.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
    if (cdataMatch) argsStr = cdataMatch[1].trim()
    try {
      const json = JSON.parse(argsStr)
      return Object.fromEntries(
        Object.entries(json).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
      )
    } catch {
      return { arguments: argsStr }
    }
  }

  /**
   * Process Connect protocol frames from response buffer
   * Frame format: 1-byte flag + 4-byte big-endian length + JSON body
   * Returns the number of bytes consumed from the buffer
   */
  private processConnectFrames(buffer: Buffer, stream: PassThrough, model: string, messageIdState: { current: string }): number {
    let offset = 0
    while (offset + 5 <= buffer.length) {
      const flag = buffer[offset]
      const frameLen = buffer.readUInt32BE(offset + 1)
      if (offset + 5 + frameLen > buffer.length) {
        break // incomplete frame, wait for more data
      }
      const frameData = buffer.slice(offset + 5, offset + 5 + frameLen)
      offset += 5 + frameLen

      try {
        const json = JSON.parse(frameData.toString('utf-8'))
        this.handleConnectEvent(json, stream, model, messageIdState)
      } catch (e) {
        console.error('[StepFun][CONNECT] failed to parse frame:', frameData.slice(0, 200))
      }
    }
    return offset // return bytes consumed, caller keeps the rest
  }

  /**
   * Parse SSE text format from Connect API response as fallback
   * Handles lines like: data: {"data":{"event":{"textEvent":{"text":"..."}}}}
   */
  private parseConnectSSEText(buffer: Buffer, stream: PassThrough, model: string, messageIdState: { current: string }): number {
    const text = buffer.toString('utf-8')
    const lines = text.split('\n')
    let consumed = 0
    let hasData = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue

      const dataStr = trimmed.slice(6).trim()
      if (dataStr === '[DONE]') continue

      try {
        const parsed = JSON.parse(dataStr)
        const event = parsed?.data?.event
        if (!event) continue

        if (event.textEvent) {
          const rawText = event.textEvent.text || ''
          if (!rawText || !messageIdState.current) continue

          // console.log(`[StepFun][QUEUE][SSE] textEvent received, len=${rawText.length}, preview=${JSON.stringify(rawText.slice(0, 120))}`)

          // Use queue-based extraction to handle tool markers split across chunks
          const { extractedCalls, displayText } = StepFunAdapter.processQueue(rawText)

          if (displayText) {
            stream.write('data: ' + JSON.stringify({
              id: messageIdState.current,
              model,
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { role: 'assistant', content: displayText }, finish_reason: null }],
              created: Math.floor(Date.now() / 1000),
            }) + '\n\n')
          }
          if (extractedCalls.length > 0) {
            const tcChunks = extractedCalls.map((call, idx) => ({
              id: 'call_' + messageIdState.current + '_' + idx,
              type: 'function',
              function: { name: call.name, arguments: JSON.stringify(call.params) },
            }))
            stream.write('data: ' + JSON.stringify({
              id: messageIdState.current,
              model, object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { role: 'assistant', content: '', tool_calls: tcChunks }, finish_reason: null }],
              created: Math.floor(Date.now() / 1000),
            }) + '\n\n')
          }
          hasData = true
        }
      } catch {
        // skip unparseable SSE data
      }
    }

    return hasData ? buffer.length : 0
  }

  /**
   * Handle a single Connect protocol event
   */
  private handleConnectEvent(json: any, stream: PassThrough, model: string, messageIdState: { current: string }): void {
    if (!json) return

    // Error frame: {"error":{"code":"...","message":"..."}}
    // IMPORTANT: This error frame may arrive BEFORE any startEvent (e.g. when token
    // validation fails server-side), so messageIdState.current is still empty.
    // We must ALWAYS surface the error to the stream instead of silently dropping it,
    // otherwise the caller receives an empty-but-successful response with no hint.
    if (json.error) {
      const errMsg = json.error.message || JSON.stringify(json.error)
      const errCode = json.error.code || 'unknown'
      console.error('[StepFun][CONNECT] error frame:', errMsg)

      // Self-heal: the pre-flight check can only catch a stale id before the
      // request goes out. If the server rejects it anyway, drop the cached id
      // so the next turn creates a fresh session instead of failing the same
      // way forever.
      if (/not_found/i.test(String(errCode)) || /session not found/i.test(String(errMsg))) {
        console.log('[StepFun][CONNECT] session rejected by server, clearing cached id') // KEPT: error recovery
        this.chatSessionId = null
        if (this.currentSessionKey) sessionCache.delete(this.currentSessionKey)
      }

      // Token expired / unauthenticated: the browser session may have rotated
      // while we were holding a stale Oasis-Token. Ask the session manager to
      // force a reload + credential re-extract now, and drop the local
      // validation cache, so the NEXT request automatically carries a fresh
      // token instead of re-sending the expired one (which fails forever until
      // the user manually re-logs-in).
      if (/token is expired|token.*expired|expired/i.test(errMsg) || /unauth|expired/.test(String(errCode))) {
        console.log('[StepFun][CONNECT] token expired/unauth, forcing session refresh & clearing validation cache') // KEPT: error recovery
        tokenValidationCache.delete(this.oasisToken.slice(0, 40))
        if (this.isApiKeyMode) {
          // In API-key mode there is no browser partition to refresh; surface the
          // error as-is so the user re-mints or re-enters the key.
        } else {
          if (stepfunSessionManager.ready()) {
            stepfunSessionManager.refresh()
              .then(() => {
                const fresh = stepfunSessionManager.getToken()
                const freshWebId = stepfunSessionManager.getWebId()
                if (fresh && fresh.length > 10 && fresh !== this.oasisToken) {
                  // console.log('[StepFun][CONNECT] token refreshed after expiry, new tokenLen=', fresh.length)
                  this.updateToken(fresh, freshWebId, { Cookie: stepfunSessionManager.getCookieHeader() })
                }
              })
              .catch((e) => console.error('[StepFun][CONNECT] token refresh failed:', e))
          } else {
            console.warn('[StepFun][CONNECT] session manager not ready, cannot auto-refresh token')
          }
        }
      }

      const errorChunk = {
        id: messageIdState.current || Math.random().toString(36).slice(2),
        model,
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: { role: 'assistant', content: '' },
          finish_reason: 'error',
          error: { code: errCode, message: errMsg },
        }],
        created: Math.floor(Date.now() / 1000),
      }
      stream.write('data: ' + JSON.stringify(errorChunk) + '\n\n')
      stream.write('data: [DONE]\n\n')
      stream.end()
      return
    }

    if (!json.data || !json.data.event) return

    const event = json.data.event

    // startEvent: session started
    if (event.startEvent) {
      const messageId = event.startEvent.messageId || ''
      messageIdState.current = messageId
      // console.log('[StepFun][CONNECT] startEvent, messageId=', messageId)
      return
    }

    // messageEvent: contains message metadata (chatId, chatSessionId) and empty qa
    // Actual text comes via textEvent frames
    if (event.messageEvent) {
      const msg = event.messageEvent.message || {}
      const messageId = msg.messageId || ''
      if (messageId) {
        messageIdState.current = messageId
      }
      if (!this.isApiKeyMode) {
        const newChatSessionId = msg.chatSessionId || ''
        const newChatId = msg.chatId || ''
        if (newChatSessionId) {
          this.chatSessionId = newChatSessionId
        }
        if (newChatId) {
          this.chatId = newChatId
        }
        if (newChatSessionId || newChatId) {
          this.setCachedSession(this.currentSessionKey || this.account.id, {
            chatSessionId: newChatSessionId,
            chatId: newChatId,
            createdAt: Date.now(),
          })
        }
      }
      // console.log('[StepFun][CONNECT] messageEvent, messageId=', messageId, 'chatId=', msg.chatId)
      return
    }

    // textEvent: streaming text response (actual content)
    if (event.textEvent) {
      const rawText = event.textEvent.text || ''
      if (rawText && messageIdState.current) {
        // console.log(`[StepFun][QUEUE][CONNECT] textEvent received, len=${rawText.length}, preview=${JSON.stringify(rawText.slice(0, 120))}`)

        // Use queue-based extraction to handle tool markers split across chunks
        const { extractedCalls, displayText } = StepFunAdapter.processQueue(rawText)

        // Send text chunk (filtered)
        if (displayText) {
          const deltaChunk = {
            id: messageIdState.current,
            model: model,
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: { role: 'assistant', content: displayText },
              finish_reason: null,
            }],
            created: Math.floor(Date.now() / 1000),
          }
          stream.write('data: ' + JSON.stringify(deltaChunk) + '\n\n')
        }

        // Send tool calls as additional commands if any were extracted
        if (extractedCalls.length > 0) {
          const toolCallChunks = extractedCalls.map((call, idx) => ({
            id: 'call_' + messageIdState.current + '_' + idx,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.params),
            },
          }))

          const toolCallDeltaChunk = {
            id: messageIdState.current,
            model: model,
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: {
                role: 'assistant',
                content: '',
                tool_calls: toolCallChunks,
              },
              finish_reason: null,
            }],
            created: Math.floor(Date.now() / 1000),
          }
          stream.write('data: ' + JSON.stringify(toolCallDeltaChunk) + '\n\n')
        }
      }
      return
    }

    // reasoningEvent: thinking process (streamed chunks)
    if (event.reasoningEvent) {
      const text = event.reasoningEvent.text || ''
      if (text && messageIdState.current) {
        // console.log('[StepFun][CONNECT] reasoningEvent, text=', text.slice(0, 80))
        const deltaChunk = {
          id: messageIdState.current,
          model: model,
          object: 'chat.completion.chunk',
          choices: [{
            index: 0,
            delta: { role: 'assistant', reasoning_content: text },
            finish_reason: null,
          }],
          created: Math.floor(Date.now() / 1000),
        }
        stream.write('data: ' + JSON.stringify(deltaChunk) + '\n\n')
      }
      return
    }

    // pipelineEvent: pipeline status updates
    if (event.pipelineEvent) {
      const action = event.pipelineEvent.action || ''
      const title = event.pipelineEvent.title || ''
      if (title) {
        // console.log('[StepFun][CONNECT] pipelineEvent, action=', action, 'title=', title)
      }
      return
    }

    // messageDoneEvent: single message completed
    if (event.messageDoneEvent) {
      // console.log('[StepFun][CONNECT] messageDoneEvent, messageId=', messageIdState.current)
      return
    }

    // doneEvent: entire stream completed (server-end signal)
    if (event.doneEvent) {
      // console.log('[StepFun][CONNECT] doneEvent, messageId=', messageIdState.current)
      // Flush any remaining content from the tool queue before ending
      const remaining = StepFunAdapter.toolQueue.buffer
      StepFunAdapter.toolQueue.buffer = ''
      if (remaining) {
        // First, try to extract any complete tool calls from the remaining buffer
        const finalCalls = StepFunAdapter.extractToolCalls(remaining)
        const displayRemaining = StepFunAdapter.filterProtocolMarkers(remaining)

        if (displayRemaining) {
          const remainingChunk = {
            id: messageIdState.current,
            model: model,
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: { role: 'assistant', content: displayRemaining },
              finish_reason: null,
            }],
            created: Math.floor(Date.now() / 1000),
          }
          stream.write('data: ' + JSON.stringify(remainingChunk) + '\n\n')
        }

        if (finalCalls.length > 0) {
          const toolCallChunks = finalCalls.map((call, idx) => ({
            id: 'call_' + messageIdState.current + '_' + idx,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.params),
            },
          }))
          const toolCallDeltaChunk = {
            id: messageIdState.current,
            model: model,
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: {
                role: 'assistant',
                content: '',
                tool_calls: toolCallChunks,
              },
              finish_reason: null,
            }],
            created: Math.floor(Date.now() / 1000),
          }
          stream.write('data: ' + JSON.stringify(toolCallDeltaChunk) + '\n\n')
          // console.log('[StepFun][CONNECT] doneEvent FLUSHED toolCalls=', finalCalls.length, 'names=', finalCalls.map(c => c.name).join(','))
        }
      }
      const finishChunk = {
        id: messageIdState.current,
        model: model,
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
        created: Math.floor(Date.now() / 1000),
      }
      stream.write('data: ' + JSON.stringify(finishChunk) + '\n\n')
      stream.write('data: [DONE]\n\n')
      stream.end()
      return
    }

    // finishEvent: legacy stream end (kept for compatibility)
    if (event.finishEvent) {
      const messageId = event.finishEvent.messageId || messageIdState.current
      const reason = event.finishEvent.finishReason || 'stop'
      // console.log('[StepFun][CONNECT] finishEvent, messageId=', messageId, 'reason=', reason)
      const finishChunk = {
        id: messageId,
        model: model,
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: reason,
        }],
        created: Math.floor(Date.now() / 1000),
      }
      stream.write('data: ' + JSON.stringify(finishChunk) + '\n\n')
      stream.write('data: [DONE]\n\n')
      stream.end()
      return
    }

    // errorEvent: error occurred
    if (event.errorEvent) {
      const errorMsg = event.errorEvent.message || '未知错误'
      console.error('[StepFun][CONNECT] errorEvent:', errorMsg)
      const errorChunk = {
        id: messageIdState.current || '',
        model: model,
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'error',
        }],
        created: Math.floor(Date.now() / 1000),
      }
      stream.write('data: ' + JSON.stringify(errorChunk) + '\n\n')
      stream.write('data: [DONE]\n\n')
      stream.end()
      return
    }
  }

  static isStepFunProvider(provider: Provider): boolean {
    return provider.id === 'stepfun' || provider.apiEndpoint.includes('stepfun.com')
  }
}

export { StepFunStreamHandler } from './stepfun-stream'
export const stepfunAdapter = {
  StepFunAdapter,
}

