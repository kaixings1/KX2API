/**
 * tools/defaultData.ts — 内置工具分组与提示规则
 *
 * 原先存放在 default-data.json，用 `join(__dirname, 'default-data.json')` 读取。
 * 该方式在源码下可用，但 **electron-vite 打包后 __dirname 指向 out/main/，
 * JSON 不会随构建产出** —— 运行时 existsSync 恒为 false，内置分组与规则
 * 全部退化为空数组（表现为启动日志反复刷 "default-data.json not found"）。
 *
 * 改为 TS 常量：编译进 bundle，彻底消除对文件路径与构建配置的依赖。
 */

import type { ToolGroup, ToolHintRule } from './types'

/** 内置分组（builtin=true 表示不可删除，只可禁用） */
export const BUILTIN_GROUPS: ToolGroup[] = [
  {
    id: 'file-system',
    name: '文件系统',
    description: '文件和目录操作工具',
    toolIds: ['ls', 'dir', 'tree', 'cat', 'pwd', 'find', 'findstr'],
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'text-search',
    name: '文本搜索',
    description: '在文件中搜索文本内容',
    toolIds: ['grep', 'findstr'],
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'execution',
    name: '代码执行',
    description: '执行代码片段',
    toolIds: ['python', 'python3', 'echo'],
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'git',
    name: 'Git 操作',
    description: 'Git 版本控制工具',
    toolIds: ['git-status', 'git-diff', 'git-log', 'git-branch'],
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'system',
    name: '系统信息',
    description: '系统环境信息查询',
    toolIds: ['env', 'ps', 'memory', 'date', 'whoami', 'where', 'version'],
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'ai-agent',
    name: 'AI 代理',
    description: '需要 AI 执行的复杂任务',
    toolIds: [
      'team',
      'agents',
      'agents-platform',
      'auto',
      'auto-commit',
      'review',
      'refactor',
      'test',
      'docs',
      'fix',
      'explain',
      'analyze',
    ],
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
]

/** 内置提示规则：按用户消息的模式推荐相应工具组 */
export const BUILTIN_HINT_RULES: ToolHintRule[] = [
  {
    id: 'rule-file-browse',
    name: '文件浏览',
    description: '当用户询问文件内容或目录结构时推荐文件系统工具',
    patterns: ['查看.*文件', '目录.*结构', '文件.*列表', '文件.*内容', 'ls', 'dir', 'tree'],
    groupIds: ['file-system'],
    priority: 10,
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'rule-search',
    name: '文本搜索',
    description: '当用户需要搜索文本时推荐搜索工具',
    patterns: ['搜索', '查找.*内容', 'grep', 'findstr', '关键词'],
    groupIds: ['text-search', 'file-system'],
    priority: 10,
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'rule-git',
    name: 'Git 操作',
    description: '当用户询问代码变更时推荐 Git 工具',
    patterns: ['git', '提交', '分支', '差异', 'diff', 'commit', 'branch', '代码变更', '修改记录'],
    groupIds: ['git'],
    priority: 10,
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'rule-exec',
    name: '代码执行',
    description: '当用户需要运行代码时推荐执行工具',
    patterns: ['运行', '执行', 'python', 'print', '脚本'],
    groupIds: ['execution'],
    priority: 8,
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
  {
    id: 'rule-system',
    name: '系统信息',
    description: '当用户询问环境信息时推荐系统工具',
    patterns: ['环境变量', '进程', '内存', '系统', '版本', 'env', 'ps', 'memory'],
    groupIds: ['system'],
    priority: 8,
    enabled: true,
    builtin: true,
    createdAt: 0,
  },
]
