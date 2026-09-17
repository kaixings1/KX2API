/**
 * StepFun Studio Adapter
 * Supports web session mode for studio.stepfun.com
 * Reuses StepFun logic with studio-specific endpoints and headers.
 */

import { net } from 'electron'
import { Readable, PassThrough } from 'stream'
import { Account, Provider } from '../../store/types'
import { stepfunSessionManager } from '../../oauth/stepfunSessionManager'
import { StepFunStreamHandler } from './stepfun-stream'

// StepFun Studio endpoints
const STEP_PLAN_ENDPOINT = 'https://api.stepfun.com/step_plan/v1/chat/completions'
const API_ENDPOINT = 'https://api.stepfun.com/v1/chat/completions'
const WEB_PROXY_ENDPOINT = 'https://studio.stepfun.com/api/agent/capy.agent.v1.AgentService/ChatStream'

const API_HEADERS: Record<string, string> = {
  'Accept': 'application/json, text/event-stream',
  'Content-Type': 'application/json',
}

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

// --- Token parsing helpers (shared with StepFun adapter) ---
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

interface SessionInfo {
  chatSessionId: string
  chatId: string
  createdAt: number
  oasisId?: string
}

const sessionCache = new Map<string, SessionInfo>()
const SESSION_TTL_MS = 30 * 60 * 1000
const TOKEN_VALIDATION_TTL_MS = 5 * 60 * 1000

export class StepFunStudioAdapter {
  private provider: Provider
  private account: Account
  private oasisToken: string
  private webId: string
  private allCookies: StoredCookies
  private sessionCookieHeader: string = ''
  private currentSessionKey: string = ''
  private isApiKeyMode: boolean
  private chatSessionId: string | null = null
  private chatId: string | null = null
  private cachedAppId: string | null = null

  constructor(provider: Provider, account: Account) {
    console.log('[StepFunStudio][ADAPTER] constructor ENTRY, providerId=', provider.id, 'accountId=', account.id)
    this.provider = provider
    this.account = account
    const rawToken = account.credentials.token || account.credentials.apiKey || account.credentials.OasisToken || ''
    this.oasisToken = rawToken
    this.webId = account.credentials.web_id || account.credentials.webId || ''
    this.allCookies = (account.credentials.cookies || {}) as StoredCookies
    const hasWebSession = !!(this.oasisToken && this.webId)
    const hasJwtStructure = rawToken.includes('...') || (rawToken.includes('.') && rawToken.split('.').length >= 3)
    this.isApiKeyMode = !hasWebSession && !hasJwtStructure && rawToken.length > 0 && !rawToken.startsWith('ey')
    console.log('[StepFunStudio][ADAPTER] constructor EXIT, isApiKeyMode=', this.isApiKeyMode, 'hasWebSession=', hasWebSession, 'tokenPrefix=', rawToken ? rawToken.slice(0, 25) : '', 'webId=', this.webId ? this.webId.slice(0, 20) : '')
    if (this.oasisToken && !this.allCookies['Oasis-Token']) {
      this.allCookies['Oasis-Token'] = this.oasisToken
    }

    const incomingOasisId = this.readOasisId()
    if (incomingOasisId) {
      for (const [key, info] of Array.from(sessionCache.entries())) {
        if (info.oasisId && info.oasisId !== incomingOasisId) {
          sessionCache.delete(key)
        }
      }
    }

    stepfunSessionManager.on('token-updated', (token: string, webId: string, cookies: Record<string, string>) => {
      this.updateToken(token, webId, cookies)
    })
    if (stepfunSessionManager.ready() && stepfunSessionManager.hasCredentials()) {
      const smToken = stepfunSessionManager.getToken()
      const smWebId = stepfunSessionManager.getWebId()
      if (smToken && smToken.length > 10) {
        const cookieHeader = stepfunSessionManager.getCookieHeader()
        console.log('[StepFunStudio][ADAPTER] session manager offers credentials, tokenLen=', smToken.length,
          'cookieHeaderLen=', cookieHeader.length)
        this.updateToken(smToken, smWebId, { Cookie: cookieHeader })
      } else {
        console.log('[StepFunStudio][ADAPTER] session manager has empty/stale credentials, keeping user-configured token')
      }
    }
    console.log('[StepFunStudio][ADAPTER] adapter init FINAL tokenDeviceId=',
      this.readDeviceIdFromToken(this.oasisToken).slice(0, 20) || 'none',
      'webId=', this.webId.slice(0, 20),
      'cookieSource=', this.sessionCookieHeader ? 'session-manager' : 'account-fallback')
  }

  private updateToken(token: string, webId: string, cookies: Record<string, string>): void {
    const tokenDeviceId = this.readDeviceIdFromToken(token)
    const accountWebId = this.account.credentials.web_id || this.account.credentials.webId || ''
    if (tokenDeviceId && webId && tokenDeviceId !== webId) {
      console.warn('[StepFunStudio][ADAPTER] session manager credentials inconsistent:',
        'token.device_id=', tokenDeviceId.slice(0, 20),
        'Oasis-Webid=', webId.slice(0, 20),
        '-> ignoring push')
      return
    }
    if (accountWebId && webId && accountWebId !== webId && tokenDeviceId && tokenDeviceId !== accountWebId) {
      console.warn('[StepFunStudio][ADAPTER] session manager belongs to a different account:',
        'account web_id=', accountWebId.slice(0, 20),
        'pushed web_id=', webId.slice(0, 20),
        '-> ignoring push')
      return
    }
    this.oasisToken = token
    if (webId) {
      this.webId = webId
    }
    if (cookies['Cookie']) {
      this.sessionCookieHeader = cookies['Cookie']
    }
    const { Cookie: _ignore, ...rest } = cookies
    this.allCookies = { ...this.allCookies, ...rest } as StoredCookies
    this.cachedAppId = null
    this.clearSessionCache()
    console.log('[StepFunStudio][ADAPTER] token updated from session manager, tokenLen=', token.length,
      'webIdLen=', webId.length, 'hasCookieHeader=', !!this.sessionCookieHeader,
      'cookieNames=', (this.sessionCookieHeader || '').split('; ').map(p => p.split('=')[0]).join(','))
  }

  private readDeviceIdFromToken(token: string): string {
    const payloads = extractTokenPayloads(token)
    for (const p of payloads) {
      if (p.deviceId) return p.deviceId
    }
    return ''
  }

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
    if (!this.oasisToken) throw new Error('StepFun Studio token not configured')
    if (this.isApiKeyMode) return this.oasisToken

    const tokenHash = this.oasisToken.slice(0, 40)
    const cached = new Map<string, { tokenHash: string; isValid: boolean; checkedAt: number }>()
    const tokenCache = cached as any
    const stored = tokenCache.get(tokenHash)
    if (stored && stored.isValid && Date.now() - stored.checkedAt < TOKEN_VALIDATION_TTL_MS) {
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

    if (activated === false) {
      console.error('[StepFunStudio][ACQUIRE-TOKEN] token has activated=false; session is not usable')
      const err: any = new Error(
        'StepFun Studio session is not activated. Log in at studio.stepfun.com in a normal browser tab, ' +
        'confirm the page loads your conversation list, then copy a fresh Oasis-Token.'
      )
      err.code = 'account_not_activated'
      throw err
    }

    if (hasValidPayload && expiresAt !== null) {
      const nowSec = Math.floor(Date.now() / 1000)
      if (expiresAt < nowSec) {
        console.error('[StepFunStudio][ACQUIRE-TOKEN] token EXPIRED at', expiresAt, 'now=', nowSec)
        const err: any = new Error('StepFun Studio token expired, please re-login at studio.stepfun.com to get a fresh Oasis-Token')
        err.code = 'token_expired'
        throw err
      }
    }

    const isValid = hasValidPayload || this.oasisToken.length > 0
    const tokenValidationCache = new Map<string, { tokenHash: string; isValid: boolean; checkedAt: number }>()
    ;(tokenValidationCache as any).set(tokenHash, { tokenHash, isValid, checkedAt: Date.now() })
    if (!isValid) throw new Error('StepFun Studio token format invalid')
    return this.oasisToken
  }

  private getCachedSession(key: string): SessionInfo | null {
    const cached = sessionCache.get(key)
    if (!cached) return null
    if (Date.now() - cached.createdAt > SESSION_TTL_MS) {
      sessionCache.delete(key)
      return null
    }
    if (cached.oasisId && cached.oasisId !== this.readOasisId()) {
      console.log('[StepFunStudio][SESSION] cached session belongs to another account, discarding')
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
    console.log('[StepFunStudio][API] deleteAllChats, deleted=', collected.length, 'ok=', ok)
    return ok
  }

  private buildHeaders(): Record<string, string> {
    if (this.isApiKeyMode) {
      return {
        ...API_HEADERS,
        Authorization: 'Bearer ' + this.oasisToken,
      }
    }

    const headers: Record<string, string> = { ...WEB_HEADERS }

    let jwtAppId: string | null = this.cachedAppId
    if (!jwtAppId && this.oasisToken) {
      const payloads = extractTokenPayloads(this.oasisToken)
      for (const p of payloads) {
        if (p.appId) jwtAppId = p.appId
      }
      this.cachedAppId = jwtAppId
    }

    const appId = jwtAppId || this.provider.headers?.['Oasis-appID'] || '10200'

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

    const extraDid = tokenDeviceId || this.webId || null
    console.log('[StepFunStudio][ADAPTER] buildHeaders EXIT, mode=WEB, appId=', appId,
      'webId=', this.webId ? '[REDACTED]' : 'null',
      'oasisToken=', this.oasisToken ? '[REDACTED]' : 'null',
      'allCookieKeys=[' + Object.keys(this.allCookies).join(',') + ']',
      'jwtAppId=', jwtAppId || 'null')

    if (this.sessionCookieHeader) {
      headers['Cookie'] = this.sessionCookieHeader
      console.log('[StepFunStudio][ADAPTER] buildHeaders EXIT, mode=WEB, appId=', appId,
        'cookieSource=session-manager',
        'cookieLen=', headers['Cookie'].length,
        'cookies=', headers['Cookie'].split('; ').map(p => p.split('=')[0]).join(','))
      return headers
    }

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
    console.log('[StepFunStudio][ADAPTER] buildHeaders EXIT, mode=WEB, appId=', appId,
      'cookieSource=fallback',
      'cookieLen=', headers['Cookie'].length,
      'cookies=', cookiePairs.map(([n]) => n).join(','))
    return headers
  }

  private getEndpoint(): string {
    if (this.isApiKeyMode) {
      console.log('[StepFunStudio][ADAPTER] getEndpoint EXIT, mode=API_KEY, endpoint=step_plan')
      return STEP_PLAN_ENDPOINT
    }
    console.log('[StepFunStudio][ADAPTER] getEndpoint EXIT, mode=WEB')
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
      'Step-1': 'step-1-128k',
      'Step-2': 'step-2-16k',
      'Step-1-128k': 'step-1-128k',
      'Step-1-32k': 'step-1-32k',
      'Step-1-8k': 'step-1-8k',
      'Step-2-16k': 'step-2-16k',
    }
    if (directMappings[model]) return directMappings[model]
    const modelLower = model.toLowerCase()
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
    return model
  }

  async chatCompletion(request: ChatCompletionRequest, sessionId?: string): Promise<{ success: boolean; status?: number; stream?: Readable; body?: any; headers?: Record<string, string>; error?: string }> {
    if (!this.isApiKeyMode) {
      await this.acquireToken()
      return this.chatCompletionConnect(request, sessionId)
    }
    return this.chatCompletionStepPlan(request)
  }

  private async chatCompletionStepPlan(request: ChatCompletionRequest, retryCount = 0): Promise<{ success: boolean; status?: number; stream?: Readable; body?: any; headers?: Record<string, string>; error?: string }> {
    const requestData = this.buildStepPlanRequest(request)
    const headers = this.buildHeaders()
    const endpoint = this.getEndpoint()

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
      let buffer = Buffer.alloc(0)

      request_.on('response', (response) => {
        responseReceived = true
        const statusCode = response.statusCode
        const responseHeaders: Record<string, string> = {}
        Object.entries(response.headers || {}).forEach(([k, v]) => {
          responseHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v)
        })

        if (statusCode && statusCode >= 400) {
          response.on('data', (chunk: Buffer) => {
            serverError = (serverError || '') + chunk.toString()
          })
          response.on('end', () => {
            console.error('[StepFunStudio][STEP-PLAN] error status=', statusCode, 'body=', serverError?.slice(0, 500))
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
                const content = delta.reasoning || delta.reasoning_content || delta.content || parsed.choices?.[0]?.text || ''
                if (content) {
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
          buffer = Buffer.from(lines[lines.length - 1] || '', 'utf-8')
        })

        response.on('end', () => {
          stream.end()
        })

        response.on('error', (error) => {
          console.error('[StepFunStudio][STEP-PLAN] Response error:', error)
          stream.destroy()
        })

        resolve({
          success: true,
          status: statusCode || 200,
          stream,
          headers: responseHeaders,
          error: serverError,
        })
      })

      request_.on('error', (error) => {
        console.error('[StepFunStudio][STEP-PLAN] Request error:', error)
        stream.destroy()
        const msg = error.message || String(error)
        if ((msg.includes('ERR_SSL') || msg.includes('SSL') || msg.includes('net_error')) && retryCount < 2) {
          console.log('[StepFunStudio][STEP-PLAN] SSL error, retrying...')
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
        console.error('[StepFunStudio][STEP-PLAN] Request timed out after 120s')
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
        console.log('[StepFunStudio][STEP-PLAN] request sent')
      } catch (writeError) {
        clearTimeout(requestTimeout)
        console.error('[StepFunStudio][STEP-PLAN] write/end failed:', writeError)
        resolve({
          success: false,
          error: 'Failed to write request: ' + (writeError instanceof Error ? writeError.message : String(writeError)),
        })
      }
    })
  }

  private async chatCompletionStandardApi(request: ChatCompletionRequest): Promise<{ success: boolean; status?: number; stream?: Readable; body?: any; headers?: Record<string, string>; error?: string }> {
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

        if (statusCode && statusCode >= 400) {
          response.on('data', (chunk: Buffer) => {
            serverError = (serverError || '') + chunk.toString()
          })
          response.on('end', () => {
            console.log('[StepFunStudio][STD-API] error response body=', serverError?.slice(0, 500))
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
          console.error('[StepFunStudio][STD-API] Response error:', error)
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
        console.error('[StepFunStudio][STD-API] Request error:', error)
        stream.destroy()
        resolve({
          success: false,
          error: this.formatNetworkError(error),
        })
      })

      const requestTimeout = setTimeout(() => {
        console.error('[StepFunStudio][STD-API] Request timed out after 120s')
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
        console.log('[StepFunStudio][STD-API] request sent')
      } catch (writeError) {
        clearTimeout(requestTimeout)
        console.error('[StepFunStudio][STD-API] write/end failed:', writeError)
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
    await this.acquireToken()

    const headers = this.buildHeaders()
    const appId = headers['oasis-appid'] || '10200'
    const model = this.mapModel(request.model)

    const sessionKey = sessionId || this.account.id
    this.currentSessionKey = sessionKey
    const cachedSession = !this.isApiKeyMode ? this.getCachedSession(sessionKey) : null
    let useChatSessionId: string | null = cachedSession?.chatSessionId || this.chatSessionId

    const hadSessionBeforeRequest = !!useChatSessionId

    if (useChatSessionId && !(await this.chatSessionExists(useChatSessionId, headers))) {
      useChatSessionId = null
      this.chatSessionId = null
      sessionCache.delete(sessionKey)
    }

    if (!useChatSessionId) {
      const created = await this.createChatSession(headers)
      if (created) {
        useChatSessionId = created
      }
    }

    const userContent = request.messages
      .map((msg) => {
        if (msg.role === 'system') return ''
        const content = msg.content == null ? '' : msg.content
        return content
      })
      .filter(Boolean)
      .join('\n') || ''

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

    const requestData = {
      message: messageBody,
      config: {
        model,
        enableReasoning: request.reasoning_effort !== 'low' && request.reasoning_effort !== 'none',
        enableSearch: false
      }
    }

    const requestBody = Buffer.from(JSON.stringify(requestData), 'utf-8')
    const connectFrame = Buffer.alloc(5 + requestBody.length)
    connectFrame[0] = 0x00
    connectFrame.writeUInt32BE(requestBody.length, 1)
    requestBody.copy(connectFrame, 5)

    const connectHeaders = { ...headers }
    connectHeaders['content-type'] = 'application/connect+json'
    connectHeaders['connect-protocol-version'] = '1'
    connectHeaders['Referer'] = hadSessionBeforeRequest
      ? `https://studio.stepfun.com/chats/${useChatSessionId}`
      : 'https://studio.stepfun.com/chats/new'

    const request_ = net.request({
      method: 'POST',
      url: WEB_PROXY_ENDPOINT,
    })

    for (const [key, value] of Object.entries(connectHeaders)) {
      request_.setHeader(key, value)
    }

    const stream = new PassThrough()
    let currentMessageId = ''

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

        if (statusCode && statusCode >= 400) {
          response.on('data', (chunk: Buffer) => {
            serverError = (serverError || '') + chunk.toString()
          })
          response.on('end', () => {
            console.error('[StepFunStudio][CONNECT] error status=', statusCode, 'body=', serverError?.slice(0, 500))
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
          const messageIdState = { current: currentMessageId }
          let consumed = this.processConnectFrames(buffer, stream, model, messageIdState)
          currentMessageId = messageIdState.current
          if (consumed === 0 && buffer.length > 0) {
            consumed = this.parseConnectSSEText(buffer, stream, model, messageIdState)
            currentMessageId = messageIdState.current
          }
          buffer = buffer.slice(consumed)
        })

        response.on('end', () => {
          if (buffer.length > 0) {
            const messageIdState = { current: currentMessageId }
            this.parseConnectSSEText(buffer, stream, model, messageIdState)
            currentMessageId = messageIdState.current
          }
          stream.push(null)
        })

        response.on('error', (error) => {
          console.error('[StepFunStudio][CONNECT] Response error:', error)
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
        console.error('[StepFunStudio][CONNECT] Request error:', error)
        stream.destroy()
        resolve({
          success: false,
          error: this.formatNetworkError(error),
        })
      })

      const requestTimeout = setTimeout(() => {
        console.error('[StepFunStudio][CONNECT] Request timed out after 120s')
        ;(request_ as any).destroy()
        resolve({
          success: false,
          error: 'Request timed out. Please check your network and try again.',
        })
      }, 120000)

      request_.on('response', () => clearTimeout(requestTimeout))
      request_.on('error', () => clearTimeout(requestTimeout))

      try {
        request_.write(connectFrame, 'utf-8')
        request_.end()
        console.log('[StepFunStudio][CONNECT] request sent, model=', model, 'frameSize=', connectFrame.length)
      } catch (writeError) {
        clearTimeout(requestTimeout)
        console.error('[StepFunStudio][CONNECT] write/end failed:', writeError)
        resolve({
          success: false,
          error: 'Failed to write request: ' + (writeError instanceof Error ? writeError.message : String(writeError)),
        })
      }
    })
  }

  // --- Connect protocol helpers ---

  // 同步实现：函数体内无任何 await，调用方（response.on('data') 回调，
  // 非 async 上下文）按同步返回值使用 consumed。标成 async 会返回
  // Promise<number>，导致 `consumed === 0` 恒假、`buffer.slice(consumed)`
  // 拿到空 buffer —— 帧永远不会被消费掉（TS2367/TS2322/TS2345 三连报错即此）。
  private processConnectFrames(
    buffer: Buffer,
    stream: PassThrough,
    model: string,
    messageIdState: { current: string },
  ): number {
    let consumed = 0

    while (consumed + 5 <= buffer.length) {
      const flag = buffer[consumed]
      if (flag !== 0x00) break
      const frameLen = buffer.readUInt32BE(consumed + 1)
      if (consumed + 5 + frameLen > buffer.length) break
      const frameData = buffer.slice(consumed + 5, consumed + 5 + frameLen)
      consumed += 5 + frameLen

      try {
        const json = JSON.parse(frameData.toString('utf-8'))
        this.processConnectJson(json, stream, model, messageIdState)
      } catch {
        // skip unparseable frame
      }
    }

    return consumed
  }

  private parseConnectSSEText(
    buffer: Buffer,
    stream: PassThrough,
    model: string,
    messageIdState: { current: string },
  ): number {
    const text = buffer.toString('utf-8')
    const lines = text.split('\n')
    let consumed = 0

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      consumed += line.length + 1
      try {
        const json = JSON.parse(data)
        this.processConnectJson(json, stream, model, messageIdState)
      } catch {
        // skip
      }
    }

    return consumed
  }

  private processConnectJson(
    json: any,
    stream: PassThrough,
    model: string,
    messageIdState: { current: string },
  ): void {
    // Handle auth/permission errors
    if (json.code && json.message) {
      const errCode = String(json.code)
      const errMsg = String(json.message)
      if (errCode === 'permission_denied' || errCode === 'CODE_ACCOUNT_NEED_SIGN_IN' || errCode === 'UNAUTHENTICATED' || errCode === 'UNAUTHORIZED') {
        console.error('[StepFunStudio][CONNECT] auth error:', errCode, errMsg)
        if (!this.isApiKeyMode && stepfunSessionManager.ready()) {
          console.log('[StepFunStudio][CONNECT] token expired/unauth, forcing session refresh & clearing validation cache')
          if (stepfunSessionManager.ready()) {
            stepfunSessionManager.refresh()
              .then(() => {
                const fresh = stepfunSessionManager.getToken()
                const freshWebId = stepfunSessionManager.getWebId()
                if (fresh && fresh.length > 10 && fresh !== this.oasisToken) {
                  this.updateToken(fresh, freshWebId, { Cookie: stepfunSessionManager.getCookieHeader() })
                }
              })
              .catch((e) => console.error('[StepFunStudio][CONNECT] token refresh failed:', e))
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
    }

    if (!json.data || !json.data.event) return

    const event = json.data.event

    if (event.startEvent) {
      const messageId = event.startEvent.messageId || ''
      messageIdState.current = messageId
      return
    }

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
      return
    }

    if (event.textEvent) {
      const rawText = event.textEvent.text || ''
      if (rawText && messageIdState.current) {
        const deltaChunk = {
          id: messageIdState.current,
          model,
          object: 'chat.completion.chunk',
          choices: [{
            index: 0,
            delta: { role: 'assistant', content: rawText },
            finish_reason: null,
          }],
          created: Math.floor(Date.now() / 1000),
        }
        stream.write('data: ' + JSON.stringify(deltaChunk) + '\n\n')
      }
      return
    }

    if (event.reasoningEvent) {
      const text = event.reasoningEvent.text || ''
      if (text && messageIdState.current) {
        const deltaChunk = {
          id: messageIdState.current,
          model,
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

    if (event.doneEvent) {
      const finishChunk = {
        id: messageIdState.current,
        model,
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

    if (event.finishEvent) {
      const messageId = event.finishEvent.messageId || messageIdState.current
      const reason = event.finishEvent.finishReason || 'stop'
      const finishChunk = {
        id: messageId,
        model,
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

    if (event.errorEvent) {
      const errorMsg = event.errorEvent.message || '未知错误'
      console.error('[StepFunStudio][CONNECT] errorEvent:', errorMsg)
      const errorChunk = {
        id: messageIdState.current || '',
        model,
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

  // --- Chat session management ---

  private async createChatSession(
    headers: Record<string, string>,
    options: { type?: string; scene?: string; studioId?: string } = {},
  ): Promise<string | null> {
    const body: any = {}
    if (options.type) body.type = options.type
    if (options.scene) body.scene = options.scene
    if (options.studioId) body.studioId = options.studioId

    return new Promise((resolve) => {
      const request_ = net.request({
        method: 'POST',
        url: 'https://studio.stepfun.com/api/agent/capy.agent.v1.AgentService/CreateChatSession',
      })

      for (const [key, value] of Object.entries(headers)) {
        request_.setHeader(key, value)
      }
      request_.setHeader('content-type', 'application/json')
      request_.setHeader('Referer', 'https://studio.stepfun.com/chats/new')

      request_.on('response', (response) => {
        const statusCode = response.statusCode
        let bodyStr = ''
        response.on('data', (chunk: Buffer) => {
          bodyStr += chunk.toString()
        })
        response.on('end', () => {
          if (statusCode && statusCode >= 400) {
            console.error('[StepFunStudio][SESSION] CreateChatSession error status=', statusCode, 'body=', bodyStr.slice(0, 500))
            resolve(null)
            return
          }
          try {
            const json = JSON.parse(bodyStr)
            const sessionId = json?.data?.chatSessionId || json?.data?.sessionId || null
            const chatId = json?.data?.chatId || null
            if (sessionId) {
              this.setCachedSession(this.currentSessionKey || this.account.id, {
                chatSessionId: sessionId,
                chatId: chatId || '',
                createdAt: Date.now(),
              })
            }
            resolve(sessionId)
          } catch {
            resolve(null)
          }
        })
      })

      request_.on('error', (error) => {
        console.error('[StepFunStudio][SESSION] CreateChatSession request error:', error)
        resolve(null)
      })

      const requestTimeout = setTimeout(() => {
        console.error('[StepFunStudio][SESSION] CreateChatSession timed out')
        ;(request_ as any).destroy()
        resolve(null)
      }, 30000)

      request_.on('response', () => clearTimeout(requestTimeout))

      try {
        request_.write(JSON.stringify(body), 'utf-8')
        request_.end()
      } catch {
        clearTimeout(requestTimeout)
        resolve(null)
      }
    })
  }

  private async chatSessionExists(sessionId: string, headers: Record<string, string>): Promise<boolean> {
    return new Promise((resolve) => {
      const request_ = net.request({
        method: 'POST',
        url: 'https://studio.stepfun.com/api/agent/capy.agent.v1.AgentService/GetChatSession',
      })

      for (const [key, value] of Object.entries(headers)) {
        request_.setHeader(key, value)
      }
      request_.setHeader('content-type', 'application/json')
      request_.setHeader('Referer', 'https://studio.stepfun.com/chats/new')

      const body = JSON.stringify({ chatSessionId: sessionId })
      const requestTimeout = setTimeout(() => {
        ;(request_ as any).destroy()
        resolve(false)
      }, 15000)

      request_.on('response', (response) => {
        clearTimeout(requestTimeout)
        const statusCode = response.statusCode
        if (statusCode && statusCode >= 400) {
          resolve(false)
          return
        }
        let bodyStr = ''
        response.on('data', (chunk: Buffer) => {
          bodyStr += chunk.toString()
        })
        response.on('end', () => {
          try {
            const json = JSON.parse(bodyStr)
            resolve(!!json?.data?.chatSessionId)
          } catch {
            resolve(false)
          }
        })
      })

      request_.on('error', () => {
        clearTimeout(requestTimeout)
        resolve(false)
      })

      try {
        request_.write(body, 'utf-8')
        request_.end()
      } catch {
        clearTimeout(requestTimeout)
        resolve(false)
      }
    })
  }

  private async listChatSessions(opts: { pageSize: number; pageToken?: string }): Promise<{ sessions: any[]; nextPageToken?: string }> {
    return new Promise((resolve) => {
      const headers = this.buildHeaders()
      const request_ = net.request({
        method: 'POST',
        url: 'https://studio.stepfun.com/api/agent/capy.agent.v1.AgentService/ListChatSessions',
      })

      for (const [key, value] of Object.entries(headers)) {
        request_.setHeader(key, value)
      }
      request_.setHeader('content-type', 'application/json')
      request_.setHeader('Referer', 'https://studio.stepfun.com/chats/new')

      const body = JSON.stringify(opts)
      const requestTimeout = setTimeout(() => {
        ;(request_ as any).destroy()
        resolve({ sessions: [] })
      }, 30000)

      request_.on('response', (response) => {
        clearTimeout(requestTimeout)
        const statusCode = response.statusCode
        if (statusCode && statusCode >= 400) {
          resolve({ sessions: [] })
          return
        }
        let bodyStr = ''
        response.on('data', (chunk: Buffer) => {
          bodyStr += chunk.toString()
        })
        response.on('end', () => {
          try {
            const json = JSON.parse(bodyStr)
            resolve({
              sessions: json?.data?.sessions || [],
              nextPageToken: json?.data?.nextPageToken,
            })
          } catch {
            resolve({ sessions: [] })
          }
        })
      })

      request_.on('error', () => {
        clearTimeout(requestTimeout)
        resolve({ sessions: [] })
      })

      try {
        request_.write(body, 'utf-8')
        request_.end()
      } catch {
        clearTimeout(requestTimeout)
        resolve({ sessions: [] })
      }
    })
  }

  private async deleteChatSessions(sessionIds: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const headers = this.buildHeaders()
      const request_ = net.request({
        method: 'POST',
        url: 'https://studio.stepfun.com/api/agent/capy.agent.v1.AgentService/DeleteChatSessions',
      })

      for (const [key, value] of Object.entries(headers)) {
        request_.setHeader(key, value)
      }
      request_.setHeader('content-type', 'application/json')
      request_.setHeader('Referer', 'https://studio.stepfun.com/chats/new')

      const body = JSON.stringify({ chatSessionIds: sessionIds })
      const requestTimeout = setTimeout(() => {
        ;(request_ as any).destroy()
        resolve(false)
      }, 30000)

      request_.on('response', (response) => {
        clearTimeout(requestTimeout)
        const statusCode = response.statusCode
        // 必须显式布尔化：`statusCode && ...` 在 statusCode 为 0 时会把 0 本身
        // 交给 Promise<boolean>，类型与语义都不对。
        resolve(typeof statusCode === 'number' && statusCode < 400)
      })

      request_.on('error', () => {
        clearTimeout(requestTimeout)
        resolve(false)
      })

      try {
        request_.write(body, 'utf-8')
        request_.end()
      } catch {
        clearTimeout(requestTimeout)
        resolve(false)
      }
    })
  }

  // --- Static matcher ---

  static isStepFunStudioProvider(provider: Provider): boolean {
    return provider.id === 'stepfun-studio' || provider.apiEndpoint?.includes('studio.stepfun.com')
  }
}

export { StepFunStreamHandler } from './stepfun-stream'
