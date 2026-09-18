/**
 * engine/tools/types.ts — 工具 Schema 和权限上下文类型
 *
 * 实现 ToolInputJSONSchema、ToolPermissionContext、ToolUseContext 等类型。
 */

/** JSON Schema 属性 */
export interface JSONSchemaProperty {
  type?: string
  description?: string
  enum?: unknown[]
  default?: unknown
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  additionalProperties?: boolean | Record<string, JSONSchemaProperty>
}

/** 工具输入 JSON Schema */
export interface ToolInputJSONSchema {
  type: 'object'
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
  additionalProperties?: boolean
}

/** 工具权限规则 */
export interface ToolPermissionRule {
  tool?: string
  tag?: string
  allow?: boolean
}

/** 工具权限上下文 */
export interface ToolPermissionContext {
  source: 'user' | 'admin' | 'system'
  rules: ToolPermissionRule[]
  grantedTools: Set<string>
  deniedTools: Set<string>
  metadata: Record<string, unknown>
}

/** 空权限上下工厂函数 */
export function getEmptyToolPermissionContext(): ToolPermissionContext {
  return {
    source: 'system',
    rules: [],
    grantedTools: new Set(),
    deniedTools: new Set(),
    metadata: {},
  }
}

/** 工具定义（用于构建 Tool 对象的原始定义） */
export interface ToolDef {
  name: string
  description: string
  parameters: ToolInputJSONSchema
  execute: (input: unknown, context?: ToolUseContext) => Promise<ToolResult>
  alias?: string[]
  tags?: string[]
}

/** 工具结果 */
export interface ToolResult {
  success: boolean
  output?: unknown
  error?: string
}

/** 工具执行选项 */
export interface ToolExecutionOptions {
  timeout?: number
  retries?: number
}

/** 工具使用上下文 */
export interface ToolUseContext {
  options: ToolExecutionOptions
  abortController: AbortController
}
