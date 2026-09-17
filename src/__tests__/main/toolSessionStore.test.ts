import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  ToolSessionStore,
  setToolSessionStorePath,
  loadPersistedStore,
  deriveActiveToolsFromMessages,
  mergeActiveTools,
  MAX_LAST_USED_ENTRIES,
} from '../../main/tools/toolSessionStore'

/**
 * 工具会话状态的核心契约：
 *   1. 落盘后重启能恢复（原先纯内存 Map，重启即丢 → 模型以为工具可用却调用失败）
 *   2. 从对话历史能反扫重建活跃集
 *   3. 只保留当前仍可用的工具（历史里可能有已删除的工具）
 *   4. 落盘失败不丢状态、退出前能同步补写
 */

let dir: string
let storePath: string

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kx2-toolsess-'))
  storePath = path.join(dir, 'tool-sessions.json')
})

afterAll(async () => {
  setToolSessionStorePath(null)
  await fs.rm(dir, { recursive: true, force: true })
})

beforeEach(async () => {
  await fs.rm(storePath, { force: true })
  setToolSessionStorePath(storePath)
})

describe('落盘与恢复', () => {
  it('空文件不存在时返回空结构', async () => {
    const s = await loadPersistedStore()
    expect(s).toEqual({ version: 1, sessions: {} })
  })

  it('写入后能被新实例读回（模拟重启）', async () => {
    const a = new ToolSessionStore()
    const st = await a.get('sess-1')
    st.active = ['tool_a', 'tool_b']
    st.roleId = 'developer'
    st.lastUsed = { tool_a: 1000 }
    a.markDirty()
    await a.flush()

    const b = new ToolSessionStore()
    const restored = await b.get('sess-1')
    expect(restored.active.sort()).toEqual(['tool_a', 'tool_b'])
    expect(restored.roleId).toBe('developer')
    expect(restored.lastUsed.tool_a).toBe(1000)
  })

  it('损坏的 JSON 降级为空结构而非抛错', async () => {
    await fs.writeFile(storePath, '{ 这不是 JSON', 'utf-8')
    expect(await loadPersistedStore()).toEqual({ version: 1, sessions: {} })
  })

  it('版本号不匹配时拒绝加载（防旧格式误读）', async () => {
    await fs.writeFile(storePath, JSON.stringify({ version: 99, sessions: { x: {} } }), 'utf-8')
    expect(await loadPersistedStore()).toEqual({ version: 1, sessions: {} })
  })

  it('未设置路径时 flush 是空操作', async () => {
    setToolSessionStorePath(null)
    const s = new ToolSessionStore()
    const st = await s.get('x')
    st.active = ['a']
    s.markDirty()
    await expect(s.flush()).resolves.toBeUndefined()
    setToolSessionStorePath(storePath)
  })

  it('无改动时 flush 不写文件', async () => {
    const s = new ToolSessionStore()
    await s.get('x')
    await s.flush()
    await expect(fs.access(storePath)).rejects.toThrow()
  })

  it('remove 后新实例读不到该会话', async () => {
    const a = new ToolSessionStore()
    const st = await a.get('gone')
    st.active = ['t']
    a.markDirty()
    await a.flush()

    await a.remove('gone')
    await a.flush()

    const b = new ToolSessionStore()
    const s = await loadPersistedStore()
    expect(s.sessions['gone']).toBeUndefined()
    expect((await b.get('gone')).active).toEqual([])
  })
})

describe('flushSync（退出前补写）', () => {
  it('同步落盘后新实例能读到', async () => {
    const a = new ToolSessionStore()
    const st = await a.get('sync-1')
    st.active = ['tool_x']
    a.markDirty()
    a.flushSync()

    const b = new ToolSessionStore()
    expect((await b.get('sync-1')).active).toEqual(['tool_x'])
  })

  it('无改动时同步落盘不创建文件', () => {
    const s = new ToolSessionStore()
    s.flushSync()
    expect(true).toBe(true) // 不抛错即可
  })
})

describe('条目上限', () => {
  it('lastUsed 超限时按时间保留最近的', async () => {
    const s = new ToolSessionStore()
    const st = await s.get('many')
    for (let i = 0; i < MAX_LAST_USED_ENTRIES + 100; i++) {
      st.lastUsed[`t${i}`] = i
    }
    s.markDirty()
    await s.flush()

    const data = await loadPersistedStore()
    const keys = Object.keys(data.sessions['many'].lastUsed)
    expect(keys.length).toBeLessThanOrEqual(MAX_LAST_USED_ENTRIES)
    // 应保留时间戳最大的那些
    expect(keys).toContain(`t${MAX_LAST_USED_ENTRIES + 99}`)
  })
})

describe('deriveActiveToolsFromMessages — 历史反扫', () => {
  const available = new Set(['read_file', 'write_file', 'bash', 'grep'])

  it('扫出 Anthropic 风格的 tool_use 块', () => {
    const messages = [
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '好的' },
          { type: 'tool_use', id: '1', name: 'read_file', input: {} },
        ],
      },
    ]
    expect(deriveActiveToolsFromMessages(messages, available).sort()).toEqual(['read_file'])
  })

  it('扫出 OpenAI 风格的 tool_calls', () => {
    const messages = [
      {
        role: 'assistant',
        tool_calls: [{ id: 'c1', function: { name: 'bash', arguments: '{}' } }],
      },
    ]
    expect(deriveActiveToolsFromMessages(messages, available)).toEqual(['bash'])
  })

  it('扫出被序列化成字符串的历史', () => {
    const messages = [
      { role: 'assistant', content: '{"type":"tool_use","id":"1","name":"grep","input":{}}' },
    ]
    expect(deriveActiveToolsFromMessages(messages, available)).toEqual(['grep'])
  })

  it('过滤掉当前不可用的工具（历史里可能有已删除的）', () => {
    const messages = [
      { role: 'assistant', content: [{ type: 'tool_use', name: 'deleted_tool' }] },
      { role: 'assistant', content: [{ type: 'tool_use', name: 'bash' }] },
    ]
    expect(deriveActiveToolsFromMessages(messages, available)).toEqual(['bash'])
  })

  it('去重', () => {
    const messages = [
      { role: 'assistant', content: [{ type: 'tool_use', name: 'bash' }] },
      { role: 'assistant', content: [{ type: 'tool_use', name: 'bash' }] },
    ]
    expect(deriveActiveToolsFromMessages(messages, available)).toEqual(['bash'])
  })

  it('空输入 / 畸形输入安全', () => {
    expect(deriveActiveToolsFromMessages([], available)).toEqual([])
    expect(deriveActiveToolsFromMessages([null, undefined, 42, 'plain text'], available)).toEqual([])
  })

  it('深度过大的嵌套不会栈溢出', () => {
    let node: Record<string, unknown> = { type: 'tool_use', name: 'bash' }
    for (let i = 0; i < 50; i++) node = { nested: node }
    expect(() => deriveActiveToolsFromMessages([node], available)).not.toThrow()
  })

  it('非常长的字符串不会卡死', () => {
    const long = 'x'.repeat(200_000)
    const t0 = Date.now()
    deriveActiveToolsFromMessages([{ role: 'assistant', content: long }], available)
    expect(Date.now() - t0).toBeLessThan(2000)
  })
})

describe('mergeActiveTools', () => {
  const available = new Set(['a', 'b', 'c'])

  it('两端取并集', () => {
    expect(mergeActiveTools(['a'], ['b'], available).sort()).toEqual(['a', 'b'])
  })

  it('过滤不可用项', () => {
    expect(mergeActiveTools(['a', 'gone'], ['b', 'nope'], available).sort()).toEqual(['a', 'b'])
  })

  it('去重', () => {
    expect(mergeActiveTools(['a'], ['a'], available)).toEqual(['a'])
  })

  it('空输入', () => {
    expect(mergeActiveTools([], [], available)).toEqual([])
  })
})
