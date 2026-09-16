/**
 * Tool Management Types
 * 工具定义、分组、提示规则
 */

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 唯一标识 */
  id: string
  /** 命令名称（不含 /） */
  name: string
  /** 显示名称 */
  displayName: string
  /** 详细描述 */
  description: string
  /** 用法示例 */
  usage: string
  /** 适用平台 */
  platform: 'windows' | 'unix' | 'all'
  /** 参数列表 */
  parameters: ToolParameter[]
  /** 分类标签 */
  tags: string[]
  /** 是否启用（勾选） */
  enabled: boolean
  /** 是否内置（不可删除；但可编辑/禁用，改动落在 builtin 覆盖层） */
  builtin: boolean
  /**
   * 声明式执行模板：仅对 exec / llm 类命令生效，用于在不改代码的前提下
   * 覆写命令的执行行为。
   *   - exec：shell 命令模板，支持 {cwd} {args} 占位符，走本地 shell 执行
   *   - llm ：提示词模板，支持 {input} {args} 占位符，交给模型执行
   * 留空则回落到代码内既有实现（impl.ts）。
   */
  template?: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  required: boolean
  description: string
  defaultValue?: string
}

/**
 * 工具分组
 */
export interface ToolGroup {
  /** 唯一标识 */
  id: string
  /** 组名称 */
  name: string
  /** 描述 */
  description: string
  /** 包含的工具 id 列表 */
  toolIds: string[]
  /** 是否启用 */
  enabled: boolean
  /** 是否内置 */
  builtin: boolean
  /** 创建时间 */
  createdAt: number
}

/**
 * 提示规则 — 根据上下文自动推荐工具组
 */
export interface ToolHintRule {
  /** 唯一标识 */
  id: string
  /** 规则名称 */
  name: string
  /** 描述 */
  description: string
  /** 匹配正则表达式（匹配用户输入或上下文） */
  patterns: string[]
  /** 匹配到后推荐的工具组 id 列表 */
  groupIds: string[]
  /** 优先级（数字越大越优先） */
  priority: number
  /** 是否启用 */
  enabled: boolean
  /** 是否内置 */
  builtin: boolean
  /** 创建时间 */
  createdAt: number
}

/**
 * 工具管理存储结构
 */
export interface ToolManagementStore {
  tools: ToolDefinition[]
  groups: ToolGroup[]
  hintRules: ToolHintRule[]
}

/**
 * 工具列表响应
 */
export interface ToolListResponse {
  success: boolean
  data?: {
    tools: ToolDefinition[]
    groups: ToolGroup[]
    hintRules: ToolHintRule[]
  }
  error?: string
}

/**
 * 工具分组响应
 */
export interface ToolGroupResponse {
  success: boolean
  data?: ToolGroup[]
  error?: string
}

/**
 * 提示规则响应
 */
export interface ToolHintRuleResponse {
  success: boolean
  data?: ToolHintRule[]
  error?: string
}
