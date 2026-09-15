/**
 * Tool Collection
 * 工具集合管理模块
 * 参考 OpenManus 的 ToolCollection 设计，移植到 TypeScript
 */

export interface ToolResult {
  success: boolean
  output?: string
  error?: string
}

export interface Command {
  name: string
  description: string
  /** 工具分组，留空则属于 "default" 组 */
  group?: string
  execute: (args: string[]) => Promise<{ success: boolean; output?: string; error?: string }>
}

export class ToolCollection {
  private tools: Map<string, Command> = new Map()

  constructor(initialTools: Command[] = []) {
    for (const tool of initialTools) {
      this.tools.set(tool.name, tool)
    }
  }

  addTool(tool: Command): this {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolCollection] Tool "${tool.name}" already exists, skipping`)
      return this
    }
    this.tools.set(tool.name, tool)
    return this
  }

  addTools(...tools: Command[]): this {
    for (const tool of tools) {
      this.addTool(tool)
    }
    return this
  }

  getTool(name: string): Command | undefined {
    return this.tools.get(name)
  }

  hasTool(name: string): boolean {
    return this.tools.has(name)
  }

  getAllTools(): Command[] {
    return Array.from(this.tools.values())
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  getByGroup(group: string): Command[] {
    return Array.from(this.tools.values()).filter(c => (c as any).group === group || (!(c as any).group && group === 'default'))
  }

  getAllGroups(): string[] {
    const groups = new Set<string>()
    for (const c of Array.from(this.tools.values())) {
      groups.add((c as any).group || 'default')
    }
    return Array.from(groups)
  }

  /**
   * 按分组过滤工具。如果 enabledGroups 为空数组，则返回所有工具（默认行为）。
   * 传入选定的分组数组，只返回属于这些组的工具。
   */
  getFilteredTools(enabledGroups: string[]): Command[] {
    if (enabledGroups.length === 0) {
      return this.getAllTools()
    }
    const result: Command[] = []
    for (const tool of this.tools.values()) {
      const g = (tool as any).group || 'default'
      if (enabledGroups.includes(g)) {
        result.push(tool)
      }
    }
    return result
  }

  async execute(name: string, args: string[] = []): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `Unknown tool: /${name}` }
    }
    try {
      const result = await tool.execute(args)
      return {
        success: result.success,
        output: result.output,
        error: result.error,
      }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  async executeAll(): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    const allTools = this.tools.values()
    let tool = allTools.next()
    while (!tool.done) {
      try {
        const result = await tool.value.execute([])
        results.push({
          success: result.success,
          output: result.output,
          error: result.error,
        })
      } catch (e) {
        results.push({ success: false, error: (e as Error).message })
      }
      tool = allTools.next()
    }
    return results
  }

  /**
   * 从全局 commandRegistry 同步已有命令
   * 保持向后兼容：registry 中的命令自动进入 collection
   */
  async syncFromRegistry(): Promise<this> {
    const { commandRegistry } = await import('../../../engine/commands/registry.ts')
    const all = commandRegistry.getAll()
    for (let i = 0; i < all.length; i++) {
      const cmd = all[i]
      if (!this.tools.has(cmd.name)) {
        this.tools.set(cmd.name, cmd)
      }
    }
    return this
  }
}

/**
 * 全局工具集合实例
 * 启动时从 commandRegistry 异步同步，运行时可动态添加
 */
export const toolCollection = new ToolCollection()
