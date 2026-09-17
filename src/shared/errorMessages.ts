/**
 * src/shared/errorMessages.ts — 错误码/模式 → 多语言 key 映射
 */

export interface ErrorMapping {
  match: RegExp | string
  i18nKey: string
  fallback: string
}

/** HTTP 状态码 → 通用错误 */
export const HTTP_STATUS_ERRORS: Record<number, { i18nKey: string; fallback: string }> = {
  400: { i18nKey: 'error.httpBadRequest', fallback: 'Bad request' },
  401: { i18nKey: 'error.httpUnauthorized', fallback: 'Unauthorized' },
  403: { i18nKey: 'error.httpForbidden', fallback: 'Forbidden' },
  404: { i18nKey: 'error.httpNotFound', fallback: 'Not found' },
  429: { i18nKey: 'error.httpRateLimited', fallback: 'Rate limited' },
  500: { i18nKey: 'error.httpInternal', fallback: 'Internal server error' },
  502: { i18nKey: 'error.httpBadGateway', fallback: 'Bad gateway' },
  503: { i18nKey: 'error.httpUnavailable', fallback: 'Service unavailable' },
}

/** API/LLM 错误模式 */
export const API_ERROR_PATTERNS: ErrorMapping[] = [
  { match: /request\s+failed\s+with\s+status\s+code\s+(\d+)/i, i18nKey: 'error.apiRequestFailed', fallback: 'Request failed with status code {code}' },
  { match: /ssl.*handshake.*failed/i, i18nKey: 'error.sslHandshakeFailed', fallback: 'SSL handshake failed' },
  { match: /network\s+(error|timeout|unreachable)/i, i18nKey: 'error.networkError', fallback: 'Network error: {detail}' },
  { match: /timeout|timed?\s*out/i, i18nKey: 'error.requestTimeout', fallback: 'Request timed out' },
  { match: /connection\s+(refused|reset|closed)/i, i18nKey: 'error.connectionFailed', fallback: 'Connection {detail}' },
  { match: /ECONNREFUSED/i, i18nKey: 'error.connectionRefused', fallback: 'Connection refused' },
  { match: /ECONNRESET/i, i18nKey: 'error.connectionReset', fallback: 'Connection reset by peer' },
  { match: /ENOTFOUND/i, i18nKey: 'error.dnsNotFound', fallback: 'DNS resolution failed' },
  { match: /ETIMEDOUT/i, i18nKey: 'error.connectionTimeout', fallback: 'Connection timed out' },
  { match: /invalid\s+api\s*key|authentication\s+failed/i, i18nKey: 'error.invalidApiKey', fallback: 'Invalid API key or authentication failed' },
  { match: /model\s+not\s+found|model.*invalid/i, i18nKey: 'error.modelNotFound', fallback: 'Model not found or invalid' },
  { match: /context\s*length|token\s*limit|too\s*many\s*tokens/i, i18nKey: 'error.contextLength', fallback: 'Context length exceeded' },
  { match: /rate\s*limit|too\s*many\s*requests/i, i18nKey: 'error.rateLimited', fallback: 'Rate limit exceeded' },
  { match: /server\s*(error|overloaded)/i, i18nKey: 'error.serverError', fallback: 'Server error: {detail}' },
]

/**
 * 通用/系统错误模式。
 *
 * ⚠️ **两份模式表并存是刻意的**：英文模式匹配来自第三方 API 的原始错误，
 * 中文模式匹配本项目主进程自己产生的错误消息。
 *
 * 为什么中文模式必须有：本函数是「匹配不上就返回原文」的语义
 * （见 formatUserError / formatSystemError）。主进程的消息已按产品要求汉化，
 * 若这里只有英文模式，那么**英文界面下会直接显示中文原文** ——
 * 汉化本身反而让英文用户看到未翻译的内容。
 *
 * 顺序即优先级：**具体模式在前，笼统模式在后**。
 * 例如「请求超时」必须排在「请求失败」之前，否则前者会被后者吞掉。
 */
export const SYSTEM_ERROR_PATTERNS: ErrorMapping[] = [
  // ── 中文：具体语义（必须在前）──
  { match: /上下文长度|token\s*超限|超出.{0,4}长度/i, i18nKey: 'error.contextLength', fallback: 'Context length exceeded' },
  { match: /已过期|过期或无效|无效或已过期/i, i18nKey: 'error.invalidApiKey', fallback: 'Invalid API key or authentication failed' },
  { match: /Token\s*(无效|不存在|不能为空|缺少)|缺少\s*Token|凭证|未配置.{0,6}(凭证|Token)/i, i18nKey: 'error.invalidApiKey', fallback: 'Invalid API key or authentication failed' },
  { match: /限流|过于频繁|频率超限|请求过多/i, i18nKey: 'error.rateLimited', fallback: 'Rate limit exceeded' },
  { match: /超时|timed?\s*out/i, i18nKey: 'error.requestTimeout', fallback: 'Request timed out' },
  { match: /不存在|未找到/i, i18nKey: 'error.notFound', fallback: 'Not found' },
  { match: /内存不足/i, i18nKey: 'error.outOfMemory', fallback: 'Out of memory' },
  { match: /权限不足|拒绝访问|无权限/i, i18nKey: 'error.permissionDenied', fallback: 'Permission denied' },
  { match: /已取消|已中止|中断/i, i18nKey: 'error.requestCancelled', fallback: 'Request cancelled' },
  { match: /网络(错误|未连接|异常)/i, i18nKey: 'error.networkError', fallback: 'Network error: {detail}' },
  { match: /连接(被拒绝|被重置|超时)/i, i18nKey: 'error.connectionFailed', fallback: 'Connection {detail}' },
  { match: /SSL\s*握手失败/i, i18nKey: 'error.sslHandshakeFailed', fallback: 'SSL handshake failed' },
  // ── 中文：泛化失败（兜底，放在最后）──
  { match: /发送失败/i, i18nKey: 'error.sendFailed', fallback: 'Send failed' },
  { match: /请求失败/i, i18nKey: 'error.requestFailed', fallback: 'Request failed' },
  { match: /命令执行失败/i, i18nKey: 'error.commandFailed', fallback: 'Command execution failed' },
  { match: /无法调用\s*LLM|无法调用\s*AI/i, i18nKey: 'error.llmUnavailable', fallback: 'LLM service unavailable' },
  // ── 英文：第三方 API 原文 ──
  { match: /abort|cancelled|canceled/i, i18nKey: 'error.requestCancelled', fallback: 'Request cancelled' },
  { match: /permission\s+denied|EACCES/i, i18nKey: 'error.permissionDenied', fallback: 'Permission denied' },
  { match: /not\s+found|ENOENT/i, i18nKey: 'error.notFound', fallback: 'Not found' },
  { match: /out\s+of\s+memory|OOM/i, i18nKey: 'error.outOfMemory', fallback: 'Out of memory' },
]

/**
 * 完整模式表：先 API（第三方原文），再系统（本项目消息）。
 *
 * 顺序有意义 —— API 模式更具体（带状态码、SSL、DNS 等），
 * 系统模式里有「请求失败」这类宽泛兜底，放前面会误吞具体错误。
 */
export const ALL_ERROR_PATTERNS: ErrorMapping[] = [
  ...API_ERROR_PATTERNS,
  ...SYSTEM_ERROR_PATTERNS,
]

export function matchErrorPattern(
  msg: string,
  patterns: ErrorMapping[] = ALL_ERROR_PATTERNS
): { i18nKey: string; fallback: string; params?: Record<string, string> } | null {
  if (!msg) return null
  for (const entry of patterns) {
    const regex = entry.match instanceof RegExp ? entry.match : new RegExp(entry.match as string, 'i')
    const m = msg.match(regex)
    if (m) {
      const params: Record<string, string> = {}
      const codeMatch = msg.match(/(\d{3})/)
      if (codeMatch && regex.source.includes('code')) params.code = codeMatch[1]
      if (m[1]) params.detail = m[1]
      return { i18nKey: entry.i18nKey, fallback: entry.fallback, params }
    }
  }
  return null
}

/** 纯 JS 翻译表（供 main process 等无 i18next 环境使用） */
const TRANSLATIONS: Record<string, Record<string, string>> = {
  'error.httpBadRequest': { 'zh-CN': '请求参数错误', 'en-US': 'Bad request' },
  'error.httpUnauthorized': { 'zh-CN': '未授权，请检查 API Key', 'en-US': 'Unauthorized' },
  'error.httpForbidden': { 'zh-CN': '访问被拒绝', 'en-US': 'Forbidden' },
  'error.httpNotFound': { 'zh-CN': '资源未找到', 'en-US': 'Not found' },
  'error.httpRateLimited': { 'zh-CN': '请求过于频繁，请稍后重试', 'en-US': 'Rate limited' },
  'error.httpInternal': { 'zh-CN': '服务器内部错误', 'en-US': 'Internal server error' },
  'error.httpBadGateway': { 'zh-CN': '网关错误', 'en-US': 'Bad gateway' },
  'error.httpUnavailable': { 'zh-CN': '服务暂时不可用', 'en-US': 'Service temporarily unavailable' },
  'error.apiRequestFailed': { 'zh-CN': 'API 请求失败 (状态码 {code})', 'en-US': 'API request failed (status {code})' },
  'error.sslHandshakeFailed': { 'zh-CN': 'SSL 握手失败', 'en-US': 'SSL handshake failed' },
  'error.networkError': { 'zh-CN': '网络错误: {detail}', 'en-US': 'Network error: {detail}' },
  'error.requestTimeout': { 'zh-CN': '请求超时', 'en-US': 'Request timed out' },
  'error.connectionFailed': { 'zh-CN': '连接{detail}', 'en-US': 'Connection {detail}' },
  'error.connectionRefused': { 'zh-CN': '连接被拒绝', 'en-US': 'Connection refused' },
  'error.connectionReset': { 'zh-CN': '连接被对端重置', 'en-US': 'Connection reset by peer' },
  'error.dnsNotFound': { 'zh-CN': 'DNS 解析失败，请检查网络', 'en-US': 'DNS resolution failed, please check your network' },
  'error.connectionTimeout': { 'zh-CN': '连接超时，请检查网络', 'en-US': 'Connection timed out, please check your network' },
  'error.invalidApiKey': { 'zh-CN': 'API Key 无效或认证失败', 'en-US': 'Invalid API key or authentication failed' },
  'error.modelNotFound': { 'zh-CN': '模型未找到或无效', 'en-US': 'Model not found or invalid' },
  'error.contextLength': { 'zh-CN': '上下文长度超出限制', 'en-US': 'Context length exceeded' },
  'error.rateLimited': { 'zh-CN': '请求频率超限，请稍后重试', 'en-US': 'Rate limit exceeded, please try again later' },
  'error.serverError': { 'zh-CN': '服务器错误: {detail}', 'en-US': 'Server error: {detail}' },
  'error.sendFailed': { 'zh-CN': '发送失败', 'en-US': 'Send failed' },
  'error.requestFailed': { 'zh-CN': '请求失败', 'en-US': 'Request failed' },
  'error.commandFailed': { 'zh-CN': '命令执行失败', 'en-US': 'Command execution failed' },
  'error.llmUnavailable': { 'zh-CN': 'AI 服务不可用', 'en-US': 'AI service unavailable' },
  'error.requestCancelled': { 'zh-CN': '请求已取消', 'en-US': 'Request cancelled' },
  'error.permissionDenied': { 'zh-CN': '权限不足', 'en-US': 'Permission denied' },
  'error.notFound': { 'zh-CN': '未找到', 'en-US': 'Not found' },
  'error.outOfMemory': { 'zh-CN': '内存不足', 'en-US': 'Out of memory' },
  'error.pageLoadFailed': { 'zh-CN': '页面加载失败: {url}', 'en-US': 'Page load failed: {url}' },
  'error.unknownError': { 'zh-CN': '未知错误', 'en-US': 'Unknown error' },
}

export function getErrorTranslation(
  i18nKey: string,
  _fallback: string,
  lang: string,
  params?: Record<string, string>
): string {
  const entry = TRANSLATIONS[i18nKey]
  if (!entry) return _fallback
  let text = entry[lang] || entry['en-US'] || _fallback
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v)
    }
  }
  return text
}
