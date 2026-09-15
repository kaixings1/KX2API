// ==================== Tool Types ====================

export interface ToolParameter {
  name: string
  type: string
  description?: string
  required?: boolean
  default?: any
  enum?: string[]
}

export interface ToolDef {
  id: string
  name: string
  displayName: string
  description: string
  usage: string
  platform: string
  parameters?: ToolParameter[]
  tags: string[]
  enabled: boolean
  builtin: boolean
}

export interface ToolGroup {
  id: string
  name: string
  description: string
  toolIds: string[]
  enabled: boolean
  builtin: boolean
}

export interface HintRule {
  id: string
  name: string
  description: string
  patterns: string[]
  groupIds: string[]
  priority: number
  enabled: boolean
  builtin: boolean
}

// ==================== MCP Types ====================

export interface McpServerConfig {
  id: string
  name: string
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  transport: 'stdio' | 'sse' | 'http'
  enabled: boolean
  headers?: Record<string, string>
}

// ==================== Prompt Types ====================

export type PromptType = 'general' | 'tool-use' | 'agent' | 'translation' | 'search'

export interface SystemPrompt {
  id: string
  name: string
  description: string
  prompt: string
  type: PromptType
  emoji?: string
  isBuiltin: boolean
  groups?: string[]
  createdAt: string
}
