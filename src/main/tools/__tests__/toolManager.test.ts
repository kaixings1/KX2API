/**
 * toolManager 单测 —— 工具/分组/提示规则的 CRUD 与匹配
 *
 * 覆盖里程碑 1（addTool 兜底 parameters）、里程碑 3（参数透传）改动，
 * 以及分组/规则/匹配的核心行为。
 * 通过 mock storeManager 隔离持久化，避免污染真实配置。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ToolDefinition, ToolGroup, ToolHintRule, ToolRole } from '../types'

// 通过 vi.hoisted 创建模块级共享的可变 store，供 vi.mock 工厂与测试体安全访问
const mockStore: { data: Record<string, unknown> } = vi.hoisted(() => ({ data: {} }))

// 文件化主存储的替身：tools/groups/hintRules 代表「文件目录」里的自定义数据，
// builtinXxx 代表内置覆盖层目录（用户对内置项改动的产物）。
const mockFile: {
  tools: ToolDefinition[]
  groups: ToolGroup[]
  hintRules: ToolHintRule[]
  builtinTools: ToolDefinition[]
  builtinGroups: ToolGroup[]
  builtinHintRules: ToolHintRule[]
  roles: ToolRole[]
} = vi.hoisted(() => ({
  tools: [], groups: [], hintRules: [],
  builtinTools: [], builtinGroups: [], builtinHintRules: [],
  roles: [],
}))

/** 把实体写进某个数组（存在则替换） */
function upsertInto<T extends { id: string }>(list: T[], entity: T): void {
  const idx = list.findIndex(x => x.id === entity.id)
  if (idx >= 0) list[idx] = entity
  else list.push(entity)
}

vi.mock('../../store/store', () => ({
  storeManager: {
    getConfig: () => mockStore.data,
    updateConfig: () => ({}),
  },
}))

// mock 命令注册表：默认返回空列表以避免拖入真实引擎依赖；
// 测试需要构造「内置命令」时可往 mockRegistry.commands 里塞。
const mockRegistry: { commands: Array<{ name: string; description: string }> } =
  vi.hoisted(() => ({ commands: [] }))
vi.mock('../../../engine/commands/registry', () => ({
  commandRegistry: { getAll: () => [...mockRegistry.commands] },
}))

// mock 文件化存储层：list 从 mockFile 读取，save/delete 落到 mockFile
vi.mock('../toolFileStore', () => ({
  toolFileStore: {
    listTools: () => [...mockFile.tools],
    listGroups: () => [...mockFile.groups],
    listHintRules: () => [...mockFile.hintRules],
    saveTool: (t: ToolDefinition) => {
      const idx = mockFile.tools.findIndex(x => x.id === t.id)
      if (idx >= 0) mockFile.tools[idx] = t
      else mockFile.tools.push(t)
    },
    saveGroup: (g: ToolGroup) => {
      const idx = mockFile.groups.findIndex(x => x.id === g.id)
      if (idx >= 0) mockFile.groups[idx] = g
      else mockFile.groups.push(g)
    },
    saveHintRule: (r: ToolHintRule) => {
      const idx = mockFile.hintRules.findIndex(x => x.id === r.id)
      if (idx >= 0) mockFile.hintRules[idx] = r
      else mockFile.hintRules.push(r)
    },
    deleteTool: (id: string) => { mockFile.tools = mockFile.tools.filter(x => x.id !== id) },
    deleteGroup: (id: string) => { mockFile.groups = mockFile.groups.filter(x => x.id !== id) },
    deleteHintRule: (id: string) => { mockFile.hintRules = mockFile.hintRules.filter(x => x.id !== id) },
    resetAll: () => {
      mockFile.tools = []; mockFile.groups = []; mockFile.hintRules = []
      mockFile.builtinTools = []; mockFile.builtinGroups = []; mockFile.builtinHintRules = []
    },
    countCustom: () => ({ tools: mockFile.tools.length, groups: mockFile.groups.length, hintRules: mockFile.hintRules.length }),
    // ---- 内置覆盖层 ----
    listBuiltinTools: () => [...mockFile.builtinTools],
    listBuiltinGroups: () => [...mockFile.builtinGroups],
    listBuiltinHintRules: () => [...mockFile.builtinHintRules],
    saveBuiltinTool: (t: ToolDefinition) => { upsertInto(mockFile.builtinTools, t) },
    saveBuiltinGroup: (g: ToolGroup) => { upsertInto(mockFile.builtinGroups, g) },
    saveBuiltinHintRule: (r: ToolHintRule) => { upsertInto(mockFile.builtinHintRules, r) },
    deleteBuiltinTool: (id: string) => { mockFile.builtinTools = mockFile.builtinTools.filter(x => x.id !== id) },
    deleteBuiltinGroup: (id: string) => { mockFile.builtinGroups = mockFile.builtinGroups.filter(x => x.id !== id) },
    deleteBuiltinHintRule: (id: string) => { mockFile.builtinHintRules = mockFile.builtinHintRules.filter(x => x.id !== id) },
    hasBuiltinOverride: (kind: string, id: string) => {
      const list: { id: string }[] = kind === 'tools' ? mockFile.builtinTools
        : kind === 'groups' ? mockFile.builtinGroups : mockFile.builtinHintRules
      return list.some(x => x.id === id)
    },
    materializeBuiltin: (kind: string, id: string, entity: Record<string, unknown>) => {
      const list = kind === 'tools' ? mockFile.builtinTools
        : kind === 'groups' ? mockFile.builtinGroups : mockFile.builtinHintRules
      if (!list.some(x => x.id === id)) upsertInto(list as { id: string }[], entity as { id: string })
    },
    builtinPathOf: (kind: string, id: string) => `builtin/${kind}/${id}.json`,
    customPathOf: (kind: string, id: string) => `${kind}/${id}.json`,
    // ---- 角色配置 ----
    listRoles: () => [...mockFile.roles],
    saveRole: (r: ToolRole) => { upsertInto(mockFile.roles, r) },
    deleteRole: (id: string) => { mockFile.roles = mockFile.roles.filter(x => x.id !== id) },
  },
  migrateCustomRulesFromStore: () => ({ tools: 0, groups: 0, hintRules: 0 }),
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

/** 新建一个从给定初始数据启动的 ToolManager，隔离 store 与文件 */
function fresh(initial?: Partial<ToolManagementStore>): ToolManager {
  // 重置文件目录替身（含内置覆盖层）与命令注册表替身
  mockFile.tools = []
  mockFile.groups = []
  mockFile.hintRules = []
  mockFile.builtinTools = []
  mockFile.builtinGroups = []
  mockFile.builtinHintRules = []
  mockFile.roles = []
  mockRegistry.commands = []
  const empty: ToolManagementStore = { tools: [], groups: [], hintRules: [] }
  const init = { ...empty, ...(initial ?? {}) }
  // 内置项对应「命令注册表里的命令」，测试通过 mockRegistry 注入；
  // 非内置项才是落盘的实体（文件层只存自定义）。
  for (const t of init.tools || []) {
    if (t.builtin) mockRegistry.commands.push({ name: t.name, description: t.description })
    else mockFile.tools.push(t)
  }
  for (const g of init.groups || []) if (!g.builtin) mockFile.groups.push(g)
  for (const r of init.hintRules || []) if (!r.builtin) mockFile.hintRules.push(r)
  mockStore.data = { toolManagement: { tools: init.tools, groups: init.groups, hintRules: init.hintRules } }
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

  it('removeTool 删除并清理分组引用；builtin 不可真删，改为禁用', () => {
    const m2 = fresh({
      tools: [tool('ls', { builtin: true }), tool('custom')],
      groups: [group('g', 'G', ['custom', 'ls'])],
    })
    // 内置项不允许从表里消失（命令注册表仍有实现），但可被禁用
    expect(m2.removeTool('ls')).toBe(true)
    expect(m2.getTool('ls')).toBeTruthy()
    expect(m2.getTool('ls')!.enabled).toBe(false)
    // 自定义项正常删除，并从分组引用中清理
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
    // 名单含内置规则（来自默认模板），至少包含新增的自定义规则
    expect(m.getHintRule(r.id)).toBeDefined()
    expect(m.removeHintRule(r.id)).toBe(true)
    expect(m.getHintRule(r.id)).toBeUndefined()
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

describe('ToolManager — normalizeStore 历史脏数据规整', () => {
  it('启动读取时，逗号/换行分隔的 toolIds 被规整为数组', () => {
    const m = fresh({
      groups: [
        {
          id: 'g1', name: 'G', description: '', enabled: true, builtin: false, createdAt: 0,
          toolIds: 'ls, dir, cat',
        } as unknown as ToolGroup,
      ],
    })
    expect(m.getGroup('g1')!.toolIds).toEqual(['ls', 'dir', 'cat'])
  })

  it('启动读取时，tags / patterns / groupIds 字符串同样被规整', () => {
    const m = fresh({
      tools: [
        {
          id: 't1', name: 't1', displayName: 'T', description: '', usage: '/t1', platform: 'all',
          parameters: [], enabled: true, builtin: false, createdAt: 0, updatedAt: 0,
          tags: 'file, search',
        } as unknown as ToolDefinition,
      ],
      groups: [
        { id: 'g1', name: 'G', description: '', toolIds: ['ls'], enabled: true, builtin: false, createdAt: 0 },
      ],
      hintRules: [
        {
          id: 'r1', name: 'R', description: '', priority: 1, enabled: true, builtin: false, createdAt: 0,
          patterns: 'key1\nkey2', groupIds: 'g1',
        } as unknown as ToolHintRule,
      ],
    })
    expect(m.getTool('t1')!.tags).toEqual(['file', 'search'])
    expect(m.getHintRule('r1')!.patterns).toEqual(['key1', 'key2'])
    expect(m.getHintRule('r1')!.groupIds).toEqual(['g1'])
  })

  it('缺失数组字段时规整为空数组，不抛错', () => {
    const m = fresh({
      tools: [
        { id: 'x', name: 'x', displayName: 'X', description: '', usage: '/x', platform: 'all', enabled: true, builtin: false, createdAt: 0, updatedAt: 0 },
      ],
      groups: [{ id: 'g', name: 'g', description: '', enabled: true, builtin: false, createdAt: 0 }],
    })
    expect(m.getTool('x')!.tags).toEqual([])
    expect(m.getTool('x')!.parameters).toEqual([])
    expect(m.getGroup('g')!.toolIds).toEqual([])
    expect(() => m.getToolsInGroup('g')).not.toThrow()
  })
})

describe('ToolManager — 内置命令自定义（覆盖层）', () => {
  /** 造一个「内置命令」：注册进 mockRegistry，并带内置模板值 */
  const builtinLs = () => tool('ls', { builtin: true, description: '列出目录文件' })

  it('内置命令可编辑，改动写入覆盖层而非丢失', () => {
    const m = fresh({ tools: [builtinLs()] })
    expect(m.getTool('ls')!.description).toBe('列出目录文件')

    m.updateTool('ls', { description: '我改过的描述' })

    expect(m.getTool('ls')!.description).toBe('我改过的描述')
    // 覆盖层文件里应记下这次改动（内置项不再"改完就丢"）
    expect(mockFile.builtinTools.find(t => t.id === 'ls')?.description).toBe('我改过的描述')
  })

  it('内置命令的 template 可保存并透传', () => {
    const m = fresh({ tools: [builtinLs()] })
    m.updateTool('ls', { template: 'ls -la {args}' })
    expect(m.getTool('ls')!.template).toBe('ls -la {args}')
    expect(mockFile.builtinTools.find(t => t.id === 'ls')?.template).toBe('ls -la {args}')
  })

  it('内置命令禁用后仍可恢复为默认', () => {
    const m = fresh({ tools: [builtinLs()] })
    m.updateTool('ls', { description: '改过的' })
    expect(m.getTool('ls')!.description).toBe('改过的')

    expect(m.resetBuiltin('tool', 'ls')).toBe(true)
    // 回到内置模板值，且覆盖层文件被清除
    expect(m.getTool('ls')!.description).toBe('列出目录文件')
    expect(mockFile.builtinTools.find(t => t.id === 'ls')).toBeUndefined()
  })

  it('未被改动的内置项不写覆盖层（避免铺满磁盘）', () => {
    const m = fresh({ tools: [builtinLs()] })
    // 只读一遍数据，不产生任何持久化
    m.getAllTools()
    expect(mockFile.builtinTools).toHaveLength(0)
  })

  it('自定义命令仍能整体覆盖同 id 的内置命令', () => {
    const m = fresh({ tools: [builtinLs()] })
    m.addTool({
      name: 'ls', displayName: '我的 ls', description: '覆盖版', usage: '/ls',
      platform: 'all', parameters: [], tags: [], enabled: true,
    })
    expect(m.getTool('ls')!.description).toBe('覆盖版')
    expect(m.getTool('ls')!.builtin).toBe(false)
  })

  it('ensureToolFile 对内置项物化出可编辑文件', () => {
    const m = fresh({ tools: [builtinLs()] })
    const path = m.ensureToolFile('ls')
    expect(path).toBe('builtin/tools/ls.json')
    expect(mockFile.builtinTools.find(t => t.id === 'ls')).toBeTruthy()
  })

  it('resetToDefault 同时清掉内置覆盖层', () => {
    const m = fresh({ tools: [builtinLs()] })
    m.updateTool('ls', { description: '改过的' })
    expect(mockFile.builtinTools).toHaveLength(1)

    m.resetToDefault()
    expect(mockFile.builtinTools).toHaveLength(0)
    expect(m.getTool('ls')!.description).toBe('列出目录文件')
  })
})