/**
 * engine/plugin/legacyToolPlugins.ts — 旧版工具插件列表
 *
 * 将 src/tools/ 中的成熟工具封装为可选插件。
 * 每个插件包含工具定义，便于配置化启用/禁用。
 *
 * 插件分类：
 * - core: 核心工具（默认启用）
 * - advanced: 高级工具（默认禁用，按需启用）
 * - specialized: 专业工具（默认禁用，按需启用）
 */

import type { ToolPlugin } from './toolPluginRegistry.ts'
import { memoryToolPlugin } from './memoryToolPlugin.ts'

// ==================== Core 工具（默认启用） ====================

export const coreToolPlugins: ToolPlugin[] = [
  {
    id: 'read_file',
    name: '文件读取',
    description: '读取文件内容',
    legacyDir: 'tools/FileReadTool',
    enabledByDefault: true,
    lazy: false,
    toolDefinitions: [
      {
        name: 'read_file',
        description: '读取文件内容（自动检测编码，支持图片）',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: '文件路径' },
            limit: { type: 'number', description: '最大行数' },
            offset: { type: 'number', description: '起始行号' },
          },
          required: ['file_path'],
        },
      },
    ],
  },
  {
    id: 'write_file',
    name: '文件写入',
    description: '写入文件内容',
    legacyDir: 'tools/FileWriteTool',
    enabledByDefault: true,
    lazy: false,
    toolDefinitions: [
      {
        name: 'write_file',
        description: '写入文件内容（自动创建目录）',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['file_path', 'content'],
        },
      },
    ],
  },
  {
    id: 'edit',
    name: '文件编辑',
    description: '字符串替换编辑文件',
    legacyDir: 'tools/FileEditTool',
    enabledByDefault: true,
    lazy: false,
    toolDefinitions: [
      {
        name: 'edit',
        description: '编辑文件（精确字符串替换）',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            old_string: { type: 'string' },
            new_string: { type: 'string' },
            replace_all: { type: 'boolean' },
          },
          required: ['file_path', 'old_string', 'new_string'],
        },
      },
    ],
  },
  {
    id: 'bash',
    name: '终端命令',
    description: '执行 shell 命令',
    legacyDir: 'tools/BashTool',
    enabledByDefault: true,
    lazy: false,
    toolDefinitions: [
      {
        name: 'bash',
        description: '执行 shell 命令（支持 bash、powershell、cmd）',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: '要执行的命令' },
            timeout: { type: 'number', description: '超时时间（毫秒）' },
          },
          required: ['command'],
        },
      },
    ],
  },
  {
    id: 'glob',
    name: '文件匹配',
    description: 'Glob 模式文件搜索',
    legacyDir: 'tools/GlobTool',
    enabledByDefault: true,
    lazy: false,
    toolDefinitions: [
      {
        name: 'glob',
        description: '使用 glob 模式搜索文件',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob 模式' },
            path: { type: 'string', description: '搜索根目录' },
          },
          required: ['pattern'],
        },
      },
    ],
  },
  {
    id: 'grep',
    name: '文本搜索',
    description: '在文件中搜索文本',
    legacyDir: 'tools/GrepTool',
    enabledByDefault: true,
    lazy: false,
    toolDefinitions: [
      {
        name: 'grep',
        description: '在文件中搜索文本（支持正则）',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            path: { type: 'string' },
            output_mode: { type: 'string' },
          },
          required: ['pattern'],
        },
      },
    ],
  },
  {
    id: 'web_search',
    name: '网络搜索',
    description: '网络搜索',
    legacyDir: 'tools/WebSearchTool',
    enabledByDefault: true,
    lazy: true,
    toolDefinitions: [
      {
        name: 'web_search',
        description: '执行网络搜索',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            max_results: { type: 'number' },
          },
          required: ['query'],
        },
      },
    ],
  },
  {
    id: 'web_fetch',
    name: '网页获取',
    description: '获取网页内容',
    legacyDir: 'tools/WebFetchTool',
    enabledByDefault: true,
    lazy: true,
    toolDefinitions: [
      {
        name: 'web_fetch',
        description: '获取 URL 的网页内容',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            max_length: { type: 'number' },
          },
          required: ['url'],
        },
      },
    ],
  },
  {
    id: 'git',
    name: 'Git 操作',
    description: 'Git 版本控制',
    legacyDir: 'tools/GitTool',
    enabledByDefault: true,
    lazy: false,
    toolDefinitions: [
      {
        name: 'git',
        description: '执行 git 命令',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'git 子命令' },
          },
          required: ['command'],
        },
      },
    ],
  },
]

// ==================== Advanced 工具（默认禁用） ====================

export const advancedToolPlugins: ToolPlugin[] = [
  {
    id: 'code_review',
    name: '代码审查',
    description: '代码审查与质量分析',
    legacyDir: 'tools/CodeReviewTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'code_review',
        description: '对代码进行审查',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            focus: { type: 'string' },
          },
          required: ['path'],
        },
      },
    ],
  },
  {
    id: 'refactor',
    name: '代码重构',
    description: '代码重构建议',
    legacyDir: 'tools/RefactorTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'refactor',
        description: '生成代码重构建议',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            goal: { type: 'string' },
          },
          required: ['path'],
        },
      },
    ],
  },
  {
    id: 'security_audit',
    name: '安全审计',
    description: '安全漏洞扫描',
    legacyDir: 'tools/SecurityAuditTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'security_audit',
        description: '执行安全审计',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      },
    ],
  },
  {
    id: 'mcp',
    name: 'MCP 工具',
    description: 'Model Context Protocol 工具',
    legacyDir: 'tools/MCPTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [],
  },
  {
    id: 'workflow',
    name: '工作流',
    description: '自动化工作流',
    legacyDir: 'tools/WorkflowTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'workflow',
        description: '管理工作流',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            name: { type: 'string' },
          },
          required: ['action'],
        },
      },
    ],
  },
  {
    id: 'database',
    name: '数据库',
    description: '数据库操作',
    legacyDir: 'tools/DatabaseTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'database',
        description: '数据库查询和操作',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            query: { type: 'string' },
          },
          required: ['action'],
        },
      },
    ],
  },
  {
    id: 'graphql',
    name: 'GraphQL',
    description: 'GraphQL 查询',
    legacyDir: 'tools/GraphqlTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'graphql',
        description: '执行 GraphQL 查询',
        parameters: {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
            query: { type: 'string' },
          },
          required: ['endpoint', 'query'],
        },
      },
    ],
  },
  {
    id: 'http',
    name: 'HTTP 请求',
    description: 'HTTP 请求工具',
    legacyDir: 'tools/HttpTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'http',
        description: '发送 HTTP 请求',
        parameters: {
          type: 'object',
          properties: {
            method: { type: 'string' },
            url: { type: 'string' },
            headers: { type: 'object' },
            body: { type: 'string' },
          },
          required: ['method', 'url'],
        },
      },
    ],
  },
  {
    id: 'file_watcher',
    name: '文件监听',
    description: '监听文件变化',
    legacyDir: 'tools/FileWatcherTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'file_watcher',
        description: '监听文件或目录变化',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            action: { type: 'string' },
          },
          required: ['path', 'action'],
        },
      },
    ],
  },
  {
    id: 'metrics',
    name: '指标监控',
    description: '系统指标监控',
    legacyDir: 'tools/MetricsTool',
    enabledByDefault: false,
    lazy: true,
    toolDefinitions: [
      {
        name: 'metrics',
        description: '获取系统指标',
        parameters: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
          },
          required: ['metric'],
        },
      },
    ],
  },
]

// ==================== Specialized 工具（默认禁用） ====================

export const specializedToolPlugins: ToolPlugin[] = [
  {
    id: 'memory',
    name: '记忆管理',
    description: '查看、创建、编辑、删除记忆文件（Claude Cookbooks memory_tool）',
    legacyDir: 'memory',
    enabledByDefault: true,
    lazy: false,
    toolDefinitions: [
      {
        name: 'memory_view',
        description: '查看记忆文件或目录内容（路径以 /memories 开头）',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '记忆路径，如 /memories/notes.md 或 /memories/' },
          },
          required: ['path'],
        },
      },
      {
        name: 'memory_create',
        description: '创建记忆文件',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '记忆路径，如 /memories/notes.md' },
            file_text: { type: 'string', description: '文件内容' },
          },
          required: ['path', 'file_text'],
        },
      },
      {
        name: 'memory_str_replace',
        description: '在记忆文件中替换文本（精确匹配，只替换一处）',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '记忆路径' },
            old_str: { type: 'string', description: '要被替换的文本' },
            new_str: { type: 'string', description: '替换后的文本' },
          },
          required: ['path', 'old_str', 'new_str'],
        },
      },
      {
        name: 'memory_insert',
        description: '在记忆文件中指定行号插入文本',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '记忆路径' },
            insert_line: { type: 'number', description: '要插入的行号（0-indexed）' },
            insert_text: { type: 'string', description: '要插入的文本' },
          },
          required: ['path', 'insert_line', 'insert_text'],
        },
      },
      {
        name: 'memory_delete',
        description: '删除记忆文件或目录',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '记忆路径，不能为 /memories（根目录）' },
          },
          required: ['path'],
        },
      },
      {
        name: 'memory_rename',
        description: '重命名记忆文件或目录',
        parameters: {
          type: 'object',
          properties: {
            old_path: { type: 'string', description: '原路径' },
            new_path: { type: 'string', description: '新路径' },
          },
          required: ['old_path', 'new_path'],
        },
      },
    ],
  },
]

// ==================== 导出 ====================

export const allLegacyToolPlugins: ToolPlugin[] = [
  ...coreToolPlugins,
  ...advancedToolPlugins,
  ...specializedToolPlugins,
]
