/**
 * src/shared/formatError.ts — 错误消息翻译工具
 *
 * Renderer 端使用 i18next，Main process 端使用纯 JS 翻译表
 */

import { matchErrorPattern, getErrorTranslation, HTTP_STATUS_ERRORS, API_ERROR_PATTERNS } from './errorMessages'

// ==================== Renderer 端（使用 i18next） ====================

/** 翻译用户可见的错误消息 */
export function formatUserError(rawMsg: string): string {
  if (!rawMsg) return ''
  const m = matchErrorPattern(rawMsg, API_ERROR_PATTERNS)
  if (m) return translateI18nKey(m.i18nKey, m.fallback, m.params)
  return rawMsg
}

/** 翻译 HTTP 状态码对应的错误 */
export function formatHttpError(statusCode: number, body?: string): string {
  const entry = HTTP_STATUS_ERRORS[statusCode]
  if (!entry) return body || `HTTP ${statusCode}`
  const params = body ? { detail: body.slice(0, 100), code: String(statusCode) } : { code: String(statusCode) }
  return translateI18nKey(entry.i18nKey, entry.fallback, params as Record<string, string>)
}

// ==================== Main process 端（纯 JS，接受 lang 参数） ====================

/** 翻译错误消息（纯 JS，不依赖 i18next）
 * @param rawMsg - 原始错误消息
 * @param lang - 语言代码，如 'zh-CN' 或 'en-US'，不传则返回原文
 */
export function formatSystemError(rawMsg: string, lang?: string): string {
  if (!rawMsg || !lang) return rawMsg
  const m = matchErrorPattern(rawMsg, API_ERROR_PATTERNS)
  if (m) return getErrorTranslation(m.i18nKey, m.fallback, lang, m.params)
  return rawMsg
}

/** 翻译 HTTP 状态码对应的错误（纯 JS）
 * @param statusCode - HTTP 状态码
 * @param body - 响应体（用于提取详情）
 * @param lang - 语言代码
 */
export function formatSystemHttpError(statusCode: number, body?: string, lang?: string): string {
  if (!lang) return body || `HTTP ${statusCode}`
  const entry = HTTP_STATUS_ERRORS[statusCode]
  if (!entry) return body || `HTTP ${statusCode}`
  const params = body ? { detail: body.slice(0, 100), code: String(statusCode) } : { code: String(statusCode) }
  return getErrorTranslation(entry.i18nKey, entry.fallback, lang, params as Record<string, string>)
}

// ==================== 内部辅助 ====================

function translateI18nKey(i18nKey: string, fallback: string, params?: Record<string, string>): string {
  try {
    const i18n = require('@/i18n').default
    if (i18n?.exists?.(i18nKey)) {
      const text = i18n.t(i18nKey, params)
      if (text && text !== i18nKey) return text
    }
  } catch {
    // i18n not available (main process)
  }
  try {
    const { useSettingsStore } = require('@/stores/settingsStore')
    const lang = useSettingsStore?.getState?.()?.language || 'en-US'
    return getErrorTranslation(i18nKey, fallback, lang, params)
  } catch {
    return fallback
  }
}
