import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 审计接入 verification：
 * securityEnhancer 此前只做「净化/过滤/路径守卫」，AuditLogger 是孤儿。
 * 现已把审计挂到工具执行链上，本用例锁定该行为。
 */
describe('securityEnhancer 审计接入', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kx2-audit-'))
  })

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 清理失败不影响断言 */
    }
  })

  const fakeTool = (name: string) =>
    ({
      name,
      description: '',
      parameters: {},
      validate: () => ({ valid: true }),
      execute: async () => ({ content: 'ok' }),
    }) as never

  const okExecutor = { execute: async () => 'output' } as never

  it('工具执行成功后写入审计记录', async () => {
    const { createSecurityEnhancer } = await import('../../engine/securityEnhancer')
    // bufferSize=1：记录即落盘，无需等待定时器
    const enhanced = createSecurityEnhancer(okExecutor, {
      auditDir: dir,
      auditBufferSize: 1,
    })
    await enhanced.execute(fakeTool('Read'), { path: '/tmp/a.txt' }, { timeout: 1000 })

    const logFile = join(dir, 'audit.log')
    // 审计是异步落盘的，等待其写入
    await vi.waitFor(
      () => {
        const content = readFileSync(logFile, 'utf-8')
        expect(content).toContain('Read')
        expect(content).toContain('"result":"success"')
      },
      { timeout: 3000 },
    )
  })

  it('工具执行失败也记录（result=failure）', async () => {
    const { createSecurityEnhancer } = await import('../../engine/securityEnhancer')
    const failing = {
      execute: async () => {
        throw new Error('boom')
      },
    } as never
    const enhanced = createSecurityEnhancer(failing, {
      auditDir: dir,
      sanitizeOutput: false,
      auditBufferSize: 1,
    })
    await expect(
      enhanced.execute(fakeTool('Bash'), { command: 'ls' }, { timeout: 1000 }),
    ).rejects.toThrow('boom')

    // flush 是异步的且 log() 不 await 它 —— 必须等落盘完成再断言，
    // 否则会拿到「文件还没写」的假失败。
    const logFile = join(dir, 'audit.log')
    await vi.waitFor(
      () => {
        expect(readFileSync(logFile, 'utf-8')).toContain('"result":"failure"')
      },
      { timeout: 3000 },
    )
  })

  it('路径被拦截时记录 denied', async () => {
    const { createSecurityEnhancer } = await import('../../engine/securityEnhancer')
    const enhanced = createSecurityEnhancer(okExecutor, {
      auditDir: dir,
      pathGuardConfig: { allowedDirs: ['/allowed'] },
    })
    const out = await enhanced.execute(
      fakeTool('Read'),
      { path: '/etc/passwd' },
      { timeout: 1000 },
    )
    expect(String(out)).toContain('安全拦截')

    const logFile = join(dir, 'audit.log')
    await vi.waitFor(
      () => {
        expect(readFileSync(logFile, 'utf-8')).toContain('"result":"denied"')
      },
      { timeout: 3000 },
    )
  })

  it('enableAudit=false 时不产生审计文件', async () => {
    const { createSecurityEnhancer } = await import('../../engine/securityEnhancer')
    const enhanced = createSecurityEnhancer(okExecutor, {
      auditDir: dir,
      enableAudit: false,
    })
    await enhanced.execute(fakeTool('Read'), { path: '/tmp/a.txt' }, { timeout: 1000 })
    expect(existsSync(join(dir, 'audit.log'))).toBe(false)
  })

  it('审计目录不可写时不影响工具执行（降级为不审计）', async () => {
    const { createSecurityEnhancer } = await import('../../engine/securityEnhancer')
    const enhanced = createSecurityEnhancer(okExecutor, {
      // 指向一个不可能存在的深层路径
      auditDir: join(dir, 'no', 'such', 'dir'),
    })
    const out = await enhanced.execute(
      fakeTool('Read'),
      { path: '/tmp/a.txt' },
      { timeout: 1000 },
    )
    // 关键：审计失败绝不能阻断工具执行
    expect(String(out)).toBe('output')
  })
})
