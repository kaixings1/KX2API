/**
 * Engine Bridge 单元测试
 *
 * 覆盖：
 * - 默认配置下 enabledPlugins 包含 9 个核心工具
 * - 自定义 enabledPlugins 列表时只加载勾选的插件
 * - 空数组时回退到 enabledByDefault 列表
 * - ConfigManager.get() 异常时的回退行为
 * - 过滤不存在的插件 ID
 * - 能启用所有 19 个插件（包括默认禁用的）
 * - 函数接口正确性
 */

import { describe, it, expect, vi } from 'vitest'

// Mock electron（顶层）
vi.mock('electron', () => ({
  BrowserWindow: class MockBrowserWindow {},
  app: { getPath: () => '/tmp' },
  safeStorage: { encrypt: (d: Buffer) => d, decrypt: (d: Buffer) => d },
}))

import { getEnabledPluginsFromStore, mergeApiSettings, updateEngineApiClient } from '../engine-bridge'

/**
 * 回归：切模式/选配置组时的「局部更新」不能把 apiKey / model 打回默认值。
 * 以前 updateEngineApiClient 用 `opts.apiKey || ''`，导致切一次代理模式后
 * 直连请求就丢掉了 apiKey，model 也被打回 gpt-4o。
 */
describe('mergeApiSettings（API 连接参数局部更新）', () => {
  const current = { provider: 'anthropic', model: 'claude-sonnet-4', apiKey: 'sk-live', baseUrl: 'https://api.anthropic.com' }

  it('只传 baseUrl 时保留 provider / model / apiKey', () => {
    const merged = mergeApiSettings(current, { baseUrl: 'http://127.0.0.1:8080' })
    expect(merged).toEqual({ ...current, baseUrl: 'http://127.0.0.1:8080' })
  })

  it('显式传空 apiKey 表示真的清空', () => {
    expect(mergeApiSettings(current, { apiKey: '' }).apiKey).toBe('')
  })

  it('不传 apiKey / baseUrl 时沿用旧值', () => {
    const merged = mergeApiSettings(current, { model: 'gpt-4o' })
    expect(merged.apiKey).toBe('sk-live')
    expect(merged.baseUrl).toBe('https://api.anthropic.com')
    expect(merged.model).toBe('gpt-4o')
  })

  it('没有历史值时回退到默认 provider / model', () => {
    const merged = mergeApiSettings({ provider: '', model: '', apiKey: '' }, {})
    expect(merged.provider).toBe('openai')
    expect(merged.model).toBe('gpt-4o')
  })

  it('引擎未初始化时 updateEngineApiClient 返回 false（不会崩）', () => {
    expect(updateEngineApiClient({ baseUrl: 'https://api.openai.com' })).toBe(false)
  })
})

// 构造最小化的 AppConfig（只含 enabledPlugins）
const makeConfig = (enabledPlugins: string[]): Record<string, unknown> => ({ enabledPlugins })

describe('getEnabledPluginsFromStore', () => {
  it('默认 9 个核心工具', () => {
    const result = getEnabledPluginsFromStore(() => makeConfig([
      'read_file','write_file','edit','bash','glob','grep','web_search','web_fetch','git',
    ]))
    expect(result).toEqual(['read_file','write_file','edit','bash','glob','grep','web_search','web_fetch','git'])
  })

  it('自定义列表只返回勾选的插件', () => {
    const result = getEnabledPluginsFromStore(() => makeConfig(['bash','git']))
    expect(result).toEqual(['bash','git'])
  })

  it('空数组回退到 enabledByDefault', () => {
    const result = getEnabledPluginsFromStore(() => makeConfig([]))
    expect(result).toContain('read_file')
    expect(result).toContain('bash')
    expect(result).not.toContain('code_review')
  })

  it('ConfigManager.get() 异常时回退默认列表', () => {
    const result = getEnabledPluginsFromStore(() => { throw new Error('Store not initialized') })
    expect(result).toContain('read_file')
    expect(result).toContain('bash')
  })

  it('过滤不存在的插件 ID', () => {
    const result = getEnabledPluginsFromStore(() => makeConfig(['bash','non_existent_plugin','git','fake_tool']))
    expect(result).toEqual(['bash','git'])
  })

  it('启用全部 19 个插件（含默认禁用）', () => {
    const all = [
      'read_file','write_file','edit','bash','glob','grep','web_search','web_fetch','git',
      'code_review','refactor','security_audit','mcp','workflow',
      'database','graphql','http','file_watcher','metrics',
    ]
    const result = getEnabledPluginsFromStore(() => makeConfig(all))
    expect(result).toHaveLength(19)
    expect(result).toContain('code_review')
    expect(result).toContain('database')
    expect(result).toContain('metrics')
  })

  it('函数可调用且返回正确', async () => {
    const mod = await import('../engine-bridge')
    expect(typeof mod.getEnabledPluginsFromStore).toBe('function')
    expect(mod.getEnabledPluginsFromStore(() => makeConfig(['bash']))).toEqual(['bash'])
  })
})
