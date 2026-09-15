/**
 * QueryEngine.executeCommand 回归测试
 *
 * 背景：IPC `chat:executeCommand` 直接调用 `engine.executeCommand()`，
 * 但 QueryEngine 上曾经没有这个方法，任何斜杠命令（/init、/help、/team…）
 * 都会返回 “executeCommand not available”。这里锁住这个行为。
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: class MockBrowserWindow {},
  app: { getPath: () => '/tmp', getVersion: () => '1.0.0' },
  safeStorage: { encrypt: (d: Buffer) => d, decrypt: (d: Buffer) => d },
}))

import { QueryEngine } from '../../index'

function makeEngine(): QueryEngine {
  return new QueryEngine({ model: 'gpt-4o', provider: 'openai', maxOutputTokens: 256 })
}

describe('QueryEngine.executeCommand', () => {
  it('方法存在（回归：以前缺失导致所有斜杠命令报 executeCommand not available）', () => {
    expect(typeof makeEngine().executeCommand).toBe('function')
  })

  it('执行已注册命令并返回输出（/pwd）', async () => {
    const result = await makeEngine().executeCommand('pwd', [])
    expect(result.success).toBe(true)
    expect(result.output).toBeTruthy()
    expect(result.output).not.toContain('not available')
  })

  it('命令名前带 / 也能识别', async () => {
    const result = await makeEngine().executeCommand('/version', [])
    expect(result.success).toBe(true)
  })

  it('/init 已注册，可在临时目录生成 CLAUDE.md', async () => {
    const { promises: fs } = await import('fs')
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const dir = await fs.mkdtemp(join(tmpdir(), 'kx2-exec-init-'))
    try {
      await fs.writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'vitest run' } }), 'utf-8')
      const result = await makeEngine().executeCommand('init', [dir])
      expect(result.success).toBe(true)
      expect(result.output).toContain('/init 完成')
      const content = await fs.readFile(join(dir, 'CLAUDE.md'), 'utf-8')
      expect(content).toContain('demo')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('未知命令 → 明确报错而不是 not available', async () => {
    const result = await makeEngine().executeCommand('definitely_not_a_command', [])
    expect(result.success).toBe(false)
    expect(result.error).toContain('未知命令')
    expect(result.error).not.toContain('not available')
  })

  it('空命令名 → 明确报错', async () => {
    const result = await makeEngine().executeCommand('', [])
    expect(result.success).toBe(false)
    expect(result.error).toContain('未指定命令名')
  })
})
