/**
 * StepFun Adapter
 * Implements StepFun (阶跃星辰) API key authentication
 */

import axios from 'axios'
import { shell } from 'electron'
import { BaseOAuthAdapter } from './base'
import { OAuthResult, OAuthOptions, TokenValidationResult, AdapterConfig } from '../types'

const STEPFUN_API_BASE = 'https://api.stepfun.com'
const STEPFUN_PLATFORM = 'https://platform.stepfun.com'

const STEPFUN_HEADERS = {
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

export class StepFunOAuthAdapter extends BaseOAuthAdapter {
  constructor(config: AdapterConfig) {
    super({
      ...config,
      providerType: 'stepfun',
      authMethods: ['manual', 'browser'],
      loginUrl: STEPFUN_PLATFORM,
      apiUrl: STEPFUN_API_BASE,
    })
  }

  /**
   * Start login flow - Open default browser to platform.stepfun.com
   */
  async startLogin(options: OAuthOptions): Promise<OAuthResult> {
    this.emitProgress('pending', 'Opening browser...')

    try {
      await shell.openExternal(STEPFUN_PLATFORM)
      this.emitProgress('pending', '请通过浏览器登录，Token 将自动从 localStorage 提取')

      return {
        success: false,
        providerId: options.providerId,
        providerType: 'stepfun',
        error: '请通过浏览器登录，Token 将自动从 localStorage 提取',
      }
    } catch (error) {
      console.error('[StepFun] startLogin error:', error)
      const errorMessage = error instanceof Error ? error.message : '打开浏览器失败'
      this.emitProgress('error', errorMessage)

      return {
        success: false,
        providerId: options.providerId,
        providerType: 'stepfun',
        error: errorMessage,
      }
    }
  }

  /**
   * Complete authentication with API key
   */
  async loginWithToken(providerId: string, token: string): Promise<OAuthResult> {
    this.emitProgress('pending', 'Validating API key...')

    try {
      const validation = await this.validateToken({ token })

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid API key',
        }
      }

      this.emitProgress('success', 'API key validated successfully')

      return {
        success: true,
        providerId,
        providerType: 'stepfun',
        credentials: { token },
      }
    } catch (error) {
      this.emitProgress('error', error instanceof Error ? error.message : '未知错误')
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      }
    }
  }

  /**
   * Validate token - supports both API key (sk-*) and session token (Oasis-Token)
   * Oasis-Token can be JWT or other formats; web API accepts it via Cookie header
   */
  async validateToken(credentials: Record<string, string>): Promise<TokenValidationResult> {
    // Extract token from various possible field names
    const token = credentials.token || credentials['Oasis-Token'] || credentials.oasisToken || credentials.web_id

    if (!token) {
      return {
        valid: false,
        error: '缺少 Token',
      }
    }

    // API key format (sk-*)
    if (token.startsWith('sk-')) {
      return this.validateApiKey(token)
    }

    // JWT session token format (eyJ...)
    if (token.startsWith('eyJ')) {
      return this.validateJwtToken(token, credentials)
    }

    // For web API mode: accept any non-empty token as valid session token
    // The token will be validated by the platform API when used
    // This handles Oasis-Token formats that are not JWTs
    console.log('[StepFun] Accepting non-JWT session token (web API mode)')
    return {
      valid: true,
    }
  }

  private async validateApiKey(token: string): Promise<TokenValidationResult> {
    try {
      const response = await axios.get(`${STEPFUN_API_BASE}/v1/models`, {
        headers: {
          ...STEPFUN_HEADERS,
          Authorization: `Bearer ${token}`,
        },
        timeout: 15000,
        validateStatus: () => true,
      })

      if (response.status === 200) {
        return {
          valid: true,
        }
      }

      if (response.status === 401) {
        return {
          valid: false,
          error: 'Invalid API key',
        }
      }

      return {
        valid: false,
        error: `HTTP ${response.status}: ${response.data?.error?.message || response.data?.message || '未知错误'}`,
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Network error',
      }
    }
  }

  private async validateJwtToken(token: string, allCredentials: Record<string, string>): Promise<TokenValidationResult> {
    try {
      // Decode JWT payload(s) to check expiration and extract account info.
      //
      // The Oasis-Token is TWO base64url JWTs joined by "...":
      //   <session JWT>...<device JWT>
      // The session part lives ~30 minutes, the device part ~30 days. The old
      // code used token.split('.') and only read a payload when that produced
      // exactly 3 parts — impossible for this format — so an expired token
      // passed "local validation" and the failure only showed up later as the
      // server's {"code":"unauthenticated","message":"token is expired"}.
      const segments = token.includes('...') ? token.split('...') : [token]
      let accountInfo
      const expiredSegments: string[] = []
      let activated: boolean | null = null

      for (const segment of segments) {
        const parts = segment.split('.')
        if (parts.length < 3) continue
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
          console.log('[StepFun] JWT payload:', JSON.stringify(payload).substring(0, 300))

          if (typeof payload.activated === 'boolean') activated = payload.activated

          if (typeof payload.exp === 'number' && payload.exp > 0) {
            const expTime = payload.exp * 1000
            if (Date.now() > expTime) {
              expiredSegments.push(new Date(expTime).toISOString())
              console.log('[StepFun] JWT segment expired at:', new Date(expTime).toISOString())
            } else {
              console.log('[StepFun] JWT segment valid until:', new Date(expTime).toISOString())
            }
          }

          if (!accountInfo) {
            accountInfo = {
              name: payload.name || payload.nickname || payload.username,
              email: payload.email,
            }
          }
        } catch {
          // Ignore JWT decode errors for this segment
        }
      }

      if (expiredSegments.length > 0) {
        return {
          valid: false,
          error: `Session token expired at ${expiredSegments.join(', ')}, please login again`,
        }
      }

      if (activated === false) {
        return {
          valid: false,
          error: 'StepFun session is not activated (token has activated=false), please finish the login',
        }
      }

      // Note: StepFun API (api.stepfun.com) only accepts sk-* API keys for authentication.
      // Session JWT tokens (Oasis-Token) are valid for the platform website but not for the API.
      // Since the token was obtained from a successful browser login, we accept it based on
      // structural validity and non-expiration. Users who need API access should use sk-* keys.
      console.log('[StepFun] JWT token accepted (local validation passed, API does not accept session cookies)')

      return {
        valid: true,
        accountInfo,
      }
    } catch (error) {
      console.log('[StepFun] Validation error:', error)
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Network error',
      }
    }
  }
}
