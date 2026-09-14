/**
 * engine/toolGroups.ts — 工具分组定义
 *
 * 将工具按功能分组，便于配置化启用/禁用，优化 token 消耗。
 * 吸收 src/tools/ 中的成熟工具实现，作为可选插件保留。
 */

/** 工具分组定义 */
export interface ToolGroup {
  /** 分组 ID（用于配置） */
  id: string
  /** 分组名称 */
  name: string
  /** 分组描述 */
  description: string
  /** 是否默认启用 */
  enabledByDefault: boolean
  /** 该分组下的工具定义（静态注册时使用） */
  tools: ToolDefinition[]
  /** 该分组对应的旧版工具目录（用于动态加载） */
  legacyDir?: string
  /** 是否按需加载（不加载时不占用 token） */
  lazy?: boolean
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** 预定义工具分组 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'file',
    name: '文件操作',
    description: '读取、写入、编辑文件',
    enabledByDefault: true,
    lazy: false,
    tools: [
      { name: 'read_file', description: '读取文件内容', parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } },
      { name: 'write_file', description: '写入文件', parameters: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
      { name: 'edit', description: '编辑文件（字符串替换）', parameters: { type: 'object', properties: { file_path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' } }, required: ['file_path', 'old_string', 'new_string'] } },
    ],
  },
  {
    id: 'shell',
    name: '终端命令',
    description: '执行 shell 命令、powershell、bash',
    enabledByDefault: true,
    lazy: false,
    tools: [
      { name: 'bash', description: '执行 bash 命令', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
      { name: 'powershell', description: '执行 PowerShell 命令', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
    ],
  },
  {
    id: 'search',
    name: '搜索',
    description: '文件搜索、代码搜索、web 搜索',
    enabledByDefault: true,
    lazy: false,
    tools: [
      { name: 'glob', description: 'glob 文件匹配', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } },
      { name: 'grep', description: '文本搜索', parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern'] } },
      { name: 'web_search', description: '网络搜索', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { name: 'web_fetch', description: '获取网页内容', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    ],
  },
  {
    id: 'git',
    name: '版本控制',
    description: 'Git 操作',
    enabledByDefault: true,
    lazy: false,
    tools: [
      { name: 'git', description: '执行 git 命令', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
    ],
  },
  {
    id: 'system',
    name: '系统管理',
    description: '系统信息、进程管理',
    enabledByDefault: false,
    lazy: true,
    tools: [
      { name: 'system_info', description: '获取系统信息', parameters: { type: 'object', properties: {} } },
      { name: 'process', description: '管理进程', parameters: { type: 'object', properties: { action: { type: 'string' } }, required: ['action'] } },
    ],
  },
  {
    id: 'advanced',
    name: '高级工具',
    description: '代码审查、重构、安全审计等高级功能',
    enabledByDefault: false,
    lazy: true,
    tools: [
      { name: 'code_review', description: '代码审查', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { name: 'refactor', description: '代码重构建议', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { name: 'security_audit', description: '安全审计', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    ],
  },
  {
    id: 'mcp',
    name: 'MCP 工具',
    description: 'Model Context Protocol 工具',
    enabledByDefault: false,
    lazy: true,
    tools: [],
  },
  {
    id: 'workflow',
    name: '工作流',
    description: '自动化工作流',
    enabledByDefault: false,
    lazy: true,
    tools: [
      { name: 'workflow', description: '管理工作流', parameters: { type: 'object', properties: { action: { type: 'string' }, name: { type: 'string' } }, required: ['action'] } },
    ],
  },
]

/**
 * 根据配置获取启用的工具定义
 */
export function getEnabledToolDefinitions(
  enabledGroups?: string[],
  enabledTools?: string[]
): ToolDefinition[] {
  const enabledSet = new Set(enabledGroups || [])
  const toolsSet = new Set(enabledTools || [])
  const result: ToolDefinition[] = []

  for (const group of TOOL_GROUPS) {
    const groupEnabled = enabledSet.has(group.id) || (enabledSet.size === 0 && group.enabledByDefault)
    if (!groupEnabled) continue

    for (const tool of group.tools) {
      if (toolsSet.size > 0 && !toolsSet.has(tool.name)) continue
      result.push(tool)
    }

    // MCP 工具需要特殊处理（动态注册）
    if (group.id === 'mcp') {
      // 由 mcpService 动态注册，此处只占位
    }
  }

  return result
}

/**
 * 获取所有工具分组的配置接口
 */
export function getToolGroupConfig(): Array<{ id: string; name: string; description: string; enabled: boolean; lazy: boolean }> {
  return TOOL_GROUPS.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    enabled: g.enabledByDefault,
    lazy: g.lazy ?? false,
  }))
}
