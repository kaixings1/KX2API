/**
 * toolManager 单测 —— 工具/分组/提示规则的 CRUD 与匹配
 *
 * 覆盖里程碑 1（addTool 兜底 parameters）、里程碑 3（参数透传）改动，
 * 以及分组/规则/匹配的核心行为。
 * 通过 mock storeManager 隔离持久化，避免污染真实配置。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ToolDefinition, ToolGroup, ToolHintRule } from '../types'

// mock store 层：getConfig 返回可控的内存 store
const mockConfig: { store: { toolManagement?: unknown } } = { store: {} }

vi.mock('../store/store', () => ({
  storeManager: {
    getConfig: () => mockConfig.store,
    updateConfig: () => ({}),
  },
}))

// mock 命令注册表：只返回空的工具列表，避免拖入真实引擎依赖
vi.mock('../../engine/commands/registry', () => ({
  commandRegistry: { getAll: () => [] },
}))

import { ToolManager } from '../toolManager'
import type { ToolManagementStore } from '../types'

// ---------- 数据构造 ----------

function tool(name: string, over: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: over.id ?? name,
    name: over.name ?? name,
    displayName: over.displayName ?? name,
    description: over.description ?? '',
    usage: over.usage ?? `/${name}`,
    platform: over.platform ?? 'all',
    parameters: over.parameters ?? [],
    tags: over.tags ?? [],
    enabled: over.enabled ?? true,
    builtin: over.builtin ?? false,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

function group(id: string, name: string, toolIds: string[] = [], over: Partial<ToolGroup> = {}): ToolGroup {
  return { id, name, description: '', toolIds, enabled: true, builtin: false, createdAt: 0, ...over }
}

function hintRule(over: Partial<ToolHintRule> & { id: string }): ToolHintRule {
  return {
    id: over.id,
    name: over.name ?? '规则',
    description: over.description ?? '',
    patterns: over.patterns ?? [],
    groupIds: over.groupIds ?? [],
    priority: over.priority ?? 10,
    enabled: over.enabled ?? true,
    builtin: over.builtin ?? false,
    createdAt: 0,
    ...over,
  }
}

/** 新建一个从给定初始数据启动的 ToolManager，隔离 store */
function fresh(initial?: Partial<ToolManagementStore>): ToolManager {
  const empty: ToolManagementStore = { tools: [], groups: [], hintRules: [] }
  mockConfigState.store = { toolManagement: { ...empty, ...(initial ?? {}) } }
  return new ToolManager()
}

describe('ToolManager — 工具 CRUD', () => {
  let m: ToolManager
  beforeEach(() => { m = fresh() })

  it('add 透传参数；未提供 parameters 时兜底为空数组', () => {
    const added = m.addTool({
      name: 'my-tool', displayName: '我的工具', description: 'd', usage: '/my-tool', platform: 'all',
      parameters: [{ name: 'x', type: 'string', required: true, description: '例子' }], tags: [], enabled: true,
    })
    expect(added.id).toBe('my-tool')
    expect(added.parameters).toHaveLength(1)
    expect(added.parameters![0]).toMatchObject({ name: 'x', required: true, type: 'string' })

    const noParams = m.addTool({ name: 'no-params', displayName: 'N', description: '', usage: '/no-params', platform: 'all', tags: [], enabled: true })
    expect(noParams.parameters).toEqual([])
  })

  it('以同名再次 add 会覆盖同名工具，不产生重复', () => {
    m.addTool(tool('a', { displayName: 'A' }))
    m.addTool(tool('a', { displayName: 'A2' }))
    expect(m.getAllTools().filter(x => x.id === 'a')).toHaveLength(1)
    expect(m.getTool('a')!.displayName).toBe('A2')
  })

  it('updateTool 更新字段与参数；不存在的返回 null', () => {
    m.addTool(tool('a'))
    const updated = m.updateTool('a', {
      displayName: 'A-new',
      parameters: [{ name: 'p', type: 'number', required: false, description: '' }],
    })
    expect(updated!.displayName).toBe('A-new')
    expect(updated!.parameters).toHaveLength(1)
    expect(m.updateTool('ghost', {})).toBeNull()
  })

  it('toggleTool 切换 enabled，getEnabledTools 反映结果', () => {
    m.addTool(tool('a'))
    expect(m.getEnabledTools().map(x => x.name)).toEqual(['a'])
    m.toggleTool('a')
    expect(m.getTool('a')!.enabled).toBe(false)
    expect(m.getEnabledTools()).toHaveLength(0)
  })

  it('removeTool 删除并清理分组引用；builtin 拒绝删除', () => {
    const m2 = fresh({
      tools: [tool('ls', { builtin: true }), tool('custom')],
      groups: [group('g', 'G', ['custom', 'ls'])],
    })
    expect(m2.removeTool('ls')).toBe(false)
    expect(m2.removeTool('custom')).toBe(true)
    expect(m2.getGroup('g')!.toolIds).toEqual(['ls'])
  })
})

describe('ToolManager — 分组 CRUD', () => {
  it('add / update / remove 分组', () => {
    const m = fresh()
    const g = m.addGroup({ name: '编程', description: 'd', toolIds: ['ls'], enabled: true })
    expect(g.builtin).toBe(false)
    expect(g.id.startsWith('group-')).toBe(true)

    m.updateGroup(g.id, { toolIds: ['ls', 'cat'] })
    expect(m.getGroup(g.id)!.toolIds).toEqual(['ls', 'cat'])

    expect(m.removeGroup(g.id)).toBe(true)
    expect(m.removeGroup(g.id)).toBe(false)
  })

  it('addToolToGroup / removeToolFromGroup / 组不存在', () => {
    const m = fresh({ groups: [group('g', 'G')] })
    expect(m.addToolToGroup('ls', 'g')).toBe(true)
    expect(m.addToolToGroup('ls', 'g')).toBe(false)
    expect(m.removeToolFromGroup('ls', 'g')).toBe(true)
    expect(m.addToolToGroup('ls', 'ghost')).toBe(false)
  })

  it('getToolsInGroup 只返回存在的工具', () => {
    const m = fresh({
      tools: [tool('ls'), tool('cat')],
      groups: [group('g', 'G', ['ls', 'ghost'])],
    })
    expect(m.getToolsInGroup('g').map(x => x.name)).toEqual(['ls'])
  })
})

describe('ToolManager — 提示规则', () => {
  it('addHintRule 写入并可删除', () => {
    const m = fresh()
    const r = m.addHintRule(hintRule({ id: 'want-id', name: '搜索', patterns: ['查看'], groupIds: ['file-system'] }))
    // ToolManager.addHintRule 会重新生成 rule- 前缀 id
    expect(r.id.startsWith('rule-')).toBe(true)
    expect(m.getAllHintRules()).toHaveLength(1)
    expect(m.removeHintRule(r.id)).toBe(true)
    expect(m.getAllHintRules()).toHaveLength(0)
  })

  it('matchHintRules 命中模式返回匹配分组，按优先级排序、去重、过滤 disabled', () => {
    const m = fresh({
      groups: [
        group('a', 'a', ['ls']),
        group('b', 'b', ['cat']),
        group('c', 'c', ['grep'], { enabled: false }),
      ],
      hintRules: [
        hintRule({ id: '1', patterns: ['key'], groupIds: ['a', 'c'], priority: 5 }),
        hintRule({ id: '2', patterns: ['key'], groupIds: ['b'], priority: 99 }),
        hintRule({ id: '3', patterns: ['nothing'], groupIds: ['b'], priority: 1 }),
      ],
    })
    const matched = m.matchHintRules('有一个 key')
    // r2(priority 99) 命中 b 在前；r1(5) 命中 a（c 被 enable:false 过滤）；r3 不命中
    expect(matched.map(x => x.id)).toEqual(['b', 'a'])
  })

  it('matchHintRules 排除 disabled 规则', () => {
    const m = fresh({
      groups: [group('a', 'a', ['ls'])],
      hintRules: [hintRule({ id: 'd', patterns: ['key'], groupIds: ['a'], enabled: false })],
    })
    expect(m.matchHintRules('一个 key')).toEqual([])
  })
})

describe('ToolManager — 重置默认', () => {
  it('resetToDefault 重建内置分组', () => {
    const m = fresh({ tools: [tool('custom')], groups: [group('g', '自定义')] })
    m.resetToDefault()
    expect(m.getGroup('file-system')).toBeDefined()
    expect(m.getGroup('ai-agent')).toBeDefined()
    expect(m.getGroup('g')).toBeUndefined()
  })
})