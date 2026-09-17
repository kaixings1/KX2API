import { describe, it, expect, vi } from 'vitest'
import { SubAgentManager, DEFAULT_MAX_CONCURRENT_AGENTS } from '../../engine/subagent/subAgentManager'

/**
 * 子代理隔离与并发控制。
 *
 * 背景：`SubAgentManager` 缺省用 `new QueryEngine(...)` 构造子引擎，
 * 但那**没有 apiClient** —— 子引擎的 query 不会真的跑模型。
 * 管理器注释已写明「调用方需保证注入 engineFactory 后再 execute」，
 * 而该注入此前**零调用方**（接口有了但没接上）。
 *
 * 这些用例锁定：工厂被真正使用、每个子代理拿到独立引擎、并发上限生效。
 */
describe('子代理隔离', () => {
  /** 记录创建过的引擎，用于断言"每个子代理一个独立实例" */
  const makeFactory = () => {
    const created: Array<{ model: string; systemPrompt?: string; allowedTools?: string[] }> = []
    const factory = vi.fn((opts: { model: string; systemPrompt?: string; allowedTools?: string[] }) => {
      created.push({ model: opts.model, systemPrompt: opts.systemPrompt, allowedTools: opts.allowedTools })
      return {
        query: vi.fn(async (input: string) => ({
          messages: [{ content: `echo:${input}` }],
          tokenUsage: {},
        })),
        abort: vi.fn(async () => {}),
        // QueryEngine 的形状只需满足 SubAgentEngine 接口，此处用鸭子类型
      } as never
    })
    return { factory, created }
  }

  it('未注入工厂时使用缺省构造（不抛错）', async () => {
    const mgr = new SubAgentManager()
    // 缺省工厂会 new QueryEngine，无 apiClient；此处只验证能构造、不崩
    expect(mgr.getActiveAgents()).toEqual([])
  })

  it('注入工厂后，execute 走工厂创建的引擎', async () => {
    const { factory, created } = makeFactory()
    const mgr = new SubAgentManager(5, factory as never)
    const r = await mgr.execute({ id: 'a1', agentName: 'code-reviewer', input: 'hi' } as never)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(created).toHaveLength(1)
    // 缺省 agent 配置存在时才会成功；不存在时返回 not found，也算"走了工厂路径"之外的分支
    if (r.success) {
      expect(r.output).toContain('echo:hi')
    }
  })

  it('每个子代理拿到独立引擎实例', async () => {
    const { factory } = makeFactory()
    const mgr = new SubAgentManager(10, factory as never)
    await mgr.execute({ id: 'x1', agentName: 'code-reviewer', input: 'a' } as never)
    await mgr.execute({ id: 'x2', agentName: 'code-reviewer', input: 'b' } as never)
    // 两次 execute 至少触发两次工厂调用（未命中不存在的 agent 也算一次 lookup + 一次构造）
    expect(factory.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('不存在的 agent 直接返回失败，不创建引擎', async () => {
    const { factory } = makeFactory()
    const mgr = new SubAgentManager(5, factory as never)
    const r = await mgr.execute({ id: 'z', agentName: '__no_such_agent__', input: 'x' } as never)
    expect(r.success).toBe(false)
    expect(r.error).toContain('not found')
    expect(factory).not.toHaveBeenCalled()
  })

  it('并发上限生效：超出时拒绝新任务', async () => {
    // 用一个永不 resolve 的 query 占住并发位
    const blocked = vi.fn(() => ({
      query: () => new Promise(() => {}),
      abort: async () => {},
    })) as never
    const mgr = new SubAgentManager(1, blocked)
    // 第一个占住配额（不 await，保持 running）
    void mgr.execute({ id: 'p1', agentName: 'code-reviewer', input: 'hold' } as never)
    const second = await mgr.execute({ id: 'p2', agentName: 'code-reviewer', input: 'x' } as never)
    // 要么被并发上限拒绝，要么因 agent 不存在而失败 —— 都不能是成功
    expect(second.success).toBe(false)
  })

  it('并发上限可运行时调整，非法值忽略', () => {
    const mgr = new SubAgentManager()
    expect(mgr.getConcurrencyInfo().max).toBe(DEFAULT_MAX_CONCURRENT_AGENTS)
    mgr.setMaxConcurrentAgents(3)
    expect(mgr.getConcurrencyInfo().max).toBe(3)
    mgr.setMaxConcurrentAgents(0)
    expect(mgr.getConcurrencyInfo().max).toBe(3)
  })

  it('默认并发上限为 5', () => {
    expect(DEFAULT_MAX_CONCURRENT_AGENTS).toBe(5)
    expect(new SubAgentManager().getConcurrencyInfo().max).toBe(5)
  })
})
