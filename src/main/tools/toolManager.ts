/**
 * Tool Manager
 * 管理工具定义、分组和提示规则
 * 从 commandRegistry 同步内置工具，支持自定义扩展
 * 内置分组和提示规则从 default-data.json 读取
 */

import type { ToolDefinition, ToolGroup, ToolHintRule, ToolManagementStore } from './types'
import { commandRegistry } from '../../engine/commands/registry'
import { toolFileStore, migrateCustomRulesFromStore } from './toolFileStore'
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

    // 内存 store = 内置(默认) + 自定义(文件)。自定义按 id 覆盖内置同名（编辑内置工具即覆盖）。
    const toolMap = new Map<string, ToolDefinition>()
    for (const t of base.tools) toolMap.set(t.id, t)
    for (const t of customTools) toolMap.set(t.id, t)
    const groups = [...base.groups]
    for (const g of customGroups) {
      const idx = groups.findIndex(x => x.id === g.id)
      if (idx >= 0) groups[idx] = g
      else groups.push(g)
    }
    const rules = [...base.hintRules]
    for (const r of customRules) {
      const idx = rules.findIndex(x => x.id === r.id)
      if (idx >= 0) rules[idx] = r
      else rules.push(r)
    }

    return this.normalizeStore({ tools: [...toolMap.values()], groups, hintRules: rules })
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
      // 文件化主存储：只对「非内置」实体写文件（builtin 来自模板，不落盘）。
      for (const t of this.store.tools) if (!t.builtin) toolFileStore.saveTool(t)
      for (const g of this.store.groups) if (!g.builtin) toolFileStore.saveGroup(g)
      for (const r of this.store.hintRules) if (!r.builtin) toolFileStore.saveHintRule(r)
      // 清理磁盘上已不存在的自定义文件（删除/移出等导致的内存空位）
      const toolIds = new Set(this.store.tools.filter(t => !t.builtin).map(t => t.id))
      const groupIds = new Set(this.store.groups.filter(g => !g.builtin).map(g => g.id))
      const ruleIds = new Set(this.store.hintRules.filter(r => !r.builtin).map(r => r.id))
      for (const id of toolFileStore.listTools().map(t => t.id)) if (!toolIds.has(id)) toolFileStore.deleteTool(id)
      for (const id of toolFileStore.listGroups().map(g => g.id)) if (!groupIds.has(id)) toolFileStore.deleteGroup(id)
      for (const id of toolFileStore.listHintRules().map(r => r.id)) if (!ruleIds.has(id)) toolFileStore.deleteHintRule(id)
    } catch { /* ignore */ }
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
    }
  }

  /**
   * 从 commandRegistry 同步工具定义
   */
  private syncFromRegistry(): ToolDefinition[] {
    const registryCommands = commandRegistry.getAll()
    return registryCommands.map((cmd, index) => ({
      id: cmd.name,
      name: cmd.name,
      displayName: cmd.name,
      description: cmd.description,
      usage: `/${cmd.name}`,
      platform: 'all' as const,
      parameters: [],
      tags: this.inferTags(cmd.name),
      enabled: true,
      builtin: true,
      createdAt: Date.now() - index,
      updatedAt: Date.now() - index,
    }))
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

  getTool(id: string): ToolDefinition | undefined {
    return this.store.tools.find(t => t.id === id)
  }

  addTool(tool: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt' | 'builtin'>): ToolDefinition {
    // 同名工具再次添加 = 覆盖更新（工具的 id 就是 name），不允许出现重复项
    const existingIdx = this.store.tools.findIndex(t => t.id === tool.name)
    if (existingIdx >= 0) {
      const existing = this.store.tools[existingIdx]
      this.store.tools[existingIdx] = {
        ...existing,
        ...tool,
        id: tool.name,
        parameters: tool.parameters || existing.parameters || [],
        updatedAt: Date.now(),
      }
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

  updateTool(id: string, updates: Partial<Omit<ToolDefinition, 'id' | 'builtin'>>): ToolDefinition | null {
    const idx = this.store.tools.findIndex(t => t.id === id)
    if (idx < 0) return null
    this.store.tools[idx] = { ...this.store.tools[idx], ...updates, updatedAt: Date.now() }
    this.saveStore()
    return this.store.tools[idx]
  }

  removeTool(id: string): boolean {
    const tool = this.store.tools.find(t => t.id === id)
    if (!tool || tool.builtin) return false
    this.store.tools = this.store.tools.filter(t => t.id !== id)
    // 从所有分组中移除
    for (const group of this.store.groups) {
      group.toolIds = group.toolIds.filter(tid => tid !== id)
    }
    this.saveStore()
    return true
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
