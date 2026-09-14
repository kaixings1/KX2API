/**
 * StepFun 会话 Token 校验 / 凭证持久化 回归测试
 *
 * 背景：Oasis-Token 是两段 base64url JWT 用 "..." 拼接：
 *   <session JWT>...<device JWT>
 * session 段只活约 30 分钟，device 段约 30 天。
 *
 * 修复前的问题：
 *  1. adapter 用 token.split('.') 且只在长度===3 时才检查 exp，这个格式永远
 *     不满足，于是过期 token 也被判定 "local validation passed"。
 *  2. inAppLogin 取各段 exp 的最大值，30 天那段掩盖了 30 分钟那段已过期。
 *  3. store 用 String(value) 存凭证，cookies 这类对象被存成 "[object Object]"。
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: class MockBrowserWindow {},
  session: { fromPartition: () => ({ cookies: { on: () => {}, get: async () => [] }, webRequest: { onBeforeSendHeaders: () => {}, onCompleted: () => {} } }) },
  shell: { openExternal: vi.fn() },
  app: { getPath: () => '/tmp', getVersion: () => '1.0.0', isPackaged: false },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
}))

import { StepFunOAuthAdapter } from '../../src/main/oauth/adapters/stepfun'
import { InAppLoginManager } from '../../src/main/oauth/inAppLogin'
import { StoreManager } from '../../src/main/store/store'

const b64url = (obj: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url')

const makeJwt = (payload: Record<string, unknown>) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`

const NOW = Math.floor(Date.now() / 1000)

// 09:33 过期 / 30 天后过期，与真实抓包一致
const EXPIRED_SESSION = makeJwt({ activated: true, oasis_id: 388577334041751550, exp: NOW - 3600 })
const LIVE_DEVICE = makeJwt({ app_id: 10200, device_id: 'dev-1', platform: 'web', exp: NOW + 30 * 24 * 3600 })
const LIVE_SESSION = makeJwt({ activated: true, oasis_id: 388577334041751550, exp: NOW + 1800 })

const adapter = new StepFunOAuthAdapter({
  providerId: 'stepfun',
  providerType: 'stepfun',
  authMethods: ['manual', 'browser'],
  callbackPort: 8311,
} as any)

describe('StepFun Oasis-Token 过期校验', () => {
  it('session 段已过期的 a...b 形式 token 必须判为无效', async () => {
    const result = await adapter.validateToken({ token: `${EXPIRED_SESSION}...${LIVE_DEVICE}` })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/expired/i)
  })

  it('两段都有效时判定为有效', async () => {
    const result = await adapter.validateToken({ token: `${LIVE_SESSION}...${LIVE_DEVICE}` })
    expect(result.valid).toBe(true)
  })

  it('activated=false 的 token 判为无效', async () => {
    const notActivated = makeJwt({ activated: false, exp: NOW + 1800 })
    const result = await adapter.validateToken({ token: `${notActivated}...${LIVE_DEVICE}` })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/activated/i)
  })

  it('普通单段 JWT 过期同样判为无效', async () => {
    const result = await adapter.validateToken({ token: makeJwt({ exp: NOW - 60 }) })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/expired/i)
  })
})

describe('InAppLogin 提取 token 时的过期门禁', () => {
  // 私有方法，仅测试纯逻辑（不触碰窗口/session）
  const validate = (value: string) =>
    (InAppLoginManager.prototype as any).validateOasisToken.call({}, value)

  it('session 段过期即拒绝（不能被 30 天那段掩盖）', () => {
    expect(validate(`${EXPIRED_SESSION}...${LIVE_DEVICE}`)).toBe(false)
  })

  it('两段都未过期时接受', () => {
    expect(validate(`${LIVE_SESSION}...${LIVE_DEVICE}`)).toBe(true)
  })
})

describe('凭证持久化保留非字符串值', () => {
  it('cookies 对象加密/解密后仍是对象且内容一致', () => {
    const manager = new StoreManager()
    const cookies = {
      'Oasis-Token': `${LIVE_SESSION}...${LIVE_DEVICE}`,
      'Oasis-Webid': '46c0d76cfce7a853389f9c9a06d204c8ec8a0039',
      i18next: 'zh',
    }

    const encrypted = manager.encryptCredentials({ token: 'abc', cookies })
    expect(typeof encrypted.cookies).toBe('string')
    expect(encrypted.cookies).not.toContain('[object Object]')

    const decrypted = manager.decryptCredentials(encrypted)
    expect(decrypted.token).toBe('abc')
    expect(typeof decrypted.cookies).toBe('object')
    expect(decrypted.cookies).toEqual(cookies)
  })

  it('普通字符串凭证不受影响', () => {
    const manager = new StoreManager()
    const decrypted = manager.decryptCredentials(
      manager.encryptCredentials({ token: 'eyJabc', web_id: 'dev-1' })
    )
    expect(decrypted).toEqual({ token: 'eyJabc', web_id: 'dev-1' })
  })
})
