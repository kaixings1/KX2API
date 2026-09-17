/**
 * MCP Service Module
 *
 * 职责：
 * - 管理 MCP server 配置的增删改查（复用 storeManager）
 * - 通过 toolCalling clientAdapters 获取标准化工具列表
 * - 测试 MCP server 连接
 */

import type { ChatCompletionRequest } from '../proxy/types.ts'
import type { NormalizedClientToolRequest, ToolClientAdapter } from '../proxy/toolCalling/clientAdapters/types.ts'
import { getToolClientAdapter, listToolClientAdapters } from '../proxy/toolCalling/clientAdapters/index.ts'
import { storeManager } from '../store/store.ts'

export interface McpServerConfig {
  id: string
  name: string
  type: 'stdio' | 'sse' | 'websocket'
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
  enabled: boolean
}

export interface McpServerWithTools extends McpServerConfig {
  tools: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
    clientAdapterId: string
    toolSource: 'openai' | 'mcp' | 'none'
  }>
}

export interface McpConnectionResult {
  connected: boolean
  tools: Array<{ name: string; description: string }>
  error?: string
}

export class McpService {
  /**
   * 获取所有 MCP server 配置
   */
  getServers(): McpServerConfig[] {
    try {
      const config = storeManager.getConfig() as Record<string, unknown>
      return (config.mcp?.servers || []) as McpServerConfig[]
    } catch {
      return []
    }
  }

  /**
   * 添加 MCP server
   */
  addServer(server: McpServerConfig): McpServerConfig {
    const config = storeManager.getConfig() as Record<string, unknown>
    const servers = [...((config.mcp?.servers || []) as McpServerConfig[]), server]
    storeManager.updateConfig({ mcp: { ...config.mcp, servers } } as Record<string, unknown>)
    return server
  }

  /**
   * 移除 MCP server
   */
  removeServer(serverId: string): void {
    const config = storeManager.getConfig() as Record<string, unknown>
    const servers = (config.mcp?.servers || []).filter((s: McpServerConfig) => s.id !== serverId)
    storeManager.updateConfig({ mcp: { ...config.mcp, servers } } as Record<string, unknown>)
  }

  /**
   * 更新 MCP server
   */
  updateServer(serverId: string, updates: Partial<McpServerConfig>): McpServerConfig | null {
    const config = storeManager.getConfig() as Record<string, unknown>
    const servers = (config.mcp?.servers || []).map((s: McpServerConfig) =>
      s.id === serverId ? { ...s, ...updates } : s
    )
    storeManager.updateConfig({ mcp: { ...config.mcp, servers } } as Record<string, unknown>)
    return servers.find((s: McpServerConfig) => s.id === serverId) || null
  }

  /**
   * 测试 MCP server 连接
   * 目前返回基本结果，后续可接入真实的 MCP client 通信
   */
  async testConnection(server: McpServerConfig): Promise<McpConnectionResult> {
    try {
      if (!server.enabled) {
        return { connected: false, tools: [], error: '服务器已禁用' }
      }

      // 基本配置校验
      if (server.type === 'stdio' && !server.command) {
        return { connected: false, tools: [], error: 'stdio 服务器缺少 command' }
      }
      if ((server.type === 'sse' || server.type === 'websocket') && !server.url) {
        return { connected: false, tools: [], error: 'Missing URL for remote server' }
      }

      // TODO: 接入真实的 MCP client 连接逻辑
      // 目前返回通过状态，实际连接测试需要在后续迭代中实现
      return {
        connected: true,
        tools: [],
      }
    } catch (e) {
      return {
        connected: false,
        tools: [],
        error: (e as Error).message,
      }
    }
  }

  /**
   * 获取所有 MCP server 的工具列表（标准化后）
   * 复用 toolCalling clientAdapters 对工具进行归一化
   */
  async getTools(serverId?: string): Promise<McpServerWithTools[]> {
    const servers = this.getServers()
    const targets = serverId
      ? servers.filter((s) => s.id === serverId && s.enabled)
      : servers.filter((s) => s.enabled)

    const results: McpServerWithTools[] = []

    for (const server of targets) {
      try {
        // 构造一个最小 request 用于工具发现
        const mockRequest: ChatCompletionRequest = {
          model: '',
          messages: [],
          tools: [],
          stream: false,
        }

        // 复用 clientAdapter 进行工具标准化
        const adapterId = server.type === 'stdio' ? 'standard-openai-tools' : 'standard-openai-tools'
        const adapter = getToolClientAdapter(adapterId)
        const normalized: NormalizedClientToolRequest = adapter.normalizeRequest(mockRequest)

        results.push({
          ...server,
          tools: normalized.tools.map((t) => ({
            name: t.name,
            description: t.description || '',
            inputSchema: t.parameters || {},
            clientAdapterId: normalized.clientAdapterId,
            toolSource: normalized.toolSource,
          })),
        })
      } catch (e) {
        results.push({
          ...server,
          tools: [],
        })
      }
    }

    return results
  }

  /**
   * 列出所有可用的 tool client adapters
   */
  getAvailableAdapters(): Array<{ id: string; displayName: string }> {
    return listToolClientAdapters().map((a) => ({
      id: a.id,
      displayName: a.displayName,
    }))
  }
}

/**
 * 全局 MCP 服务实例
 */
export const mcpService = new McpService()
export default mcpService
