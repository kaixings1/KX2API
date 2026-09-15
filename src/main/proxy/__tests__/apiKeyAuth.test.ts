/**
 * 代理服务入站 API Key 认证判定单测
 *
 * 覆盖：
 * - 开关关闭时一律放行
 * - 本机请求（127.0.0.1 / ::1 / ::ffff:127.0.0.1 / 127.x）免验证
 * - 开关开启但列表为空 → 拒绝（回归：以前会静默放行，界面显示已启用却全通）
 * - 缺少 / 错误 / 已禁用的 Key → 401，且带正确的错误码
 * - Bearer / X-API-Key / ?api_key= 三种取值方式
 */

import { describe, it, expect } from 'vitest'
import { checkApiKeyAuth, extractProvidedKey, isLocalClient, type ApiKeyRecord } from '../apiKeyAuth'

const KEY: ApiKeyRecord = { id: 'k1', key: 'sk-live', enabled: true }
const DISABLED: ApiKeyRecord = { id: 'k2', key: 'sk-off', enabled: false }

const base = {
  enableApiKey: true,
  apiKeys: [KEY, DISABLED],
  clientIP: '203.0.113.9',
  authHeader: 'Bearer sk-live',
}

describe('isLocalClient', () => {
  it('识别本机地址', () => {
    expect(isLocalClient('127.0.0.1')).toBe(true)
    expect(isLocalClient('127.0.0.5')).toBe(true)
    expect(isLocalClient('::1')).toBe(true)
    expect(isLocalClient('::ffff:127.0.0.1')).toBe(true)
  })

  it('局域网 / 公网地址不算本机', () => {
    expect(isLocalClient('192.168.1.20')).toBe(false)
    expect(isLocalClient('203.0.113.9')).toBe(false)
    expect(isLocalClient('')).toBe(false)
  })
})

describe('extractProvidedKey', () => {
  it('三种取值方式都能取到', () => {
    expect(extractProvidedKey({ authHeader: 'Bearer sk-a' })).toBe('sk-a')
    expect(extractProvidedKey({ authHeader: '', headerApiKey: 'sk-b' })).toBe('sk-b')
    expect(extractProvidedKey({ authHeader: '', queryApiKey: 'sk-c' })).toBe('sk-c')
  })

  it('Authorization 不是 Bearer 形式时视为没带 Key', () => {
    expect(extractProvidedKey({ authHeader: 'Basic abc' })).toBe('')
  })
})

describe('checkApiKeyAuth', () => {
  it('开关关闭 → 放行（即使没有 Key）', () => {
    expect(checkApiKeyAuth({ ...base, enableApiKey: false, apiKeys: [], authHeader: '' })).toEqual({ action: 'allow' })
  })

  it('本机请求 → 放行（Electron 应用自身永远不用带 Key）', () => {
    expect(checkApiKeyAuth({ ...base, clientIP: '127.0.0.1', authHeader: '' })).toEqual({ action: 'allow' })
  })

  it('开关开启但没有任何 Key → 拒绝（不再 fail-open）', () => {
    const decision = checkApiKeyAuth({ ...base, apiKeys: [], authHeader: 'Bearer sk-live' })
    expect(decision).toEqual({
      action: 'reject',
      status: 401,
      code: 'no_api_key_configured',
      message: expect.stringContaining('no API key'),
    })
  })

  it('没带 Key → missing_api_key', () => {
    const decision = checkApiKeyAuth({ ...base, authHeader: '' })
    expect(decision).toMatchObject({ action: 'reject', status: 401, code: 'missing_api_key' })
  })

  it('Key 错误 → invalid_api_key', () => {
    const decision = checkApiKeyAuth({ ...base, authHeader: 'Bearer sk-wrong' })
    expect(decision).toMatchObject({ action: 'reject', status: 401, code: 'invalid_api_key' })
  })

  it('Key 已禁用 → invalid_api_key', () => {
    const decision = checkApiKeyAuth({ ...base, authHeader: 'Bearer sk-off' })
    expect(decision).toMatchObject({ action: 'reject', status: 401, code: 'invalid_api_key' })
  })

  it('Key 正确 → 通过并返回 keyId（供更新用量）', () => {
    expect(checkApiKeyAuth(base)).toEqual({ action: 'accept', keyId: 'k1' })
  })

  it('X-API-Key / ?api_key= 同样可以通过', () => {
    expect(checkApiKeyAuth({ ...base, authHeader: '', headerApiKey: 'sk-live' })).toEqual({ action: 'accept', keyId: 'k1' })
    expect(checkApiKeyAuth({ ...base, authHeader: '', queryApiKey: 'sk-live' })).toEqual({ action: 'accept', keyId: 'k1' })
  })
})
