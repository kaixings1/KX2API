/**
 * engine/plugin/toolPluginRegistry.ts — 工具插件注册表
 *
 * 将 src/tools/ 中的旧版工具封装为可选插件，支持配置化启用/禁用。
 * 吸收自 src2026/ 的插件化架构。
 */

import type { Tool } from '../toolScheduler.ts'

/** 单个工具插件的描述 */
export interface ToolPlugin {
  /** 插件 ID */
  id: string
  /** 插件名称 */
  name: string
  /** 插件描述 */
  description: string
  /** 对应的旧版工具目录（相对 src/） */
  legacyDir: string
  /** 是否默认启用 */
  enabledByDefault: boolean
  /** 是否按需加载 */
  lazy: boolean
  /** 工具定义列表（动态注册时使用） */
  toolDefinitions: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
  /** 插件加载函数（返回 Tool[] 或 Promise<Tool[]>） */
  load?: () => Tool[] | Promise<Tool[]>
  /** 插件卸载函数 */
  unload?: () => void
  /** 插件元数据 */
  meta?: Record<string, unknown>
}

/** 插件状态 */
export interface PluginStatus {
  id: string
  enabled: boolean
  loaded: boolean
  error?: string
}

class ToolPluginRegistry {
  private plugins = new Map<string, ToolPlugin>()
  private loadedPlugins = new Set<string>()
  private enabledPlugins = new Set<string>()
  private pluginTools = new Map<string, Tool[]>()

  /** 注册插件 */
  register(plugin: ToolPlugin): void {
    this.plugins.set(plugin.id, plugin)
    if (plugin.enabledByDefault) {
      this.enabledPlugins.add(plugin.id)
    }
  }

  /** 批量注册插件 */
  registerAll(plugins: ToolPlugin[]): void {
    for (const p of plugins) {
      this.register(p)
    }
  }

  /** 获取所有插件 */
  getAll(): ToolPlugin[] {
    return Array.from(this.plugins.values())
  }

  /** 获取插件状态 */
  getStatus(id: string): PluginStatus | undefined {
    const plugin = this.plugins.get(id)
    if (!plugin) return undefined
    return {
      id,
      enabled: this.enabledPlugins.has(id),
      loaded: this.loadedPlugins.has(id),
    }
  }

  /** 获取所有插件状态 */
  getAllStatus(): PluginStatus[] {
    return this.getAll().map(p => this.getStatus(p.id)!)
  }

  /** 启用插件 */
  enable(id: string): boolean {
    const plugin = this.plugins.get(id)
    if (!plugin) return false
    this.enabledPlugins.add(id)
    return true
  }

  /** 禁用插件 */
  disable(id: string): boolean {
    const plugin = this.plugins.get(id)
    if (!plugin) return false
    this.enabledPlugins.delete(id)
    if (plugin.unload && this.loadedPlugins.has(id)) {
      plugin.unload()
      this.loadedPlugins.delete(id)
      this.pluginTools.delete(id)
    }
    return true
  }

  /** 启用插件列表 */
  enableMany(ids: string[]): void {
    for (const id of ids) {
      this.enable(id)
    }
  }

  /** 获取启用的插件 */
  getEnabled(): ToolPlugin[] {
    return this.getAll().filter(p => this.enabledPlugins.has(p.id))
  }

  /** 获取禁用的插件 */
  getDisabled(): ToolPlugin[] {
    return this.getAll().filter(p => !this.enabledPlugins.has(p.id))
  }

  /** 检查插件是否启用 */
  isEnabled(id: string): boolean {
    return this.enabledPlugins.has(id)
  }

  /** 加载插件（返回工具定义） */
  async loadPlugin(id: string): Promise<Tool[]> {
    const plugin = this.plugins.get(id)
    if (!plugin) return []
    if (this.loadedPlugins.has(id)) {
      return this.pluginTools.get(id) ?? []
    }
    if (!this.enabledPlugins.has(id)) {
      return []
    }

    try {
      let tools: Tool[] = []
      if (plugin.load) {
        tools = await plugin.load()
      }
      this.loadedPlugins.add(id)
      this.pluginTools.set(id, tools)
      return tools
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error(`[Plugin] Failed to load ${id}:`, error)
      return []
    }
  }

  /** 加载所有启用的非 lazy 插件 */
  async loadEagerPlugins(): Promise<Tool[]> {
    const results: Tool[] = []
    for (const plugin of this.getEnabled()) {
      if (!plugin.lazy) {
        const tools = await this.loadPlugin(plugin.id)
        results.push(...tools)
      }
    }
    return results
  }

  /** 获取工具定义（用于构建 system prompt） */
  getToolDefinitions(): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
    const defs: Array<{ name: string; description: string; parameters: Record<string, unknown> }> = []
    for (const plugin of this.getEnabled()) {
      for (const td of plugin.toolDefinitions) {
        defs.push(td)
      }
    }
    return defs
  }
}

/** 全局插件注册表 */
export const toolPluginRegistry = new ToolPluginRegistry()
