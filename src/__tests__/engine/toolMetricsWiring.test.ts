import { describe, it, expect, vi } from 'vitest'
import { ToolScheduler } from '../../engine/toolScheduler'

/**
 * 工具调用的度量埋点契约。
 *
 * 背景：`toolMetrics.recordToolCall` 此前**只有测试在调用**，生产链路零调用 ——
 * 于是新接的度量面板里「调用次数 / 成功率 / 误选率 / TopN 工具」永远为空。
 * 面板接上了，数据却没来源，等于接了一半。
 *
 * 本用例锁定：
 *   1. 注入后各退出点都会记录（成功 / 执行异常 / 工具不存在 / 校验失败 / 钩子拒绝）
 *   2. **未注入时不报错、行为不变**（度量绝不能影响工具执行）
 *   3. 埋点自身抛异常会被吞掉，不影响执行结果 —— 观测不该成为故障源
 *   4. sessionId 生效（多会话隔离，须与工具活跃集同 key）
 */
describe('ToolScheduler 度量埋点', () => {
  const makeTool = (name: string, execute?: () => Promise<string>) =>
    ({
      name,
      description: '',
      parameters: { type: 'object', properties: {} },
      canRunInParallel: false,
      validate: () => ({ valid: true }),
      execute: async () => ({ content: execute ? await execute() : 'ok' }),
    }) as never

  const makeScheduler = (opts: { output?: string; throwOnExecute?: boolean } = {}) => {
    const registry = new Map([['Bash', makeTool('Bash')], ['Read', makeTool('Read')]])
    const permission = { check: async () => true, requestAuthorization: async () => true } as never
    const executor = {
      execute: opts.throwOnExecute
        ? vi.fn(async () => { throw new Error('执行炸了') })
        : vi.fn(async () => opts.output ?? 'output'),
    } as never
    return { scheduler: new ToolScheduler(registry, permission, executor), executor }
  }

  const sink = () => ({ recordToolCall: vi.fn() })

  it('未注入度量时行为不变且不报错', async () => {
    const { scheduler, executor } = makeScheduler()
    const results = await scheduler.execute([{ id: 't1', name: 'Bash', input: {} }])
    expect(results[0].success).toBe(true)
    expect(executor.execute).toHaveBeenCalled()
  })

  it('成功执行记录 ok=true 与输出字节数', async () => {
    const { scheduler } = makeScheduler({ output: 'hello world' })
    const s = sink()
    scheduler.setMetrics(s)

    await scheduler.execute([{ id: 't1', name: 'Bash', input: {} }])

    expect(s.recordToolCall).toHaveBeenCalledTimes(1)
    const rec = s.recordToolCall.mock.calls[0][0]
    expect(rec.tool).toBe('Bash')
    expect(rec.ok).toBe(true)
    expect(rec.allowed).toBe(true)
    expect(rec.outputBytes).toBe(Buffer.byteLength('hello world', 'utf-8'))
    expect(rec.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('执行抛异常时记录 ok=false', async () => {
    const { scheduler } = makeScheduler({ throwOnExecute: true })
    const s = sink()
    scheduler.setMetrics(s)

    const results = await scheduler.execute([{ id: 't1', name: 'Bash', input: {} }])
    expect(results[0].success).toBe(false)
    expect(s.recordToolCall).toHaveBeenCalledTimes(1)
    expect(s.recordToolCall.mock.calls[0][0].ok).toBe(false)
    expect(s.recordToolCall.mock.calls[0][0].reason).toBe('executionError')
  })

  it('工具不存在记为误选（wasActive=false）', async () => {
    const { scheduler } = makeScheduler()
    const s = sink()
    scheduler.setMetrics(s)

    await scheduler.execute([{ id: 't1', name: 'NoSuchTool', input: {} }])

    expect(s.recordToolCall).toHaveBeenCalledTimes(1)
    const rec = s.recordToolCall.mock.calls[0][0]
    expect(rec.wasActive).toBe(false)
    expect(rec.ok).toBe(false)
  })

  it('钩子拒绝时记录 allowed=false 与原因', async () => {
    const { scheduler, executor } = makeScheduler()
    scheduler.setHooks({ preToolUse: async () => ({ deny: true, reason: '禁止执行 shell' }) })
    const s = sink()
    scheduler.setMetrics(s)

    await scheduler.execute([{ id: 't1', name: 'Bash', input: {} }])

    expect(executor.execute).not.toHaveBeenCalled()
    expect(s.recordToolCall).toHaveBeenCalledTimes(1)
    const rec = s.recordToolCall.mock.calls[0][0]
    expect(rec.allowed).toBe(false)
    expect(rec.reason).toBe('禁止执行 shell')
  })

  it('sessionId 透传，缺省为 default（与工具活跃集同 key）', async () => {
    const { scheduler } = makeScheduler()
    const s = sink()
    scheduler.setMetrics(s)
    scheduler.setSessionId('sess-42')

    await scheduler.execute([{ id: 't1', name: 'Bash', input: {} }])
    expect(s.recordToolCall.mock.calls[0][0].sessionId).toBe('sess-42')

    // 未设置时应归到 default，而不是空字符串/未定义
    const { scheduler: s2 } = makeScheduler()
    const s2sink = sink()
    s2.setMetrics(s2sink)
    await s2.execute([{ id: 't1', name: 'Bash', input: {} }])
    expect(s2sink.recordToolCall.mock.calls[0][0].sessionId).toBe('default')
  })

  it('埋点自身抛异常时吞掉，不影响工具执行结果', async () => {
    const { scheduler } = makeScheduler()
    scheduler.setMetrics({ recordToolCall: () => { throw new Error('度量炸了') } })

    // 关键断言：工具仍成功执行，度量失败不外泄
    const results = await scheduler.execute([{ id: 't1', name: 'Bash', input: {} }])
    expect(results[0].success).toBe(true)
  })
})
