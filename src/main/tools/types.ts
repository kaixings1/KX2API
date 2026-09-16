/**
 * Tool Management Types
 * 工具定义、分组、提示规则
 */

/**
 * 风险等级 — 决定是否需要用户确认、能否被角色默认加载。
 *   readonly    只读，无副作用
 *   write       会写入文件/状态
 *   destructive 可能造成不可逆损失（删除、覆盖、重置）
 *   network     会发起对外网络请求
 */
export type ToolRisk = 'readonly' | 'write' | 'destructive' | 'network'

/**
 * 成本等级 — 用于 token/耗时预算下的淘汰排序。
 */
export type ToolCost = 'low' | 'medium' | 'high'

/**
 * 结构化标签集（对应 dev.txt §4 的七维标签体系）。
 *
 * 与旧版扁平 tags（如 ['file','unix']）并存：旧 tags 保留为自由标签，
 * 这里的分维字段用于检索、权限判定与默认加载决策。
 */
export interface ToolLabels {
  /** 角色：哪些 agent 角色默认能用，如 ['developer','verifier'] */
  roles?: string[]
  /** 目的：read / write / verify / deploy 等 */
  purposes?: string[]
  /** 能力域：fs / git / crypto / net 等 */
  domains?: string[]
  /** 成本 */
  cost?: ToolCost
  /** 环境：local / remote / k8s */
  env?: string[]
}

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
  /** 分类标签（自由标签，历史字段） */
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

  // ==================== dev.txt §3 规范字段 ====================

  /** 何时该用（写给模型看，显著降低误选率） */
  whenToUse?: string[]
  /** 何时不该用（同上，用于排除近义工具） */
  whenNotToUse?: string[]
  /**
   * 检索别名（3~10 个词），用于补上「工具名和描述里都没出现、但用户会这么问」的词。
   *
   * 例：工具名叫 notebook_edit，描述里写的是「修改 .ipynb 单元」，
   * 用户可能问「jupyter 怎么改」——把 jupyter 放进 searchHint 就能被搜到。
   * 参照 Claude Code ToolSearchTool 的 searchHint 设计。
   */
  searchHint?: string[]
  /** 结构化标签（七维），用于检索与权限 */
  labels?: ToolLabels
  /** 风险等级，默认按标签推断；高风险在角色配置里被 denied 时不可默认加载 */
  risk?: ToolRisk
  /** 成本等级 */
  cost?: ToolCost
  /** 语义化版本，用于版本漂移跟踪 */
  version?: string
  /** 是否常驻（L0 核心工具，始终进上下文，不参与 LRU 淘汰） */
  alwaysOn?: boolean
  /**
   * 输出是否必须结构化。
   * 现有命令多为纯文本输出，此处为过渡字段：为 true 表示输出应按 JSON 解析，
   * 解析失败则包装成 { raw: "..." }，保证下游拿到稳定结构。
   */
  structuredOutput?: boolean

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
 * 角色配置（dev.txt §4）— 决定某类 agent 默认加载哪些组、允许哪些组、禁用哪些标签。
 * 用途：
 *   - defaultGroups：会话启动时预加载（L2 直接进上下文）
 *   - allowedGroups：tool.load 时允许加载的上界
 *   - deniedTags：即使被显式加载也拒绝（如 risk:destructive）
 *   - deniedRisks：按风险等级拒绝，避免逐个标签写
 */
export interface ToolRole {
  id: string
  /** 显示名 */
  name: string
  /** 描述 */
  description: string
  /** 启动时默认加载的工具组 id */
  defaultGroups: string[]
  /** 允许加载的工具组 id（空 = 不限制） */
  allowedGroups: string[]
  /** 硬拒绝的标签（命中的工具即使显式加载也拒绝执行） */
  deniedTags: string[]
  /** 硬拒绝的风险等级 */
  deniedRisks: ToolRisk[]
  /** 活跃工具上限，超出按 LRU 淘汰 */
  maxActiveTools: number
  /** 是否内置 */
  builtin: boolean
  createdAt: number
}

/**
 * 工具管理存储结构
 */
export interface ToolManagementStore {
  tools: ToolDefinition[]
  groups: ToolGroup[]
  hintRules: ToolHintRule[]
  /** 角色配置（可选，缺失时用内置默认角色） */
  roles?: ToolRole[]
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
