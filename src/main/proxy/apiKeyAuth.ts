/**
 * src/main/proxy/apiKeyAuth.ts — 代理服务「入站」API Key 认证判定
 *
 * 从 server.ts 的中间件里抽出来的纯函数，方便单测覆盖边界情况。
 * 规则（与界面上的说明保持一致）：
 * 1. 开关关闭（enableApiKey=false）→ 一律放行；
 * 2. 请求来自本机（127.0.0.1 / ::1 / ::ffff:127.0.0.1）→ 一律放行，
 *    这样 Electron 应用自身和本机测试永远不需要带 Key；
 * 3. 开关开启 + 没建任何 Key → 拒绝（不允许静默放行，否则界面显示"已启用"
 *    而外部请求全通）；
 * 4. 其余情况要求 Authorization: Bearer <key> / X-API-Key / ?api_key=<key>，
 *    且该 Key 必须存在于列表且处于启用状态。
 */

export interface ApiKeyRecord {
  id: string
  key: string
  enabled: boolean
}

export interface ApiKeyAuthInput {
  /** 认证开关（配置项 enableApiKey） */
  enableApiKey: boolean
  /** 已配置的 Key 列表 */
  apiKeys: ApiKeyRecord[]
  /** 客户端 IP（koa ctx.ip） */
  clientIP: string
  /** Authorization 头原始值，例如 "Bearer sk-xxx" */
  authHeader: string
  /** X-API-Key 头 */
  headerApiKey?: string
  /** ?api_key= 查询参数 */
  queryApiKey?: string
}

export type ApiKeyAuthDecision =
  | { action: 'allow' }
  /** 校验通过，调用方应更新该 Key 的使用统计 */
  | { action: 'accept'; keyId: string }
  | { action: 'reject'; status: number; code: string; message: string }

/** 判断客户端是否来自本机 */
export function isLocalClient(clientIP: string | undefined | null): boolean {
  const ip = clientIP || ''
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('127.')
  )
}

/** 从三种可接受的位置取出客户端提供的 Key */
export function extractProvidedKey(input: Pick<ApiKeyAuthInput, 'authHeader' | 'headerApiKey' | 'queryApiKey'>): string {
  const authHeader = input.authHeader || ''
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7)
  return input.queryApiKey || input.headerApiKey || ''
}

export function checkApiKeyAuth(input: ApiKeyAuthInput): ApiKeyAuthDecision {
  if (!input.enableApiKey) return { action: 'allow' }
  if (isLocalClient(input.clientIP)) return { action: 'allow' }

  const configuredKeys = input.apiKeys || []
  if (configuredKeys.length === 0) {
    return {
      action: 'reject',
      status: 401,
      code: 'no_api_key_configured',
      message: 'API key authentication is enabled but no API key has been created yet',
    }
  }

  const providedKey = extractProvidedKey(input)
  if (!providedKey) {
    return {
      action: 'reject',
      status: 401,
      code: 'missing_api_key',
      message: 'API key is required',
    }
  }

  const validKey = configuredKeys.find(k => k.key === providedKey && k.enabled)
  if (!validKey) {
    return {
      action: 'reject',
      status: 401,
      code: 'invalid_api_key',
      message: 'Invalid API key',
    }
  }

  return { action: 'accept', keyId: validKey.id }
}
