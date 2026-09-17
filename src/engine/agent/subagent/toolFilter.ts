/**
 * src/engine/agent/subagent/toolFilter.ts
 *
 * 子代理工具过滤（从 D:\src\tools\AgentTool\agentToolUtils.ts 移植）
 *
 * K 适配：
 * - 移除 D:\src 强依赖（bun:bundle feature、zod/v4、appState）
 * - 简化工具过滤逻辑，保留核心语义
 */

import type { Tool, AgentDefinition } from './types.ts'

/** 所有代理通用的禁用工具列表 */
const ALL_AGENT_DISALLOWED_TOOLS = new Set<string>([
  'cancel',        // 取消当前任务
  'exit',          // 退出
])

/** 自定义代理（非 built-in）的额外禁用工具 */
const CUSTOM_AGENT_DISALLOWED_TOOLS = new Set<string>([
  'agent',         // 防止无限递归
  'spawnTeammate', // 防止队友嵌套
])

/** 异步代理允许的工具 */
const ASYNC_AGENT_ALLOWED_TOOLS = new Set<string>([
  'read_file',
  'write_file',
  'bash',
  'search',
  'ls',
  'glob',
  'grep',
  'read',
  'edit',
  'cancel',
])

/**
 * 根据上下文过滤工具池
 */
export function filterToolsForAgent({
  tools,
  isBuiltIn,
  isAsync = false,
  permissionMode,
}: {
  tools: Tool[]
  isBuiltIn: boolean
  isAsync?: boolean
  permissionMode?: string
}): Tool[] {
  return tools.filter((tool) => {
    // MCP 工具始终允许
    if (tool.name.startsWith('mcp__')) {
      return true
    }

    // 通用禁用列表
    if (ALL_AGENT_DISALLOWED_TOOLS.has(tool.name)) {
      return false
    }

    // 自定义代理额外禁用
    if (!isBuiltIn && CUSTOM_AGENT_DISALLOWED_TOOLS.has(tool.name)) {
      return false
    }

    // 异步模式限制工具
    if (isAsync) {
      if (ASYNC_AGENT_ALLOWED_TOOLS.has(tool.name)) {
        return true
      }
      // 允许 Agent 工具本身（用于嵌套子代理）
      if (tool.name === 'agent') {
        return true
      }
      return false
    }

    return true
  })
}

/**
 * 解析子代理的工具列表
 */
export function resolveAgentTools(
  agentDefinition: Pick<AgentDefinition, 'tools' | 'disallowedTools' | 'source'>,
  availableTools: Tool[],
  isAsync = false,
): {
  hasWildcard: boolean
  validTools: string[]
  invalidTools: string[]
  resolvedTools: Tool[]
} {
  const { tools: agentTools, disallowedTools, source } = agentDefinition

  // 过滤可用工具
  const filtered = filterToolsForAgent({
    tools: availableTools,
    isBuiltIn: source === 'built-in',
    isAsync,
  })

  // 应用禁用列表
  const disallowedSet = new Set(disallowedTools ?? [])
  const allowed = filtered.filter((t) => !disallowedSet.has(t.name))

  // 通配符：允许所有工具（在过滤禁用列表之后）
  const hasWildcard =
    agentTools === undefined ||
    (agentTools.length === 1 && agentTools[0] === '*')

  if (hasWildcard) {
    return {
      hasWildcard: true,
      validTools: [],
      invalidTools: [],
      resolvedTools: allowed,
    }
  }

  // 匹配指定工具
  const availableMap = new Map(allowed.map((t) => [t.name, t]))
  const validTools: string[] = []
  const invalidTools: string[] = []
  const resolved: Tool[] = []

  for (const spec of agentTools) {
    if (availableMap.has(spec)) {
      validTools.push(spec)
      resolved.push(availableMap.get(spec)!)
    } else {
      invalidTools.push(spec)
    }
  }

  return {
    hasWildcard: false,
    validTools,
    invalidTools,
    resolvedTools: resolved,
  }
}
