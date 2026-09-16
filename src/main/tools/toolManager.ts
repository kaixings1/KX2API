/**
 * Tool Manager
 * 管理工具定义、分组和提示规则
 * 从 commandRegistry 同步内置工具，支持自定义扩展
 * 内置分组和提示规则从 default-data.json 读取
 */

import type { ToolDefinition, ToolGroup, ToolHintRule, ToolManagementStore, ToolRole } from './types'
import { commandRegistry } from '../../engine/commands/registry'
import { toolFileStore, migrateCustomRulesFromStore } from './toolFileStore'
import { defaultRoles, resolveRole } from './toolRoles'
import { normalizeToolLabels } from './toolLabels'
import { join } from 'path'
import { readFileSync, existsSync } from 'node:fs'

// 从默认数据文件加载内置分组
function loadDefaultGroups(): ToolGroup[] {
  try {
    const dataPath = join(__dirname, 'default-data.json')
    if (!existsSync(dataPath)) {
      console.warn('[ToolManager] default-data.json not found, returning empty groups')
      return []
    }
    const raw = readFileSync(dataPath, 'utf-8')
    const data = JSON.parse(raw)
    const now = Date.now()
    return (data.groups || []).map((g: ToolGroup) => ({
      ...g,
      createdAt: g.createdAt || now,
    }))
  } catch (e) {
    console.error('[ToolManager] load default groups failed:', e)
    return []
  }
}

// 从默认数据文件加载内置提示规则
function loadDefaultHintRules(): ToolHintRule[] {
  try {
    const dataPath = join(__dirname, 'default-data.json')
    if (!existsSync(dataPath)) {
      console.warn('[ToolManager] default-data.json not found, returning empty hint rules')
      return []
    }
    const raw = readFileSync(dataPath, 'utf-8')
    const data = JSON.parse(raw)
    const now = Date.now()
    return (data.hintRules || []).map((r: ToolHintRule) => ({
      ...r,
      createdAt: r.createdAt || now,
    }))
  } catch (e) {
    console.error('[ToolManager] load default hint rules failed:', e)
    return []
  }
}

/**
 * 取出「参与内置差异比较」的字段并序列化。
 * 排除 id / builtin（结构性字段）与 createdAt / updatedAt（系统时间戳，
 * 每次加载都会不同，纳入比较会导致内置项被误判为「已改动」而写入覆盖层）。
 */
function comparableFields(entity: object): string {
  const skip = new Set(['id', 'builtin', 'createdAt', 'updatedAt'])
  const entries = Object.entries(entity as Record<string, unknown>)
    .filter(([k]) => !skip.has(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return JSON.stringify(entries)
}

export class ToolManager {
  private store: ToolManagementStore

  constructor() {
    // 注意：模块被 import 时 storeManager 可能尚未初始化（main 进程在
    // registerIpcHandlers 内才 `await storeManager.initialize()`，而本单例在
    // handlers.ts 顶层 import 时即构造）。此时 getConfig() 会因 store 未就绪
    // 抛错，loadStore() 只能回退到默认空 store —— 这正是「保存的分组重启后
    // 丢失」的根因：数据已落盘，但单例没读到。因此构造时先空 store 兜底，
    // 待 store 就绪后由 reload() 重新从磁盘加载真实数据。
    this.store = this.createDefaultStore()
    this.reload()
  }

  /**
   * 重新从磁盘（storeManager）读取工具数据。
   * store 就绪前调用会静默维持当前 store（构造时的兜底），不会抛错；
   * store 就绪后调用会把磁盘上真实保存的分组/工具读进来，覆盖内存空值。
   */
  reload(): void {
    try {
      const loaded = this.loadStore()
      // 只在校验通过（读到真实对象）时替换，避免默认兜底又覆盖真实数据
      if (loaded && typeof loaded === 'object') {
        this.store = loaded
      }
    } catch { /* store 未就绪时保持兜底 store，等下一次 reload */ }
  }

  // ==================== 内部方法 ====================

  private loadStore(): ToolManagementStore {
    // 文件化主存储：自定义（builtin=false）实体从 tools/groups/hintRules 目录读取，
    // 内置实体来自 default-data.json 模板 + commandRegistry 同步。
    const base = this.createDefaultStore()
    // 首次启动时把 electron-store 里遗留的自定义数据迁移到文件目录
    try { migrateCustomRulesFromStore() } catch { /* 迁移失败不阻塞 */ }

    const customTools = toolFileStore.listTools()
    const customGroups = toolFileStore.listGroups()
    const customRules = toolFileStore.listHintRules()

    // 内置覆盖层：用户对内置项的改动（仅存改过的，按 id 覆盖回内置模板）。
    const builtinToolOverrides = toolFileStore.listBuiltinTools()
    const builtinGroupOverrides = toolFileStore.listBuiltinGroups()
    const builtinRuleOverrides = toolFileStore.listBuiltinHintRules()

    // 合并顺序（后者覆盖前者）：
    //   内置模板 → 内置覆盖层（用户改的内置项）→ 自定义实体（用户自建）
    // 这样自定义实体仍可整体覆盖同 id 的内置项（等价「接管」该命令）。
    const toolMap = new Map<string, ToolDefinition>()
    for (const t of base.tools) toolMap.set(t.id, t)
    for (const t of builtinToolOverrides) {
      const prev = toolMap.get(t.id)
      toolMap.set(t.id, prev ? { ...prev, ...t } : t)
    }
    for (const t of customTools) toolMap.set(t.id, t)

    const mergeById = <T extends { id: string }>(list: T[], overrides: T[]): T[] => {
      const out = [...list]
      for (const o of overrides) {
        const idx = out.findIndex(x => x.id === o.id)
        if (idx >= 0) out[idx] = { ...out[idx], ...o }
        else out.push(o)
      }
      return out
    }
    const groups = mergeById(base.groups, builtinGroupOverrides)
    for (const g of customGroups) {
      const idx = groups.findIndex(x => x.id === g.id)
      if (idx >= 0) groups[idx] = g
      else groups.push(g)
    }
    const rules = mergeById(base.hintRules, builtinRuleOverrides)
    for (const r of customRules) {
      const idx = rules.findIndex(x => x.id === r.id)
      if (idx >= 0) rules[idx] = r
      else rules.push(r)
    }

    // 角色：内置默认 + 用户改过的（roles/ 目录文件按 id 覆盖）
    const customRoles = toolFileStore.listRoles()
    const roles = mergeById(base.roles || defaultRoles(), customRoles)

    return this.normalizeStore({ tools: [...toolMap.values()], groups, hintRules: rules, roles })
  }

  /**
   * 规整化持久化的工具存储数据，确保 tags / toolIds / patterns / groupIds
   * 等数组字段始终为数组（parameters 缺省时为 []），避免历史遗留的逗号分隔
   * 字符串或缺失值导致渲染端调用 .map() 崩溃。
   */
  private normalizeStore(store: ToolManagementStore): ToolManagementStore {
    const toArray = (value: unknown): string[] => {
      if (Array.isArray(value)) return value
      if (typeof value === 'string' && value.trim() !== '') {
        return value.split(/[,，\n]/).map(s => s.trim()).filter(Boolean)
      }
      return []
    }

    const tools = (store.tools || [])
      .filter(t => t && typeof t === 'object')
      .map(t => ({
        ...t,
        tags: toArray(t.tags),
        parameters: Array.isArray(t.parameters) ? t.parameters : [],
      }))

    const groups = (store.groups || [])
      .filter(g => g && typeof g === 'object')
      .map(g => ({ ...g, toolIds: toArray(g.toolIds) }))

    const hintRules = (store.hintRules || [])
      .filter(r => r && typeof r === 'object')
      .map(r => ({ ...r, patterns: toArray(r.patterns), groupIds: toArray(r.groupIds) }))

    return { tools, groups, hintRules }
  }

  private saveStore(): void {
    try {
      // 文件化主存储，分两层落盘：
      //   - 自定义实体（builtin=false）→ tools/groups/hintRules/ 下的 <id>.json
      //   - 内置覆盖项（builtin=true 且被改过）→ builtin/<kind>/ 下的 <id>.json
      // 内置项不整体复制：只有「与内置模板不同」的才写覆盖层，避免磁盘铺满
      // 几百个文件、也避免内置模板升级后被旧副本顶掉。
      for (const t of this.store.tools) {
        if (t.builtin) {
          if (this.differsFromBuiltin(t.id, t)) toolFileStore.saveBuiltinTool(t)
        } else {
          toolFileStore.saveTool(t)
        }
      }
      for (const g of this.store.groups) {
        if (g.builtin) {
          if (this.differsFromBuiltin(g.id, g)) toolFileStore.saveBuiltinGroup(g)
        } else {
          toolFileStore.saveGroup(g)
        }
      }
      for (const r of this.store.hintRules) {
        if (r.builtin) {
          if (this.differsFromBuiltin(r.id, r)) toolFileStore.saveBuiltinHintRule(r)
        } else {
          toolFileStore.saveHintRule(r)
        }
      }
      // 角色配置：内置角色改动后落盘（与内置项同样只在「有差异」时写）
      for (const role of this.store.roles || []) {
        if (this.differsFromBuiltin(role.id, role)) toolFileStore.saveRole(role)
      }
      // 清理磁盘上已不存在的自定义文件（删除/移出等导致的内存空位）
      const toolIds = new Set(this.store.tools.filter(t => !t.builtin).map(t => t.id))
      const groupIds = new Set(this.store.groups.filter(g => !g.builtin).map(g => g.id))
      const ruleIds = new Set(this.store.hintRules.filter(r => !r.builtin).map(r => r.id))
      for (const id of toolFileStore.listTools().map(t => t.id)) if (!toolIds.has(id)) toolFileStore.deleteTool(id)
      for (const id of toolFileStore.listGroups().map(g => g.id)) if (!groupIds.has(id)) toolFileStore.deleteGroup(id)
      for (const id of toolFileStore.listHintRules().map(r => r.id)) if (!ruleIds.has(id)) toolFileStore.deleteHintRule(id)
    } catch { /* ignore */ }
  }

  /**
   * 判断一个内置实体是否已被用户改动（相对内置模板）。
   * 只比较可编辑字段；createdAt/updatedAt 属于系统字段不参与判断，
   * 否则每次加载都会因时间戳漂移而误写覆盖层文件。
   */
  private differsFromBuiltin(id: string, entity: { id: string }): boolean {
    const base = this.createDefaultStore()
    const toolList = base.tools as unknown as { id: string }[]
    const groupList = base.groups as unknown as { id: string }[]
    const ruleList = base.hintRules as unknown as { id: string }[]
    const roleList = (base.roles || defaultRoles()) as unknown as { id: string }[]
    const list: { id: string }[] =
      toolList.some(x => x.id === id) ? base.tools
        : groupList.some(x => x.id === id) ? base.groups
          : ruleList.some(x => x.id === id) ? base.hintRules
            : roleList
    const origin = (list as { id: string }[]).find(x => x.id === id)
    if (!origin) return false
    return comparableFields(entity) !== comparableFields(origin)
  }

  private createDefaultStore(): ToolManagementStore {
    // 从 commandRegistry 同步内置工具
    const builtinTools = this.syncFromRegistry()
    const builtinGroups = loadDefaultGroups()
    const builtinHintRules = loadDefaultHintRules()
    return {
      tools: builtinTools,
      groups: builtinGroups,
      hintRules: builtinHintRules,
      roles: defaultRoles(),
    }
  }

  /**
   * 从 commandRegistry 同步工具定义
   */
  private syncFromRegistry(): ToolDefinition[] {
    const registryCommands = commandRegistry.getAll()
    return registryCommands.map((cmd, index) => {
      const tags = this.inferTags(cmd.name)
      // dev.txt §4：补齐七维标签与风险/成本，供检索、权限与默认加载决策使用。
      // 这里只做「推导」，用户显式设置的值会在 loadStore 合并覆盖层时优先。
      const { labels, risk, cost } = normalizeToolLabels({ name: cmd.name, tags })
      const isMeta = (cmd as { group?: string }).group === 'meta'
      return {
        id: cmd.name,
        name: cmd.name,
        displayName: cmd.name,
        description: cmd.description,
        usage: `/${cmd.name}`,
        platform: 'all' as const,
        parameters: [],
        tags,
        enabled: true,
        builtin: true,
        labels,
        risk: isMeta ? 'readonly' as const : risk,
        cost: isMeta ? 'low' as const : cost,
        version: '1.0.0',
        // 元工具（tool_search/load/...）是 L0 常驻核心，不可被 LRU 淘汰
        alwaysOn: isMeta,
        createdAt: Date.now() - index,
        updatedAt: Date.now() - index,
      }
    })
  }

  private inferTags(name: string): string[] {
    const tagMap: Record<string, string[]> = {
      'ls': ['file', 'unix'], 'dir': ['file', 'windows'],
      'tree': ['file'], 'cat': ['file'], 'pwd': ['file'],
      'find': ['file', 'search'], 'findstr': ['file', 'search', 'windows'],
      'grep': ['search'], 'python': ['exec', 'code'], 'python3': ['exec', 'code'],
      'echo': ['exec'], 'git-status': ['git'], 'git-diff': ['git'],
      'git-log': ['git'], 'git-branch': ['git'],
      'env': ['system'], 'ps': ['system'], 'memory': ['system'],
      'date': ['system'], 'whoami': ['system'], 'where': ['system'],
      'help': ['utility'], 'clear': ['utility'], 'new': ['utility'],
      'version': ['system'], 'stats': ['system'], 'config': ['system'], 'model': ['system'],
      'test-tools': ['dev'], 'team': ['ai'],
      'login': ['profile'], 'profiles': ['profile'],
      'add-profile': ['profile'], 'del-profile': ['profile'],
    }
    return tagMap[name] || ['other']
  }

  // ==================== 工具 CRUD ====================

  getAllTools(): ToolDefinition[] {
    return [...this.store.tools]
  }

  /** 全部角色配置（缺失时回落到内置默认角色，保证调用方总能拿到可用配置） */
  getAllRoles(): ToolRole[] {
    const roles = this.store.roles
    return roles && roles.length > 0 ? [...roles] : defaultRoles()
  }

  /** 按 id 取角色，未命中返回 default */
  getRole(id: string): ToolRole {
    return resolveRole(this.getAllRoles(), id)
  }

  /**
   * 更新角色配置。
   * 角色目前只有内置默认值（无文件持久化），更新落在内存 store，
   * 由 saveStore 决定是否落盘——角色属于用户配置，改动即写覆盖层。
   */
  updateRole(id: string, updates: Partial<Omit<ToolRole, 'id' | 'createdAt'>>): ToolRole | null {
    const roles = this.store.roles && this.store.roles.length > 0 ? this.store.roles : defaultRoles()
    const idx = roles.findIndex(r => r.id === id)
    if (idx < 0) return null
    roles[idx] = { ...roles[idx], ...updates }
    this.store.roles = roles
    this.saveStore()
    return roles[idx]
  }

  getTool(id: string): ToolDefinition | undefined {
    return this.store.tools.find(t => t.id === id)
  }

  addTool(tool: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt' | 'builtin'>): ToolDefinition {
    // 同名工具再次添加 = 覆盖更新（工具的 id 就是 name），不允许出现重复项
    const existingIdx = this.store.tools.findIndex(t => t.id === tool.name)
    if (existingIdx >= 0) {
      const existing = this.store.tools[existingIdx]
      const wasBuiltin = existing.builtin
      this.store.tools[existingIdx] = {
        ...existing,
        ...tool,
        id: tool.name,
        parameters: tool.parameters || existing.parameters || [],
        // 同名添加视为「用自定义命令接管该命令」：脱离内置身份，
        // 之后它按自定义实体落盘（而非写进内置覆盖层）。
        builtin: false,
        updatedAt: Date.now(),
      }
      // 原来是内置项的话，其覆盖层已无意义，清掉避免残留在 builtin/ 目录
      if (wasBuiltin) toolFileStore.deleteBuiltinTool(tool.name)
      this.saveStore()
      return this.store.tools[existingIdx]
    }
    const newTool: ToolDefinition = {
      ...tool,
      parameters: tool.parameters || [],
      id: tool.name,
      builtin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.store.tools.push(newTool)
    this.saveStore()
    return newTool
  }

  /**
   * 更新工具。内置工具同样可编辑（描述 / 用法 / 参数 / 标签 / 启用状态 /
   * 执行模板），改动由 saveStore 写进内置覆盖层，可随时 resetTool 还原。
   */
  updateTool(id: string, updates: Partial<Omit<ToolDefinition, 'id' | 'builtin'>>): ToolDefinition | null {
    const idx = this.store.tools.findIndex(t => t.id === id)
    if (idx < 0) return null
    this.store.tools[idx] = { ...this.store.tools[idx], ...updates, updatedAt: Date.now() }
    this.saveStore()
    return this.store.tools[idx]
  }

  /**
   * 删除工具。
   * 内置工具不允许真正删除（它是命令注册表的一部分，删了就没有实现可跑），
   * 但允许「禁用」——语义上等价于从可用列表移除，且可随时恢复。
   */
  removeTool(id: string): boolean {
    const tool = this.store.tools.find(t => t.id === id)
    if (!tool) return false
    if (tool.builtin) {
      tool.enabled = false
      tool.updatedAt = Date.now()
      this.saveStore()
      return true
    }
    this.store.tools = this.store.tools.filter(t => t.id !== id)
    // 从所有分组中移除
    for (const group of this.store.groups) {
      group.toolIds = group.toolIds.filter(tid => tid !== id)
    }
    this.saveStore()
    return true
  }

  /**
   * 把某个内置实体恢复成内置默认：
   * 删掉它的覆盖层文件，再用模板值重置内存中的对应项。
   */
  resetBuiltin(kind: 'tool' | 'group' | 'hintRule', id: string): boolean {
    const base = this.createDefaultStore()
    if (kind === 'tool') {
      const idx = this.store.tools.findIndex(t => t.id === id)
      if (idx < 0) return false
      const origin = base.tools.find(t => t.id === id)
      if (!origin) return false
      this.store.tools[idx] = { ...origin, updatedAt: Date.now() }
      toolFileStore.deleteBuiltinTool(id)
    } else if (kind === 'group') {
      const idx = this.store.groups.findIndex(g => g.id === id)
      if (idx < 0) return false
      const origin = base.groups.find(g => g.id === id)
      if (!origin) return false
      this.store.groups[idx] = { ...origin }
      toolFileStore.deleteBuiltinGroup(id)
    } else {
      const idx = this.store.hintRules.findIndex(r => r.id === id)
      if (idx < 0) return false
      const origin = base.hintRules.find(r => r.id === id)
      if (!origin) return false
      this.store.hintRules[idx] = { ...origin }
      toolFileStore.deleteBuiltinHintRule(id)
    }
    return true
  }

  /**
   * 确保某工具在磁盘上有可编辑文件，返回其 JSON 路径。
   * 用户没改过的内置项磁盘上本来没有文件，打开前先按当前生效值物化一份，
   * 避免「点击打开」时拿到空文件或报路径不存在。
   */
  ensureToolFile(id: string): string | null {
    const tool = this.store.tools.find(t => t.id === id)
    if (!tool) return null
    if (tool.builtin) {
      // 内置项：物化到覆盖层目录（已存在则不覆盖，保住用户改动）
      toolFileStore.materializeBuiltin('tools', id, tool as unknown as Record<string, unknown>)
      return toolFileStore.builtinPathOf('tools', id)
    }
    // 自定义项：写回它自己的文件，路径在 tools/ 而非 builtin/tools/
    toolFileStore.saveTool(tool)
    return toolFileStore.customPathOf('tools', id)
  }

  toggleTool(id: string): ToolDefinition | null {
    const tool = this.getTool(id)
    if (!tool) return null
    tool.enabled = !tool.enabled
    tool.updatedAt = Date.now()
    this.saveStore()
    return tool
  }

  // ==================== 分组 CRUD ====================

  getAllGroups(): ToolGroup[] {
    return [...this.store.groups]
  }

  getGroup(id: string): ToolGroup | undefined {
    return this.store.groups.find(g => g.id === id)
  }

  getToolsInGroup(groupId: string): ToolDefinition[] {
    const group = this.getGroup(groupId)
    if (!group) return []
    return group.toolIds.map(id => this.getTool(id)).filter((t): t is ToolDefinition => !!t)
  }

  addGroup(group: Omit<ToolGroup, 'id' | 'createdAt' | 'builtin'>): ToolGroup {
    const newGroup: ToolGroup = {
      ...group,
      id: 'group-' + Date.now(),
      builtin: false,
      createdAt: Date.now(),
    }
    this.store.groups.push(newGroup)
    this.saveStore()
    return newGroup
  }

  updateGroup(id: string, updates: Partial<Omit<ToolGroup, 'id' | 'builtin'>>): ToolGroup | null {
    const idx = this.store.groups.findIndex(g => g.id === id)
    if (idx < 0) return null
    this.store.groups[idx] = { ...this.store.groups[idx], ...updates }
    this.saveStore()
    return this.store.groups[idx]
  }

  removeGroup(id: string): boolean {
    const group = this.getGroup(id)
    if (!group || group.builtin) return false
    this.store.groups = this.store.groups.filter(g => g.id !== id)
    this.saveStore()
    return true
  }

  addToolToGroup(toolId: string, groupId: string): boolean {
    const group = this.getGroup(groupId)
    if (!group || group.toolIds.includes(toolId)) return false
    group.toolIds.push(toolId)
    this.saveStore()
    return true
  }

  removeToolFromGroup(toolId: string, groupId: string): boolean {
    const group = this.getGroup(groupId)
    if (!group) return false
    group.toolIds = group.toolIds.filter(id => id !== toolId)
    this.saveStore()
    return true
  }

  // ==================== 提示规则 CRUD ====================

  getAllHintRules(): ToolHintRule[] {
    return [...this.store.hintRules]
  }

  getHintRule(id: string): ToolHintRule | undefined {
    return this.store.hintRules.find(r => r.id === id)
  }

  addHintRule(rule: Omit<ToolHintRule, 'id' | 'createdAt' | 'builtin'>): ToolHintRule {
    const newRule: ToolHintRule = {
      ...rule,
      id: 'rule-' + Date.now(),
      builtin: false,
      createdAt: Date.now(),
    }
    this.store.hintRules.push(newRule)
    this.saveStore()
    return newRule
  }

  updateHintRule(id: string, updates: Partial<Omit<ToolHintRule, 'id' | 'builtin'>>): ToolHintRule | null {
    const idx = this.store.hintRules.findIndex(r => r.id === id)
    if (idx < 0) return null
    this.store.hintRules[idx] = { ...this.store.hintRules[idx], ...updates }
    this.saveStore()
    return this.store.hintRules[idx]
  }

  removeHintRule(id: string): boolean {
    const rule = this.getHintRule(id)
    if (!rule || rule.builtin) return false
    this.store.hintRules = this.store.hintRules.filter(r => r.id !== id)
    this.saveStore()
    return true
  }

  // ==================== 提示匹配 ====================

  /**
   * 根据用户输入匹配提示规则，返回推荐的工具组
   */
  matchHintRules(input: string): ToolGroup[] {
    const matchedGroups: { group: ToolGroup; priority: number }[] = []

    for (const rule of this.store.hintRules) {
      if (!rule.enabled) continue

      const matched = rule.patterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i')
          return regex.test(input)
        } catch {
          return input.toLowerCase().includes(pattern.toLowerCase())
        }
      })

      if (matched) {
        for (const gid of rule.groupIds) {
          const group = this.getGroup(gid)
          if (group && group.enabled) {
            matchedGroups.push({ group, priority: rule.priority })
          }
        }
      }
    }

    // 按优先级排序，去重
    const seen = new Set<string>()
    return matchedGroups
      .sort((a, b) => b.priority - a.priority)
      .map(m => m.group)
      .filter(g => {
        if (seen.has(g.id)) return false
        seen.add(g.id)
        return true
      })
  }

  /**
   * 获取当前生效的工具列表（根据启用状态过滤）
   */
  getEnabledTools(): ToolDefinition[] {
    return this.store.tools.filter(t => t.enabled)
  }

  /**
   * 重置为默认（清空所有自定义工具/分组/规则，恢复到内置模板）
   */
  resetToDefault(): void {
    this.store = this.createDefaultStore()
    // 清空文件目录里的自定义实体，只保留内置模板
    toolFileStore.resetAll()
  }
}

/**
 * 全局工具管理实例
 */
export const toolManager = new ToolManager()
export default toolManager
