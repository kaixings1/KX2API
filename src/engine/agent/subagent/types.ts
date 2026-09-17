/**
 * src/engine/agent/subagent/types.ts
 *
 * 子代理核心类型定义（从 D:\src\tools\AgentTool\ 移植并适配 K 体系）
 */

import type { Message, ContentBlock } from '../../api/client.ts'
import type { ApiConfig } from '../../api/client.ts'

/** 子代理定义 */
export interface AgentDefinition {
  agentType: string
  whenToUse: string
  tools?: string[]
  disallowedTools?: string[]
  maxTurns?: number
  model?: string
  permissionMode?: PermissionMode
  source: 'built-in' | 'plugin' | 'user'
  baseDir: string
  isolation?: 'local' | 'worktree'
  color?: string
  background?: boolean
  mcpServers?: string[] | Record<string, McpServerConfig>
  memory?: string
  getSystemPrompt?: (ctx: GetSystemPromptContext) => Promise<string>
}

export interface GetSystemPromptContext {
  toolUseContext: ToolUseContext
}

/** K 简化的子代理执行上下文 */
export interface SubagentContext {
  /** 父代理的 API 配置 */
  config: ApiConfig
  /** 工作目录 */
  cwd: string
  /** 可用工具列表 */
  availableTools: Tool[]
  /** 用户请求 */
  prompt: string
  /** 子代理类型 */
  agentType: string
  /** 是否异步执行 */
  isAsync: boolean
  /** 是否 fork 路径（继承父上下文） */
  isFork?: boolean
  /** 父代理消息历史（fork 路径用） */
  parentMessages?: Message[]
}

/** 子代理执行结果 */
export interface SubagentResult {
  success: boolean
  output: string
  /** 使用的 token 数（估算） */
  tokensUsed: number
  /** 工具调用次数 */
  toolUses: number
  /** 耗时（ms） */
  durationMs: number
  error?: string
}

/** 权限模式 */
export type PermissionMode = 'acceptEdits' | 'plan' | 'bubble' | 'bypassPermissions'

/** MCP 服务器配置（简化版） */
export interface McpServerConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  type?: 'connected' | 'pending' | 'failed'
}

/** 工具定义（K 简化版，适配 client.ts 的 ToolDefinition） */
export interface Tool {
  name: string
  description: string
  parameters?: Record<string, unknown>
  type?: string
  function?: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

// ==================== D:\src 类型兼容层 ====================

/** 子代理工具上下文 */
export interface ToolUseContext {
  requestId?: string
  tools: Tool[]
  model?: string
  abortController?: AbortController
}
