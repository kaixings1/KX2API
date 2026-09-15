/**
 * Tool Manager
 * 管理工具定义、分组和提示规则
 * 从 commandRegistry 同步内置工具，支持自定义扩展
 */

import type { ToolDefinition, ToolGroup, ToolHintRule, ToolManagementStore } from './types'
import { commandRegistry } from '../../engine/commands/registry'
import { storeManager } from '../store/store'

const STORE_KEY = 'toolManagement'

// 内置分组
const BUILTIN_GROUPS: ToolGroup[] = [
  {
    id: 'file-system',
    name: '文件系统',
    description: '文件和目录操作工具',
    toolIds: ['ls', 'dir', 'tree', 'cat', 'pwd', 'find', 'findstr'],
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'text-search',
    name: '文本搜索',
    description: '在文件中搜索文本内容',
    toolIds: ['grep', 'findstr'],
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'execution',
    name: '代码执行',
    description: '执行代码片段',
    toolIds: ['python', 'python3', 'echo'],
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'git',
    name: 'Git 操作',
    description: 'Git 版本控制工具',
    toolIds: ['git-status', 'git-diff', 'git-log', 'git-branch'],
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'system',
    name: '系统信息',
    description: '系统环境信息查询',
    toolIds: ['env', 'ps', 'memory', 'date', 'whoami', 'where', 'version'],
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'ai-agent',
    name: 'AI 代理',
    description: '需要 AI 执行的复杂任务',
    toolIds: ['team', 'agents', 'agents-platform', 'auto', 'auto-commit', 'review', 'refactor', 'test', 'docs', 'fix', 'explain', 'analyze'],
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
]

// 内置提示规则
const BUILTIN_HINT_RULES: ToolHintRule[] = [
  {
    id: 'rule-file-browse',
    name: '文件浏览',
    description: '当用户询问文件内容或目录结构时推荐文件系统工具',
    patterns: ['查看.*文件', '目录.*结构', '文件.*列表', '文件.*内容', 'ls', 'dir', 'tree'],
    groupIds: ['file-system'],
    priority: 10,
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'rule-search',
    name: '文本搜索',
    description: '当用户需要搜索文本时推荐搜索工具',
    patterns: ['搜索', '查找.*内容', 'grep', 'findstr', '关键词'],
    groupIds: ['text-search', 'file-system'],
    priority: 10,
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'rule-git',
    name: 'Git 操作',
    description: '当用户询问代码变更时推荐 Git 工具',
    patterns: ['git', '提交', '分支', '差异', 'diff', 'commit', 'branch', '代码变更', '修改记录'],
    groupIds: ['git'],
    priority: 10,
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'rule-exec',
    name: '代码执行',
    description: '当用户需要运行代码时推荐执行工具',
    patterns: ['运行', '执行', 'python', 'print', '脚本'],
    groupIds: ['execution'],
    priority: 8,
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
  {
    id: 'rule-system',
    name: '系统信息',
    description: '当用户询问环境信息时推荐系统工具',
    patterns: ['环境变量', '进程', '内存', '系统', '版本', 'env', 'ps', 'memory'],
    groupIds: ['system'],
    priority: 8,
    enabled: true,
    builtin: true,
    createdAt: Date.now(),
  },
]

export class ToolManager {
  private store: ToolManagementStore

  constructor() {
    this.store = this.loadStore()
  }

  // ==================== 内部方法 ====================

  private loadStore(): ToolManagementStore {
    try {
      const raw = storeManager.getConfig()[STORE_KEY]
      if (raw && typeof raw === 'object') {
        return raw as ToolManagementStore
      }
    } catch { /* ignore */ }
    return this.createDefaultStore()
  }

  private saveStore(): void {
    try {
      const config = storeManager.getConfig()
      storeManager.updateConfig({ [STORE_KEY]: this.store } as Record<string, unknown>)
    } catch { /* ignore */ }
  }

  private createDefaultStore(): ToolManagementStore {
    // 从 commandRegistry 同步内置工具
    const builtinTools = this.syncFromRegistry()
    return {
      tools: builtinTools,
      groups: BUILTIN_GROUPS,
      hintRules: BUILTIN_HINT_RULES,
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
   * 重置为默认
   */
  resetToDefault(): void {
    this.store = this.createDefaultStore()
    this.saveStore()
  }
}

/**
 * 全局工具管理实例
 */
export const toolManager = new ToolManager()
export default toolManager
