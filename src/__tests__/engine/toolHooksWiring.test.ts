import { describe, it, expect, vi } from 'vitest'
import { ToolScheduler } from '../../engine/toolScheduler'

/**
 * ToolScheduler 的钩子注入此前是「零调用方」的孤儿能力：
 * setHooks 写好了、ToolHooks 接口定义了，但没有任何地方注入 ——
 * main/hooks 整个模块也因此无法生效。
 *
 * 本用例锁定注入契约：preToolUse 能否拦截、postToolUse 能否收到结果。
 */
describe('ToolScheduler 钩子注入', () => {
  const makeTool = (name: string) =>
    ({
      name,
      description: '',
      parameters: {},
      canRunInParallel: false,
      validate: () => ({ valid: true }),
      execute: async () => ({ content: 'ok' }),
    }) as never

  const makeScheduler = (executorOutput = 'output') => {
    const registry = new Map([['Bash', makeTool('Bash')], ['Read', makeTool('Read')]])
    const permission = {
      check: async () => true,
      requestAuthorization: async () => true,
    } as never
    const executor = { execute: vi.fn(async () => executorOutput) } as never
    const scheduler = new ToolScheduler(registry, permission, executor)
    return { scheduler, executor }
  }

  it('未注入钩子时行为不变（直接执行）', async () => {
    const { scheduler, executor } = makeScheduler()
    const results = await scheduler.execute([
      { id: 't1', name: 'Bash', input: { command: 'ls' } },
    ])
    expect(results[0].success).toBe(true)
    expect(executor.execute).toHaveBeenCalled()
  })

  it('preToolUse 返回 deny 时跳过执行', async () => {
    const { scheduler, executor } = makeScheduler()
    scheduler.setHooks({
      preToolUse: async () => ({ deny: true, reason: '禁止执行 shell' }),
    })
    const results = await scheduler.execute([
      { id: 't1', name: 'Bash', input: { command: 'rm -rf /' } },
    ])
    // 关键：被拒绝的工具绝不能落到 executor
    expect(executor.execute).not.toHaveBeenCalled()
    expect(results[0].success).toBe(false)
  })

  it('preToolUse 放行时正常执行', async () => {
    const { scheduler, executor } = makeScheduler()
    scheduler.setHooks({ preToolUse: async () => ({}) })
    await scheduler.execute([{ id: 't1', name: 'Bash', input: { command: 'ls' } }])
    expect(executor.execute).toHaveBeenCalledTimes(1)
  })

  it('preToolUse 只对匹配的工具生效（未匹配仍执行）', async () => {
    const { scheduler, executor } = makeScheduler()
    scheduler.setHooks({
      preToolUse: async (toolName) =>
        toolName === 'Bash' ? { deny: true, reason: 'no' } : {},
    })
    const results = await scheduler.execute([
      { id: 't1', name: 'Read', input: { path: '/tmp/a' } },
    ])
    expect(executor.execute).toHaveBeenCalledTimes(1)
    expect(results[0].success).toBe(true)
  })

  it('postToolUse 收到执行结果与成功标记', async () => {
    const { scheduler } = makeScheduler('the-output')
    const post = vi.fn(async () => {})
    scheduler.setHooks({ postToolUse: post })
    await scheduler.execute([{ id: 't1', name: 'Bash', input: { command: 'ls' } }])
    expect(post).toHaveBeenCalledTimes(1)
    const [toolName, , success] = post.mock.calls[0] as unknown as [string, unknown, boolean]
    expect(toolName).toBe('Bash')
    expect(success).toBe(true)
  })

  it('工具执行失败时 postToolUse 仍被调用且标记失败', async () => {
    const registry = new Map([['Bash', makeTool('Bash')]])
    const permission = {
      check: async () => true,
      requestAuthorization: async () => true,
    } as never
    const executor = {
      execute: async () => {
        throw new Error('boom')
      },
    } as never
    const scheduler = new ToolScheduler(registry, permission, executor)
    const post = vi.fn(async () => {})
    scheduler.setHooks({ postToolUse: post })
    const results = await scheduler.execute([
      { id: 't1', name: 'Bash', input: { command: 'bad' } },
    ])
    expect(results[0].success).toBe(false)
    expect(post).toHaveBeenCalledTimes(1)
    const [, , success] = post.mock.calls[0] as unknown as [string, unknown, boolean]
    expect(success).toBe(false)
  })
})
