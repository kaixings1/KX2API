import { ipcMain, app, BrowserWindow, shell } from 'electron'
import axios from 'axios'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import { IpcChannels } from './channels'
import { planScheduler } from '../plans/planScheduler'
import { storeManager } from '../store/store'
import { ProviderManager } from '../store/providers'
import { AccountManager } from '../store/accounts'
import { ProviderChecker } from '../providers/checker'
import { CustomProviderManager } from '../providers/custom'
import { getBuiltinProviders, getBuiltinProvider } from '../providers/builtin'
import { oauthManager } from '../oauth/manager'
import { gitService } from '../git/gitService'
import { agentsService } from '../agents/agentsService'
import { tasksService } from '../tasks/tasksService'
import { commandRegistry } from '../../engine/commands/registry'
import { mcpService } from '../mcp/mcpService'
import { toolManager } from '../tools/toolManager'
import { kimiSessionManager } from '../oauth/kimiSessionManager'
import { cookieSessionManager } from '../oauth/cookieSessionManager'
import { proxyServer } from '../proxy/server'
import { proxyStatusManager } from '../proxy/status'
import { sessionManager } from '../proxy/sessionManager'
import { TrayManager } from '../tray/TrayManager'
import { ConfigManager } from '../store/config'
import { generateManagementSecret } from '../proxy/middleware/managementAuth'
import { UpdaterManager } from '../updater'
import { DeepSeekAdapter } from '../proxy/adapters/deepseek'
import { GLMAdapter } from '../proxy/adapters/glm'
import { KimiAdapter } from '../proxy/adapters/kimi'
import { MimoAdapter } from '../proxy/adapters/mimo'
import { MiniMaxAdapter } from '../proxy/adapters/minimax'
import { PerplexityAdapter } from '../proxy/adapters/perplexity'
import { QwenAdapter } from '../proxy/adapters/qwen'
import { QwenAiAdapter } from '../proxy/adapters/qwen-ai'
import { ZaiAdapter } from '../proxy/adapters/zai'
import type { Provider, Account, ProxyStatus, ProviderCheckResult, OAuthResult, AuthType, CredentialField, LogLevel, LogEntry, ProviderVendor, AppConfig, AccountStatus } from '../../shared/types'
import type { SystemPrompt, SessionConfig, SessionRecord, ManagementApiConfig } from '../store/types'
import type { ProviderType } from '../oauth/types'
import { allLegacyToolPlugins } from '../../engine/plugin/legacyToolPlugins'

// 引擎引用（通过 engine-bridge 设置，避免直接导入 engine 模块）
let engine: {
  query: (text: string) => Promise<{ content: string; toolOutput?: string }>
  getHistory: () => { messages: Array<{ role: string; content: string }> }
  clearHistory: () => void
  getConfig: () => Record<string, unknown>
  executeCommand: (name: string, args: string[]) => Promise<{ success: boolean; output?: string; error?: string }>
} | null = null

export function setEngineRef(eng: typeof engine) {
  engine = eng
}

let proxyStartTime: number | null = null
const updaterManager = UpdaterManager.getInstance()

const clearChatsHandlers: Record<string, (provider: Provider, account: Account) => Promise<boolean>> = {
  kimi: async (provider, account) => new KimiAdapter(provider, account).deleteAllChats(),
  qwen: async (provider, account) => new QwenAdapter(provider, account).deleteAllChats(),
  'qwen-ai': async (provider, account) => new QwenAiAdapter(provider, account).deleteAllChats(),
  minimax: async (provider, account) => new MiniMaxAdapter(provider, account).deleteAllChats(),
  zai: async (provider, account) => new ZaiAdapter(provider, account).deleteAllChats(),
  perplexity: async (provider, account) => new PerplexityAdapter(provider, account).deleteAllChats(),
  deepseek: async (provider, account) => new DeepSeekAdapter(provider, account).deleteAllChats(),
  glm: async (provider, account) => new GLMAdapter(provider, account).deleteAllChats(),
  mimo: async (provider, account) => new MimoAdapter(provider, account).deleteAllChats(),
}

function generateOAuthState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// ==================== New Module Types ====================
interface PlanRecord {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  steps: Array<{ id: string; description: string; status: string; result?: string | null }>
  createdAt: number
  updatedAt?: number
  completedAt?: number
}

interface TaskRecord {
  id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  assignee: string | null
  tags: string[]
  createdAt: number
  dueAt: number | null
  completedAt: number | null
}

interface GitStatus {
  currentBranch: string
  ahead: number
  behind: number
  staged: string[]
  unstaged: string[]
  untracked: string[]
  isClean: boolean
}

interface GitBranch {
  name: string
  current: boolean
  ahead: number
  behind: number
}

interface CommandRecord {
  id: string
  name: string
  description: string
  command: string
  args?: string[]
  type: 'builtin' | 'custom'
  enabled: boolean
  createdAt: number
}

interface WorkflowRecord {
  id: string
  name: string
  description: string
  steps: Array<{
    id: string
    type: 'command' | 'agent' | 'condition' | 'delay'
    config: Record<string, unknown>
  }>
  status: 'draft' | 'active' | 'paused' | 'completed' | 'running'
  createdAt: number
  updatedAt: number
}

interface McpServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'sse' | 'http'
  enabled: boolean
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
  tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> | null
}

interface PluginRecord {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean
  installed: boolean
  icon: string | null
  updatedAt?: number
}

interface OtherConfig {
  advanced: Record<string, unknown>
  experimental: Record<string, unknown>
  developer: Record<string, unknown>
}

// ==================== Default Data Seeding ====================

const DEFAULT_WORKFLOWS: WorkflowRecord[] = [
  {
    id: 'wf_code_review_pipeline',
    name: '代码审查流水线',
    description: '自动对代码进行多轮审查：语法检查 → 安全扫描 → 性能分析 → 建议汇总',
    steps: [
      { id: 'step_1', type: 'command', config: { command: 'git-diff' } },
      { id: 'step_2', type: 'agent', config: { agentId: 'agent_code_reviewer', prompt: '审查以下代码变更' } },
      { id: 'step_3', type: 'agent', config: { agentId: 'agent_refactor', prompt: '基于审查结果提出重构建议' } },
      { id: 'step_4', type: 'condition', config: { condition: 'has_issues', trueStep: 'step_5', falseStep: 'step_6' } },
      { id: 'step_5', type: 'agent', config: { agentId: 'agent_test_gen', prompt: '为修改的代码生成回归测试' } },
      { id: 'step_6', type: 'delay', config: { duration: 1000 } },
    ],
    status: 'active',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'wf_feature_development',
    name: '功能开发流程',
    description: '从需求到上线的完整开发流程：需求分析 → 设计 → 实现 → 测试 → 文档',
    steps: [
      { id: 'step_1', type: 'agent', config: { agentId: 'agent_docs_writer', prompt: '分析需求并生成功能设计文档' } },
      { id: 'step_2', type: 'agent', config: { agentId: 'agent_code_reviewer', prompt: '根据设计文档编写代码实现' } },
      { id: 'step_3', type: 'agent', config: { agentId: 'agent_test_gen', prompt: '为新功能编写测试用例' } },
      { id: 'step_4', type: 'agent', config: { agentId: 'agent_docs_writer', prompt: '编写用户文档和 API 文档' } },
    ],
    status: 'draft',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'wf_bug_fix',
    name: 'Bug 修复流程',
    description: '快速响应 Bug 报告：复现 → 定位 → 修复 → 验证 → 回归测试',
    steps: [
      { id: 'step_1', type: 'command', config: { command: 'git-log' } },
      { id: 'step_2', type: 'agent', config: { agentId: 'agent_code_reviewer', prompt: '定位 Bug 根因' } },
      { id: 'step_3', type: 'agent', config: { agentId: 'agent_refactor', prompt: '编写最小化修复方案' } },
      { id: 'step_4', type: 'agent', config: { agentId: 'agent_test_gen', prompt: '编写回归测试验证修复' } },
    ],
    status: 'paused',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
]

const DEFAULT_PLUGINS: PluginRecord[] = [
  {
    id: 'plugin_git_integration',
    name: 'Git 集成插件',
    version: '1.0.0',
    description: '提供 Git 仓库管理、代码提交、分支操作等功能的插件。支持 Git 状态查看、差异对比、提交历史浏览。',
    author: 'KX2API',
    enabled: true,
    installed: true,
    icon: '📦',
  },
  {
    id: 'plugin_code_formatter',
    name: '代码格式化插件',
    version: '1.0.0',
    description: '自动格式化代码，支持多种编程语言。集成 Prettier 和 ESLint，提供统一的代码风格。',
    author: 'KX2API',
    enabled: true,
    installed: true,
    icon: '✨',
  },
  {
    id: 'plugin_docker_manager',
    name: 'Docker 管理插件',
    version: '1.0.0',
    description: '管理 Docker 容器、镜像和网络。支持容器启动、停止、日志查看和资源监控。',
    author: 'KX2API',
    enabled: false,
    installed: true,
    icon: '🐳',
  },
  {
    id: 'plugin_api_tester',
    name: 'API 测试插件',
    version: '1.0.0',
    description: 'HTTP/REST API 测试工具。支持 GET/POST/PUT/DELETE 请求，可保存和复用测试用例。',
    author: 'KX2API',
    enabled: false,
    installed: false,
    icon: '🔍',
  },
  {
    id: 'plugin_markdown_preview',
    name: 'Markdown 预览插件',
    version: '1.0.0',
    description: '实时预览 Markdown 文档，支持数学公式、代码高亮和自定义主题。',
    author: 'KX2API',
    enabled: false,
    installed: false,
    icon: '📝',
  },
]

const DEFAULT_PLANS: PlanRecord[] = [
  {
    id: 'plan_v1_release',
    title: 'v1.0 发布计划',
    description: '完成核心功能开发，包括代理管理、工具集成、工作流引擎等',
    status: 'running',
    steps: [
      { id: 'step_1', description: '完成 Agent 管理模块', status: 'completed' },
      { id: 'step_2', description: '完成 Tool 管理模块', status: 'completed' },
      { id: 'step_3', description: '完成 Workflow 引擎', status: 'running' },
      { id: 'step_4', description: '完成 MCP 集成', status: 'pending' },
      { id: 'step_5', description: '完成测试覆盖', status: 'pending' },
    ],
    createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'plan_security_audit',
    title: '安全审计计划',
    description: '对系统进行全面安全审计，修复已知漏洞，加强认证和授权机制',
    status: 'pending',
    steps: [
      { id: 'step_1', description: '代码安全扫描', status: 'pending' },
      { id: 'step_2', description: '依赖项漏洞检查', status: 'pending' },
      { id: 'step_3', description: '认证机制加固', status: 'pending' },
      { id: 'step_4', description: '渗透测试', status: 'pending' },
    ],
    createdAt: Date.now() - 86400000 * 2,
  },
]

const DEFAULT_TASKS: TaskRecord[] = [
  {
    id: 'task_001',
    title: '实现 Agent 管理页面',
    description: '创建 Agent 管理界面，支持增删改查和执行操作',
    status: 'done',
    priority: 'high',
    assignee: '开发者',
    tags: ['frontend', 'agent'],
    createdAt: Date.now() - 86400000 * 5,
    dueAt: Date.now() - 86400000 * 3,
    completedAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'task_002',
    title: '实现 Workflow 管理页面',
    description: '创建工作流管理界面，支持步骤配置和执行',
    status: 'done',
    priority: 'high',
    assignee: '开发者',
    tags: ['frontend', 'workflow'],
    createdAt: Date.now() - 86400000 * 4,
    dueAt: Date.now() - 86400000 * 2,
    completedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'task_003',
    title: '实现 MCP 管理页面',
    description: '创建 MCP 服务器配置界面，支持添加、编辑、测试连接',
    status: 'in_progress',
    priority: 'medium',
    assignee: '开发者',
    tags: ['frontend', 'mcp'],
    createdAt: Date.now() - 86400000 * 3,
    dueAt: Date.now() + 86400000,
    completedAt: null,
  },
  {
    id: 'task_004',
    title: '添加导入导出功能',
    description: '为所有管理页面添加导入导出和备份恢复功能',
    status: 'in_progress',
    priority: 'medium',
    assignee: '开发者',
    tags: ['feature', 'import-export'],
    createdAt: Date.now() - 86400000 * 2,
    dueAt: Date.now() + 86400000 * 2,
    completedAt: null,
  },
  {
    id: 'task_005',
    title: '编写单元测试',
    description: '为关键模块编写单元测试，确保代码质量',
    status: 'todo',
    priority: 'medium',
    assignee: '开发者',
    tags: ['testing'],
    createdAt: Date.now() - 86400000,
    dueAt: Date.now() + 86400000 * 5,
    completedAt: null,
  },
  {
    id: 'task_006',
    title: '优化暗色模式支持',
    description: '修复所有页面在暗色模式下的显示问题',
    status: 'todo',
    priority: 'low',
    assignee: '开发者',
    tags: ['ui', 'dark-mode'],
    createdAt: Date.now() - 86400000,
    dueAt: Date.now() + 86400000 * 3,
    completedAt: null,
  },
]

const DEFAULT_MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'mcp_filesystem',
    name: '文件系统 MCP',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:/Users/Administrator/Documents'],
    enabled: true,
    tools: null,
  },
  {
    id: 'mcp_web_search',
    name: 'Web 搜索 MCP',
    transport: 'http',
    url: 'http://localhost:3001',
    enabled: true,
    tools: null,
  },
]

// 约束与 ModuleDataStore 保持一致（{ id: string }），
// 不能再用 Record<string, unknown> —— 业务接口不带索引签名。
function seedStoreIfEmpty<T extends { id: string }>(
  store: ModuleDataStore<T>,
  defaults: T[],
  storeName: string
): void {
  if (store.size === 0) {
    for (const item of defaults) {
      store.set(item.id, item)
    }
    console.log(`[IPC] Seeded ${defaults.length} default ${storeName}`)
  }
}

// ==================== Persistent Module Storage ====================
import { ModuleDataStore } from './ModuleDataStore'

const plansStore = new ModuleDataStore<PlanRecord>('plans')
const tasksStore = new ModuleDataStore<TaskRecord>('tasks')
const commandsStore = new ModuleDataStore<CommandRecord>('commands')
const workflowsStore = new ModuleDataStore<WorkflowRecord>('workflows')
const mcpServersStore = new ModuleDataStore<McpServerConfig>('mcp-servers')
const pluginsStore = new ModuleDataStore<PluginRecord>('plugins')

// Seed default data on startup
seedStoreIfEmpty(workflowsStore, DEFAULT_WORKFLOWS as unknown as WorkflowRecord[], 'workflows')
seedStoreIfEmpty(mcpServersStore, DEFAULT_MCP_SERVERS as unknown as McpServerConfig[], 'mcp-servers')
seedStoreIfEmpty(pluginsStore, DEFAULT_PLUGINS as unknown as PluginRecord[], 'plugins')
seedStoreIfEmpty(plansStore, DEFAULT_PLANS as unknown as PlanRecord[], 'plans')
seedStoreIfEmpty(tasksStore, DEFAULT_TASKS as unknown as TaskRecord[], 'tasks')

let ipcHandlersRegistered = false

export async function registerIpcHandlers(mainWindow: BrowserWindow | null): Promise<void> {
  if (ipcHandlersRegistered) {
    console.log('[IPC] registerIpcHandlers skipped (already registered)')
    return
  }
  ipcHandlersRegistered = true
  console.log('[IPC] registerIpcHandlers called, mainWindow:', !!mainWindow)

  // ==================== New Module IPC Handlers (always registered) ====================
  // These use in-memory Map stores and don't depend on storeManager init

  // ==================== Plan Management IPC Handlers ====================

  ipcMain.handle(IpcChannels.PLANS_GET_ALL, async () => {
    try {
      return { success: true, data: Array.from(plansStore.values()) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLANS_GET_BY_ID, async (_, id: string) => {
    try {
      const plan = plansStore.get(id)
      if (plan) return { success: true, data: plan }
      return { success: false, error: '计划不存在' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLANS_CREATE, async (_, data: Omit<PlanRecord, 'id' | 'createdAt'>) => {
    try {
      const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const plan: PlanRecord = { ...data, id, createdAt: Date.now() }
      plansStore.set(id, plan)
      return { success: true, data: plan }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLANS_UPDATE, async (_, id: string, data: Partial<PlanRecord>) => {
    try {
      const existing = plansStore.get(id)
      if (!existing) return { success: false, error: '计划不存在' }
      const updated = { ...existing, ...data }
      plansStore.set(id, updated)
      return { success: true, data: updated }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLANS_DELETE, async (_, id: string) => {
    try {
      return { success: plansStore.delete(id) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLANS_EXECUTE, async (_, id: string) => {
    try {
      const plan = plansStore.get(id)
      if (!plan) return { success: false, error: '计划不存在' }
      if (plan.status === 'running') return { success: false, error: '计划正在运行中' }
      if (plan.steps.length === 0) return { success: false, error: '计划没有可执行的步骤' }

      plansStore.set(id, {
        ...plan,
        status: 'running',
        updatedAt: Date.now(),
        steps: plan.steps.map(s => ({ ...s, status: 'pending', result: null })),
      })

      let failedStep: string | null = null
      let errorMessage = ''
      const updatedPlan = plansStore.get(id)!
      const updatedSteps = [...updatedPlan.steps]

      for (let i = 0; i < updatedSteps.length; i++) {
        const step = updatedSteps[i]
        try {
          mainWindow?.webContents.send(IpcChannels.PLANS_STREAM_PHASE, {
            stepId: step.id,
            phase: 'start',
            detail: step.description,
            index: i,
            total: updatedSteps.length,
          })

          await new Promise(r => setTimeout(r, 600))

          updatedSteps[i] = { ...step, status: 'completed', result: 'Executed' }
          plansStore.set(id, { ...updatedPlan, steps: updatedSteps })

          mainWindow?.webContents.send(IpcChannels.PLANS_STREAM_PHASE, {
            stepId: step.id,
            phase: 'complete',
            detail: step.description,
            index: i,
            total: updatedSteps.length,
          })
        } catch (stepErr) {
          failedStep = step.description
          errorMessage = stepErr instanceof Error ? stepErr.message : String(stepErr)
          updatedSteps[i] = { ...step, status: 'failed', result: errorMessage }
          plansStore.set(id, { ...updatedPlan, steps: updatedSteps, status: 'failed' })
          mainWindow?.webContents.send(IpcChannels.PLANS_STREAM_ERROR, { error: errorMessage, step: failedStep })
          return { success: false, error: errorMessage }
        }
      }

      const allDone = updatedSteps.every(s => s.status === 'completed')
      const finalPlan = plansStore.get(id)!
      plansStore.set(id, { ...finalPlan, status: 'completed', completedAt: Date.now() })
      mainWindow?.webContents.send(IpcChannels.PLANS_STREAM_DONE, {
        success: true,
        result: { steps: updatedSteps },
      })
      return { success: true, data: { steps: updatedSteps } }
    } catch (e) {
      mainWindow?.webContents.send(IpcChannels.PLANS_STREAM_ERROR, { error: (e as Error).message })
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== Git Management IPC Handlers ====================

  ipcMain.handle(IpcChannels.GIT_GET_STATUS, async () => {
    try {
      const repoPath = storeManager.getStore()?.get('currentRepo') as string || process.cwd()
      gitService.setRepoPath(repoPath)
      return { success: true, data: gitService.getStatus() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.GIT_CLONE, async (_, url: string, path: string) => {
    try {
      gitService.clone(url, path)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.GIT_PULL, async () => {
    try {
      const repoPath = storeManager.getStore()?.get('currentRepo') as string || process.cwd()
      gitService.setRepoPath(repoPath)
      const output = gitService.pull()
      return { success: true, data: { output } }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.GIT_PUSH, async () => {
    try {
      const repoPath = storeManager.getStore()?.get('currentRepo') as string || process.cwd()
      gitService.setRepoPath(repoPath)
      const output = gitService.push()
      return { success: true, data: { output } }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.GIT_GET_LOG, async (_, limit?: number) => {
    try {
      const repoPath = storeManager.getStore()?.get('currentRepo') as string || process.cwd()
      gitService.setRepoPath(repoPath)
      return { success: true, data: gitService.getLog({ limit }) }
    } catch (e) {
      return { success: false, error: (e as Error).message, data: [] }
    }
  })

  ipcMain.handle(IpcChannels.GIT_GET_BRANCHES, async () => {
    try {
      const repoPath = storeManager.getStore()?.get('currentRepo') as string || process.cwd()
      gitService.setRepoPath(repoPath)
      return { success: true, data: gitService.getBranches() }
    } catch (e) {
      return { success: false, error: (e as Error).message, data: [] }
    }
  })

  ipcMain.handle(IpcChannels.GIT_CHECKOUT, async (_, branch: string) => {
    try {
      const repoPath = storeManager.getStore()?.get('currentRepo') as string || process.cwd()
      gitService.setRepoPath(repoPath)
      gitService.checkout(branch)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== Command Management IPC Handlers ====================

  ipcMain.handle(IpcChannels.COMMANDS_GET_ALL, async () => {
    const t0 = Date.now()
    try {
      console.log('[CMD] GET_ALL called, store size:', commandsStore.size, 'registry size:', commandRegistry.getNames().length)

      // Sync built-in commands from commandRegistry if not yet in store
      const existing = Array.from(commandsStore.values())
      const existingBuiltin = new Set(existing.filter(c => c.type === 'builtin').map(c => c.name))
      console.log('[CMD] existing builtin count:', existingBuiltin.size, 'registry count:', commandRegistry.getNames().length)

      let synced = 0
      for (const cmd of commandRegistry.getAll()) {
        if (!existingBuiltin.has(cmd.name)) {
          const id = `builtin_${cmd.name}`
          commandsStore.set(id, {
            id,
            name: cmd.name,
            description: cmd.description,
            command: cmd.name,
            type: 'builtin',
            enabled: true,
            createdAt: Date.now(),
          })
          synced++
        }
      }
      if (synced > 0) {
        console.log('[CMD] synced', synced, 'new builtin commands from registry')
      }

      const all = Array.from(commandsStore.values())
      const builtinCount = all.filter(c => c.type === 'builtin').length
      const customCount = all.filter(c => c.type === 'custom').length
      console.log('[CMD] GET_ALL result: total=', all.length, 'builtin=', builtinCount, 'custom=', customCount, 'ms=', Date.now() - t0)
      return { success: true, data: all }
    } catch (e) {
      console.error('[CMD] GET_ALL error:', e)
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.COMMANDS_GET_BUILTIN, async () => {
    const t0 = Date.now()
    try {
      const builtin = Array.from(commandsStore.values()).filter(c => c.type === 'builtin')
      console.log('[CMD] GET_BUILTIN result:', builtin.length, 'ms=', Date.now() - t0)
      return { success: true, data: builtin }
    } catch (e) {
      console.error('[CMD] GET_BUILTIN error:', e)
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.COMMANDS_GET_CUSTOM, async () => {
    const t0 = Date.now()
    try {
      const custom = Array.from(commandsStore.values()).filter(c => c.type === 'custom')
      console.log('[CMD] GET_CUSTOM result:', custom.length, 'ms=', Date.now() - t0)
      return { success: true, data: custom }
    } catch (e) {
      console.error('[CMD] GET_CUSTOM error:', e)
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.COMMANDS_ADD, async (_, command: Omit<CommandRecord, 'id' | 'createdAt'>) => {
    const t0 = Date.now()
    try {
      const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const cmd: CommandRecord = { ...command, id, createdAt: Date.now() }
      commandsStore.set(id, cmd)
      console.log('[CMD] ADD:', cmd.name, 'type:', cmd.type, 'ms=', Date.now() - t0)
      return { success: true, data: cmd }
    } catch (e) {
      console.error('[CMD] ADD error:', e)
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.COMMANDS_UPDATE, async (_, id: string, data: Partial<CommandRecord>) => {
    const t0 = Date.now()
    try {
      const existing = commandsStore.get(id)
      if (!existing) {
        console.warn('[CMD] UPDATE: not found, id=', id)
        return { success: false, error: '命令不存在' }
      }
      const updated = { ...existing, ...data }
      commandsStore.set(id, updated)
      console.log('[CMD] UPDATE:', id, 'ms=', Date.now() - t0)
      return { success: true, data: updated }
    } catch (e) {
      console.error('[CMD] UPDATE error:', e)
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.COMMANDS_DELETE, async (_, id: string) => {
    const t0 = Date.now()
    try {
      const existed = commandsStore.has(id)
      const result = commandsStore.delete(id)
      console.log('[CMD] DELETE:', id, 'existed:', existed, 'deleted:', result, 'ms=', Date.now() - t0)
      return { success: result }
    } catch (e) {
      console.error('[CMD] DELETE error:', e)
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.COMMANDS_EXECUTE, async (_, idOrName: string, args?: string[]) => {
    const t0 = Date.now()
    try {
      // 前端传的是命令名（见 CommandManagementPage 的 commandsApi.execute(cmd.name)），
      // 旧实现只按 store 的 id 查（内置命令 id 是 `builtin_<name>`），
      // 结果永远 "Command not found"。这里 id / name 都支持。
      const command = commandsStore.get(idOrName)
        || Array.from(commandsStore.values()).find(c => c.name === idOrName)
      if (!command) {
        console.warn('[CMD] EXECUTE: not found, id/name=', idOrName)
        return { success: false, error: `命令不存在：${idOrName}` }
      }

      const cmdArgs = args && args.length > 0 ? args : (command.args || [])
      console.log('[CMD] EXECUTE:', command.name, 'type:', command.type, 'args:', cmdArgs)

      // 内置命令必须走命令注册表。旧实现一律 execSync(command.command)，
      // 而内置命令的 command 字段就是命令名本身，会去调用同名系统程序：
      // `where`/`tree`/`date` 会跑 Windows 自带工具，`python` 甚至会真的起解释器。
      if (command.type === 'builtin') {
        const registryCmd = commandRegistry.get(command.name)
        if (!registryCmd) {
          return { success: false, error: `命令未注册: ${command.name}` }
        }
        const result = await registryCmd.execute(cmdArgs)
        return {
          success: true,
          data: {
            success: result.success,
            output: result.output,
            error: result.error,
            durationMs: Date.now() - t0,
          },
        }
      }

      // 自定义命令：语义就是执行用户配置的那条 shell 命令
      const output = execSync(command.command, { encoding: 'utf8', timeout: 30000 })
      console.log('[CMD] EXECUTE success:', command.name, 'ms=', Date.now() - t0)
      return { success: true, data: { success: true, output, durationMs: Date.now() - t0 } }
    } catch (e) {
      console.error('[CMD] EXECUTE error:', e)
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== Workflow Management IPC Handlers ====================

  ipcMain.handle(IpcChannels.WORKFLOWS_GET_ALL, async () => {
    try { return { success: true, data: Array.from(workflowsStore.values()) }
    } catch (e) { return { success: false, error: (e as Error).message } }
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_GET_BY_ID, async (_, id: string) => {
    try {
      const workflow = workflowsStore.get(id)
      if (workflow) return { success: true, data: workflow }
      return { success: false, error: '工作流不存在' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_CREATE, async (_, data: Omit<WorkflowRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const workflow: WorkflowRecord = { ...data, id, createdAt: Date.now(), updatedAt: Date.now() }
      workflowsStore.set(id, workflow)
      return { success: true, data: workflow }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_UPDATE, async (_, id: string, data: Partial<WorkflowRecord>) => {
    try {
      const existing = workflowsStore.get(id)
      if (!existing) return { success: false, error: '工作流不存在' }
      const updated = { ...existing, ...data, updatedAt: Date.now() }
      workflowsStore.set(id, updated)
      return { success: true, data: updated }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_DELETE, async (_, id: string) => {
    try {
      return { success: workflowsStore.delete(id) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOWS_EXECUTE, async (_, id: string) => {
    try {
      const workflow = workflowsStore.get(id)
      if (!workflow) return { success: false, error: '工作流不存在' }
      workflowsStore.set(id, { ...workflow, status: 'running', updatedAt: Date.now() })
      await new Promise(r => setTimeout(r, 1000))
      workflowsStore.set(id, { ...workflow, status: 'completed', updatedAt: Date.now() })
      return { success: true, data: null }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== MCP Management IPC Handlers ====================

  // MCP handlers delegated to McpService
  ipcMain.handle(IpcChannels.MCP_GET_CONFIG, async () => {
    try {
      const servers = mcpService.getServers()
      return { success: true, data: { servers } }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MCP_UPDATE_CONFIG, async (_, config: any) => {
    try {
      storeManager.updateConfig({ mcp: config } as Partial<AppConfig>)
      return { success: true, data: null }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MCP_GET_SERVERS, async () => {
    try {
      const servers = mcpService.getServers()
      return { success: true, data: servers }
    } catch (e) {
      return { success: false, error: (e as Error).message, data: [] }
    }
  })

  ipcMain.handle(IpcChannels.MCP_ADD_SERVER, async (_, server: any) => {
    try {
      const result = mcpService.addServer(server)
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MCP_REMOVE_SERVER, async (_, serverId: string) => {
    try {
      mcpService.removeServer(serverId)
      return { success: true, data: null }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MCP_TEST_CONNECTION, async (_, server: any) => {
    try {
      const result = await mcpService.testConnection(server)
      return { success: result.connected, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MCP_GET_TOOLS, async (_, serverId?: string) => {
    try {
      const tools = await mcpService.getTools(serverId)
      return { success: true, data: tools }
    } catch (e) {
      return { success: false, error: (e as Error).message, data: [] }
    }
  })

  ipcMain.handle(IpcChannels.MCP_GET_SERVER_BY_ID, async (_, id: string) => {
    try {
      const configRes = await mcpService.getConfig()
      const server = (configRes as any)?.servers?.find((s: any) => s.id === id)
      if (server) return { success: true, data: server }
      return { success: false, error: '服务器不存在' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== Generic Management Import/Export ====================

  const BACKUP_DIR = join(app.getPath('userData'), 'backups')
  function ensureBackupDir(): void {
    if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
  }

  ipcMain.handle(IpcChannels.MGMT_EXPORT, async (_: any, moduleName: string, data: any) => {
    try {
      ensureBackupDir()
      const path = join(BACKUP_DIR, `${moduleName}_${Date.now()}.json`)
      writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
      return { success: true, path }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MGMT_IMPORT, async (_: any, moduleName: string, jsonData: string) => {
    try {
      const data = JSON.parse(jsonData)
      if (!Array.isArray(data)) return { success: false, error: '数据必须是数组' }
      return { success: true, data, count: data.length }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MGMT_BACKUP, async () => {
    try {
      ensureBackupDir()
      const backup: Record<string, any> = {}
      const modules = [
        { key: 'workflows', store: workflowsStore },
        { key: 'mcp-servers', store: mcpServersStore },
        { key: 'tools', store: (toolManager as any)?.store },
        { key: 'plugins', store: pluginsStore },
        { key: 'plans', store: plansStore },
        { key: 'tasks', store: tasksStore },
      ]
      for (const m of modules) {
        try { backup[m.key] = Array.from(m.store.values()) } catch { /* skip */ }
      }
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const path = join(BACKUP_DIR, `full_backup_${timestamp}.json`)
      writeFileSync(path, JSON.stringify(backup, null, 2), 'utf-8')
      return { success: true, path, modules: Object.keys(backup) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MGMT_RESTORE, async (_, filePath: string) => {
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const backup: Record<string, any[]> = JSON.parse(raw)
      const restored: Record<string, number> = {}
      for (const [key, items] of Object.entries(backup)) {
        if (!Array.isArray(items)) continue
        let count = 0
        for (const item of items) {
          if (item?.id) {
            try {
              const storeMap: Record<string, any> = {
                'workflows': workflowsStore,
                'mcp-servers': mcpServersStore, 'plugins': pluginsStore,
                'plans': plansStore, 'tasks': tasksStore,
              }
              const store = storeMap[key]
              if (store && !store.has(item.id)) { store.set(item.id, item); count++ }
            } catch { /* skip duplicates */ }
          }
        }
        restored[key] = count
      }
      return { success: true, restored }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.MGMT_GET_ALL_BACKUPS, async () => {
    try {
      ensureBackupDir()
      const files = readdirSync(BACKUP_DIR).filter((f: string) => f.endsWith('.json'))
      return { success: true, data: files.map(f => ({ name: f, path: join(BACKUP_DIR, f) })) }
    } catch (e) {
      return { success: false, data: [] }
    }
  })

  ipcMain.handle(IpcChannels.MGMT_DELETE_BACKUP, async (_, fileName: string) => {
    try {
      unlinkSync(join(BACKUP_DIR, fileName))
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== Plugin Management IPC Handlers ====================

  ipcMain.handle(IpcChannels.PLUGINS_ADD, async (_, data: Omit<PluginRecord, 'id'>) => {
    try {
      const id = `plugin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const plugin: PluginRecord = { ...data, id }
      pluginsStore.set(id, plugin)
      return { success: true, data: plugin }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLUGINS_GET_ALL, async () => {
    try { return { success: true, data: Array.from(pluginsStore.values()) }
    } catch (e) { return { success: false, error: (e as Error).message } }
  })

  ipcMain.handle(IpcChannels.PLUGINS_GET_BUILTIN, async () => {
    try {
      const builtin = Array.from(pluginsStore.values()).filter(p => !p.installed)
      return { success: true, data: builtin }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLUGINS_GET_INSTALLED, async () => {
    try {
      const installed = Array.from(pluginsStore.values()).filter(p => p.installed)
      return { success: true, data: installed }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLUGINS_INSTALL, async (_, pluginId: string) => {
    try {
      const plugin = pluginsStore.get(pluginId)
      if (plugin) {
        pluginsStore.set(pluginId, { ...plugin, installed: true, enabled: true })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLUGINS_UNINSTALL, async (_, pluginId: string) => {
    try {
      const plugin = pluginsStore.get(pluginId)
      if (plugin) {
        pluginsStore.set(pluginId, { ...plugin, installed: false, enabled: false })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLUGINS_ENABLE, async (_, pluginId: string) => {
    try {
      const plugin = pluginsStore.get(pluginId)
      if (plugin) {
        pluginsStore.set(pluginId, { ...plugin, enabled: true })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLUGINS_DISABLE, async (_, pluginId: string) => {
    try {
      const plugin = pluginsStore.get(pluginId)
      if (plugin) {
        pluginsStore.set(pluginId, { ...plugin, enabled: false })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLUGINS_UPDATE, async (_, pluginId: string) => {
    try {
      const plugin = pluginsStore.get(pluginId)
      if (plugin) {
        pluginsStore.set(pluginId, { ...plugin, updatedAt: Date.now() })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PLUGINS_GET_BY_ID, async (_, pluginId: string) => {
    try {
      const plugin = pluginsStore.get(pluginId)
      if (plugin) return { success: true, data: plugin }
      return { success: false, error: '插件不存在' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== Other Config IPC Handlers ====================

  ipcMain.handle(IpcChannels.OTHER_CONFIG_GET, async () => {
    try {
      const config = ConfigManager.get() || {}
      return { success: true, data: { advanced: (config as any).advanced || {}, experimental: (config as any).experimental || {}, developer: (config as any).developer || {} } as OtherConfig }
    } catch (e) { return { success: false, error: (e as Error).message } }
  })

  ipcMain.handle(IpcChannels.OTHER_CONFIG_UPDATE, async (_, config: Partial<OtherConfig>) => {
    try {
      const current = ConfigManager.get() || {}
      ConfigManager.update({ ...current, ...config } as Partial<AppConfig>)
      return { success: true }
    } catch (e) { return { success: false, error: (e as Error).message } }
  })

  ipcMain.handle(IpcChannels.OTHER_CONFIG_GET_ADVANCED, async () => {
    try {
      const config = ConfigManager.get() || {}
      return { success: true, data: (config as any).advanced || {} }
    } catch (e) { return { success: false, error: (e as Error).message } }
  })

  ipcMain.handle(IpcChannels.OTHER_CONFIG_UPDATE_ADVANCED, async (_, data: Record<string, unknown>) => {
    try {
      const config = ConfigManager.get() || {}
      ConfigManager.update({ advanced: { ...(config as any).advanced, ...data } } as Partial<AppConfig>)
      return { success: true }
    } catch (e) { return { success: false, error: (e as Error).message } }
  })

  ipcMain.handle(IpcChannels.OTHER_CONFIG_RESET, async () => {
    try {
      const config = ConfigManager.get() || {}
      ConfigManager.update({ advanced: {}, experimental: {}, developer: {} } as Partial<AppConfig>)
      return { success: true }
    } catch (e) { return { success: false, error: (e as Error).message } }
  })

  // ==================== Tool Management IPC Handlers ====================

  ipcMain.handle(IpcChannels.TOOLS_GET_ALL, async () => {
    try {
      const tools = toolManager.getAllTools()
      const groups = toolManager.getAllGroups()
      const hintRules = toolManager.getAllHintRules()
      return { success: true, data: { tools, groups, hintRules } }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_GET_GROUPS, async () => {
    try {
      const groups = toolManager.getAllGroups()
      return { success: true, data: groups }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_GET_HINT_RULES, async () => {
    try {
      const hintRules = toolManager.getAllHintRules()
      return { success: true, data: hintRules }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_ADD, async (_, tool: any) => {
    try {
      const result = toolManager.addTool(tool)
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_UPDATE, async (_, id: string, updates: any) => {
    try {
      const result = toolManager.updateTool(id, updates)
      if (!result) return { success: false, error: '工具不存在' }
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_REMOVE, async (_, id: string) => {
    try {
      const removed = toolManager.removeTool(id)
      if (!removed) return { success: false, error: '无法删除内置工具' }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_TOGGLE, async (_, id: string) => {
    try {
      const result = toolManager.toggleTool(id)
      if (!result) return { success: false, error: '工具不存在' }
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_ADD_GROUP, async (_, group: any) => {
    try {
      const result = toolManager.addGroup(group)
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_UPDATE_GROUP, async (_, id: string, updates: any) => {
    try {
      const result = toolManager.updateGroup(id, updates)
      if (!result) return { success: false, error: '分组不存在' }
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_REMOVE_GROUP, async (_, id: string) => {
    try {
      const removed = toolManager.removeGroup(id)
      if (!removed) return { success: false, error: '无法删除内置分组' }
      // 若删除的是当前生效组，从 enabledToolGroups 中剔除该悬空 id
      const config = storeManager.getConfig()
      const active = config.enabledToolGroups || []
      if (active.includes(id)) {
        storeManager.updateConfig({ enabledToolGroups: active.filter(gid => gid !== id) })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_ADD_TO_GROUP, async (_, toolId: string, groupId: string) => {
    try {
      const added = toolManager.addToolToGroup(toolId, groupId)
      if (!added) return { success: false, error: '工具已在分组中，或分组不存在' }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_REMOVE_FROM_GROUP, async (_, toolId: string, groupId: string) => {
    try {
      toolManager.removeToolFromGroup(toolId, groupId)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_ADD_HINT_RULE, async (_, rule: any) => {
    try {
      const result = toolManager.addHintRule(rule)
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_UPDATE_HINT_RULE, async (_, id: string, updates: any) => {
    try {
      const result = toolManager.updateHintRule(id, updates)
      if (!result) return { success: false, error: '规则不存在' }
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_REMOVE_HINT_RULE, async (_, id: string) => {
    try {
      const removed = toolManager.removeHintRule(id)
      if (!removed) return { success: false, error: '无法删除内置规则' }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_MATCH_HINTS, async (_, input: string) => {
    try {
      const groups = toolManager.matchHintRules(input)
      const tools = groups.flatMap(g => toolManager.getToolsInGroup(g.id))
      return { success: true, data: { groups, tools } }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_RESET, async () => {
    try {
      toolManager.resetToDefault()
      // 重置后回落到全局组，避免 enabledToolGroups 指向已被清空的分组 id 造成悬空
      const config = storeManager.getConfig()
      if (config.enabledToolGroups && config.enabledToolGroups.length > 0) {
        storeManager.updateConfig({ enabledToolGroups: [] })
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_GET_BY_ID, async (_, id: string) => {
    try {
      const tool = toolManager.getTool(id)
      if (tool) return { success: true, data: tool }
      return { success: false, error: '工具不存在' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 把内置实体恢复成内置默认（删掉用户覆盖层，回到模板值）
  ipcMain.handle(
    IpcChannels.TOOLS_RESET_BUILTIN,
    async (_, kind: 'tool' | 'group' | 'hintRule', id: string) => {
      try {
        const done = toolManager.resetBuiltin(kind, id)
        if (!done) return { success: false, error: '内置实体不存在' }
        return { success: true }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  // 确保实体在磁盘上有可编辑文件，返回路径。内置项若没被改过会先物化一份。
  ipcMain.handle(IpcChannels.TOOLS_ENSURE_FILE, async (_, id: string) => {
    try {
      const path = toolManager.ensureToolFile(id)
      if (!path) return { success: false, error: '工具不存在' }
      return { success: true, data: { path } }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 在系统文件管理器中定位并选中该工具的可编辑 JSON 文件
  ipcMain.handle(IpcChannels.TOOLS_REVEAL_FILE, async (_, id: string) => {
    try {
      const path = toolManager.ensureToolFile(id)
      if (!path) return { success: false, error: '工具不存在' }
      shell.showItemInFolder(path)
      return { success: true, data: { path } }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== 角色与元工具 IPC（dev.txt §4/§6）====================

  ipcMain.handle(IpcChannels.TOOLS_GET_ROLES, async () => {
    try {
      return { success: true, data: toolManager.getAllRoles() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_UPDATE_ROLE, async (_, id: string, updates: Record<string, unknown>) => {
    try {
      const result = toolManager.updateRole(id, updates as never)
      if (!result) return { success: false, error: '角色不存在' }
      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(
    IpcChannels.TOOLS_SEARCH,
    async (_, query: string, opts?: { group?: string; tags?: string[]; limit?: number }) => {
      try {
        const { searchTools } = await import('../tools/toolMetaTools')
        const cards = searchTools({
          query,
          group: opts?.group,
          tags: opts?.tags,
          limit: opts?.limit,
          tools: toolManager.getAllTools(),
          groups: toolManager.getAllGroups(),
        })
        return { success: true, data: cards }
      } catch (e) {
        return { success: false, error: (e as Error).message }
      }
    }
  )

  ipcMain.handle(IpcChannels.TOOLS_LOAD, async (_, ids: string[], sessionId?: string) => {
    try {
      const { loadTools } = await import('../tools/toolMetaTools')
      const res = loadTools(ids, toolManager.getAllTools(), toolManager.getAllRoles(), sessionId)
      return { success: true, data: res }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_UNLOAD, async (_, ids: string[], sessionId?: string) => {
    try {
      const { unloadTools } = await import('../tools/toolMetaTools')
      const res = unloadTools(ids, toolManager.getAllTools(), sessionId)
      return { success: true, data: res }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_ACTIVE, async (_, sessionId?: string) => {
    try {
      const { getActiveTools } = await import('../tools/toolMetaTools')
      const ids = getActiveTools(toolManager.getAllTools(), sessionId)
      const tools = ids.map(id => toolManager.getTool(id)).filter(Boolean)
      return { success: true, data: { ids, tools } }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== 度量与上下文状态（dev.txt §13）====================

  ipcMain.handle(IpcChannels.TOOLS_METRICS, async (_, since?: number) => {
    try {
      const { summarize } = await import('../tools/toolMetrics')
      return { success: true, data: summarize(since || 0) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_METRICS_RESET, async () => {
    try {
      const { resetMetrics } = await import('../tools/toolMetrics')
      resetMetrics()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== 参数级权限规则 ====================
  // 规则形如 "Bash(git status)"，可做 allow/deny/ask 三态。
  // 配置存 userData/permissions.json（不接受项目目录定义，见 permissionConfig 说明）。

  ipcMain.handle(IpcChannels.PERMISSIONS_GET_RULES, async () => {
    try {
      const { rulesToEntries, loadPermissionRules } = await import('../permissions/permissionConfig')
      const rules = await loadPermissionRules()
      return { success: true, data: rulesToEntries(rules) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PERMISSIONS_SET_RULES, async (_, entries: unknown) => {
    try {
      const { writePermissionRules } = await import('../permissions/permissionConfig')
      const { reloadToolPermissions } = await import('../engine-bridge')
      if (!Array.isArray(entries)) return { success: false, error: '规则必须是数组' }
      await writePermissionRules(entries as never)
      // 写盘后立即热更新到引擎，避免"改了配置要重启"
      const count = await reloadToolPermissions()
      return { success: true, count }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PERMISSIONS_RELOAD, async () => {
    try {
      const { reloadToolPermissions } = await import('../engine-bridge')
      const count = await reloadToolPermissions()
      return { success: true, count }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.PERMISSIONS_GET_PATH, async () => {
    try {
      const { getPermissionConfigPath } = await import('../permissions/permissionConfig')
      return { success: true, data: getPermissionConfigPath() }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // 预览解析结果：让 UI 能在用户输入规则字符串时立刻显示"解析成什么"，
  // 而不是等保存完才发现写错了工具名。
  ipcMain.handle(IpcChannels.PERMISSIONS_PARSE, async (_, rule: string) => {
    try {
      const { parsePermissionEntries } = await import('../permissions/permissionConfig')
      const parsed = parsePermissionEntries([
        { behavior: 'allow', rule: String(rule ?? '') },
      ])
      return { success: true, data: parsed.length > 0 ? parsed[0].value : null }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.TOOLS_CONTEXT_STATUS, async () => {
    try {
      const { useLayeredContext, computeToolBudget } = await import('../tools/toolContext')
      const { estimateTokens } = await import('../tools/toolContext')
      const tools = toolManager.getAllTools()
      const layered = useLayeredContext()
      // 全量模式下的成本基线，便于对比分层收益
      const fullCost = tools.reduce((n, t) => {
        return n + estimateTokens(JSON.stringify({ name: t.name, description: t.description, parameters: t.parameters }))
      }, 0)
      return {
        success: true,
        data: {
          layered,
          totalTools: tools.length,
          fullContextTokens: fullCost,
          budgetTokens: computeToolBudget(128000, Number(process.env.KX2_TOOL_BUDGET_PCT) || 20),
        },
      }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // ==================== Store Initialization ====================
  try {
    await storeManager.initialize()
    storeManager.setMainWindow(mainWindow)
    // store 就绪后重载工具管理数据：单例在模块 import 时 store 尚未初始化，
    // 只读到空兜底 store；此处补读磁盘上真实保存的分组/工具，避免「重启后分组丢失」。
    toolManager.reload()
    if (mainWindow && !storeManager.hasInitializationError()) {
      oauthManager.setMainWindow(mainWindow)
      updaterManager.initialize(mainWindow)
      const config = storeManager.getConfig()
      if (config.autoStartProxy) {
        console.log('[App] Auto-starting proxy service...')
        const proxyPort = config.proxyPort
        const proxyHost = config.proxyHost || '127.0.0.1'
        try {
          const success = await proxyServer.start(proxyPort, proxyHost)
          if (success) {
            proxyStartTime = Date.now()
            console.log('[App] Proxy service auto-started successfully, port:', proxyPort)
            const status = {
              isRunning: true,
              port: proxyPort,
              host: proxyHost,
              uptime: 0,
              connections: 0
            }
            mainWindow?.webContents.send(IpcChannels.PROXY_STATUS_CHANGED, status)
          } else {
            console.log('[App] Proxy service auto-start failed')
          }
        } catch (error) {
          console.error('[App] Proxy service auto-start failed:', error)
        }
      }
    }
  } catch (error) {
    console.error('[registerIpcHandlers] Store initialization failed:', error)
    storeManager.setMainWindow(mainWindow)
    registerErrorRecoveryHandlers(mainWindow)
    if (mainWindow) {
      mainWindow.webContents.send(IpcChannels.STORE_INIT_ERROR, {
        message: error instanceof Error ? error.message : '初始化存储失败'
      })
    }
    return
  }

  // ==================== Proxy IPC Handlers ====================

  ipcMain.handle(IpcChannels.PROXY_START, async (_, port?: number): Promise<boolean> => {
    try {
      if (proxyServer.isRunning()) {
        console.log('Proxy server is already running')
        return true
      }
      const config = storeManager.getConfig()
      const proxyPort = port || config.proxyPort
      const proxyHost = config.proxyHost || '127.0.0.1'
      const success = await proxyServer.start(proxyPort, proxyHost)
      if (success) {
        proxyStartTime = Date.now()
        console.log('Proxy server started on port:', proxyPort)
        const status = {
          isRunning: true,
          port: proxyPort,
          host: proxyHost,
          uptime: 0,
          connections: 0
        }
        mainWindow?.webContents.send(IpcChannels.PROXY_STATUS_CHANGED, status)
      }
      return success
    } catch (error) {
      console.error('Failed to start proxy:', error)
      return false
    }
  })

  ipcMain.handle(IpcChannels.PROXY_STOP, async (): Promise<boolean> => {
    try {
      if (!proxyServer.isRunning()) {
        return true
      }
      await proxyServer.stop()
      proxyStartTime = null
      console.log('Proxy server stopped')
      const status = {
        isRunning: false,
        port: 0,
        host: '',
        uptime: 0,
        connections: 0
      }
      mainWindow?.webContents.send(IpcChannels.PROXY_STATUS_CHANGED, status)
      return true
    } catch (error) {
      console.error('Failed to stop proxy:', error)
      return false
    }
  })

  ipcMain.handle(IpcChannels.PROXY_GET_STATUS, async (): Promise<ProxyStatus> => {
    const isRunning = proxyServer.isRunning()
    const port = proxyStatusManager.getPort()
    const host = isRunning
      ? proxyStatusManager.getHost()
      : storeManager.getConfig().proxyHost || proxyStatusManager.getHost()
    return {
      isRunning,
      port,
      host,
      uptime: proxyStartTime && isRunning ? Date.now() - proxyStartTime : 0,
      connections: proxyStatusManager.getStatistics().activeConnections,
    }
  })

  ipcMain.handle(IpcChannels.PROXY_GET_STATISTICS, async () => {
    const stats = proxyStatusManager.getStatistics()
    return {
      totalRequests: stats.totalRequests,
      successRequests: stats.successRequests,
      failedRequests: stats.failedRequests,
      avgLatency: stats.avgLatency,
      requestsPerMinute: stats.requestsPerMinute,
      activeConnections: stats.activeConnections,
      modelUsage: stats.modelUsage,
      providerUsage: stats.providerUsage,
      accountUsage: stats.accountUsage,
    }
  })

  ipcMain.handle(IpcChannels.PROXY_RESET_STATISTICS, async (): Promise<void> => {
    proxyStatusManager.resetStatistics()
  })

  ipcMain.handle(IpcChannels.CONFIG_GET, async () => {
    return storeManager.getConfig()
  })

  ipcMain.handle(IpcChannels.CONFIG_UPDATE, async (_, updates: Partial<AppConfig>) => {
    const newConfig = storeManager.updateConfig(updates)

    // 切换工具组时立即同步环境变量（KX2_TOOL_DEF_*），
    // 请求链路本来就会重新解析，这里只是让 env 状态即时可查。
    if (updates && 'enabledToolGroups' in updates) {
      try {
        const { resolveActiveToolsFromStore } = await import('../tools/toolRuntime.ts')
        const { resolved } = await resolveActiveToolsFromStore()
        console.log('[ToolRuntime] 生效工具组已切换:', resolved.isGlobal ? '全局组' : resolved.groupNames.join('+'), '工具数=', resolved.tools.length)
      } catch (e) {
        console.warn('[ToolRuntime] 同步工具组失败:', (e as Error).message)
      }
    }

    // 代理层/日志层参数热更新：去重窗口、流队列上限、探测超时等
    if (updates && ('proxyRuntime' in updates || 'logRuntime' in updates)) {
      try {
        const { applyAuxRuntimeConfig } = await import('../runtimeConfigApply.ts')
        applyAuxRuntimeConfig()
        console.log('[RuntimeConfig] 代理/日志参数已热更新')
      } catch (e) {
        console.warn('[RuntimeConfig] 同步代理/日志参数失败:', (e as Error).message)
      }
    }

    // 工具运行参数热更新：落盘策略 + 执行超时，改完即时生效
    if (updates && 'toolRuntime' in updates) {
      try {
        const { applyToolRuntimeConfig } = await import('../engine-bridge.ts')
        applyToolRuntimeConfig()
        console.log('[EngineBridge] 工具运行参数已热更新:', JSON.stringify(updates.toolRuntime))
      } catch (e) {
        console.warn('[EngineBridge] 同步工具运行参数失败:', (e as Error).message)
      }
    }

    // 账号熔断参数热更新：改完立即影响调度决策，无需重启
    if (updates && 'loadBalancer' in updates) {
      try {
        const { loadBalancer } = await import('../proxy/loadbalancer.ts')
        loadBalancer.updateOptions((updates as { loadBalancer?: never }).loadBalancer ?? {})
        console.log('[LoadBalancer] 熔断参数已热更新:', JSON.stringify(updates.loadBalancer))
      } catch (e) {
        console.warn('[LoadBalancer] 同步熔断参数失败:', (e as Error).message)
      }
    }

    // 循环控制参数热更新：改完设置立即生效，无需重启应用。
    // 与工具组同理 —— 引擎侧已持有实例，直接推给它即可。
    if (updates && 'agentLoop' in updates) {
      try {
        const { getEngineInstance } = await import('../engine-bridge.ts')
        const eng = getEngineInstance()
        if (eng) {
          eng.updateConfig({ agentLoop: (updates as { agentLoop?: unknown }).agentLoop })
          console.log('[EngineBridge] 循环控制参数已热更新:', JSON.stringify(updates.agentLoop))
        }
      } catch (e) {
        console.warn('[EngineBridge] 同步循环参数失败:', (e as Error).message)
      }
    }

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IpcChannels.CONFIG_CHANGED, newConfig)
      }
    })

    return true
  })

  ipcMain.handle(IpcChannels.STORE_GET, async (_, key: string): Promise<unknown> => {
    if (key === 'logs') {
      return storeManager.getLogs()
    }
    const store = storeManager.getStore()
    return store?.get(key)
  })

  ipcMain.handle(IpcChannels.STORE_SET, async (_, key: string, value: unknown): Promise<void> => {
    if (key === 'logs') {
      storeManager.replaceLogs(Array.isArray(value) ? value as LogEntry[] : [])
      return
    }
    const store = storeManager.getStore()
    store?.set(key as 'providers' | 'accounts' | 'config' | 'logs', value as never)
    if (key === 'config') {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IpcChannels.CONFIG_CHANGED, value)
        }
      })
    }
  })

  ipcMain.handle(IpcChannels.STORE_DELETE, async (_, key: string): Promise<void> => {
    if (key === 'logs') {
      storeManager.clearLogs()
      return
    }
    const store = storeManager.getStore()
    store?.delete(key as 'providers' | 'accounts' | 'config' | 'logs')
  })

  ipcMain.handle(IpcChannels.STORE_CLEAR_ALL, async (): Promise<void> => {
    storeManager.clearAll()
  })

  ipcMain.handle(IpcChannels.PROVIDERS_GET_ALL, async (): Promise<Provider[]> => {
    return ProviderManager.getAll()
  })

  ipcMain.handle(IpcChannels.PROVIDERS_GET_BUILTIN, async () => {
    return getBuiltinProviders()
  })

  ipcMain.handle(IpcChannels.PROVIDERS_ADD, async (_, data: {
    id?: string
    name: string
    type?: 'builtin' | 'custom'
    authType: AuthType
    apiEndpoint: string
    headers?: Record<string, string>
    description?: string
    supportedModels?: string[]
    credentialFields?: CredentialField[]
  }): Promise<Provider> => {
    return CustomProviderManager.create(data)
  })

  ipcMain.handle(IpcChannels.PROVIDERS_UPDATE, async (_, id: string, updates: Partial<Provider>): Promise<Provider | null> => {
    return ProviderManager.update(id, updates)
  })

  ipcMain.handle(IpcChannels.PROVIDERS_DELETE, async (_, id: string): Promise<boolean> => {
    return CustomProviderManager.delete(id)
  })

  ipcMain.handle(IpcChannels.PROVIDERS_CHECK_STATUS, async (_, providerId: string): Promise<ProviderCheckResult> => {
    const provider = ProviderManager.getById(providerId)

    if (!provider) {
      return {
        providerId,
        status: 'unknown',
        error: '供应商不存在',
      }
    }

    const result = await ProviderChecker.checkProviderStatus(provider)

    // Save status to provider
    ProviderManager.update(providerId, {
      status: result.status,
      lastStatusCheck: Date.now(),
    })

    return result
  })

  ipcMain.handle(IpcChannels.PROVIDERS_CHECK_ALL_STATUS, async (): Promise<Record<string, ProviderCheckResult>> => {
    const providers = ProviderManager.getAll()
    const results: Record<string, ProviderCheckResult> = {}

    await Promise.all(
      providers.map(async (provider) => {
        const result = await ProviderChecker.checkProviderStatus(provider)
        results[provider.id] = result

        // Save status to provider
        ProviderManager.update(provider.id, {
          status: result.status,
          lastStatusCheck: Date.now(),
        })
      })
    )

    return results
  })

  ipcMain.handle(IpcChannels.PROVIDERS_DUPLICATE, async (_, id: string): Promise<Provider> => {
    return CustomProviderManager.duplicate(id)
  })

  ipcMain.handle(IpcChannels.PROVIDERS_EXPORT, async (_, id: string): Promise<string> => {
    return CustomProviderManager.exportProvider(id)
  })

  ipcMain.handle(IpcChannels.PROVIDERS_IMPORT, async (_, jsonData: string): Promise<Provider> => {
    return CustomProviderManager.importProvider(jsonData)
  })

  ipcMain.handle(IpcChannels.PROVIDERS_SYNC_MODELS, async (_, providerId: string): Promise<{
    success: boolean
    supportedModels?: string[]
    modelMappings?: Record<string, string>
    error?: string
  }> => {
    try {
      const result = await ProviderChecker.fetchProviderModels(providerId)

      const provider = ProviderManager.getById(providerId)
      if (provider) {
        ProviderManager.update(providerId, {
          supportedModels: result.supportedModels,
          modelMappings: result.modelMappings,
        })
      }

      return {
        success: true,
        supportedModels: result.supportedModels,
        modelMappings: result.modelMappings,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '同步模型失败',
      }
    }
  })

  ipcMain.handle(IpcChannels.PROVIDERS_UPDATE_MODELS, async (_, providerId: string): Promise<{
    success: boolean
    modelsCount?: number
    error?: string
  }> => {
    try {
      const provider = ProviderManager.getById(providerId)

      if (!provider) {
        return {
          success: false,
          error: '供应商不存在',
        }
      }

      let modelsApiEndpoint: string | undefined
      let modelsApiHeaders: Record<string, string> | undefined

      if (provider.type === 'builtin') {
        const builtinConfig = getBuiltinProvider(providerId)
        if (builtinConfig) {
          modelsApiEndpoint = builtinConfig.modelsApiEndpoint
          modelsApiHeaders = builtinConfig.modelsApiHeaders
        }
      }

      if (!modelsApiEndpoint) {
        return {
          success: false,
          error: '该供应商不支持动态更新模型',
        }
      }

      const accounts = AccountManager.getByProviderId(providerId, true)
      const activeAccount = accounts.find(a => a.status === 'active')

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...modelsApiHeaders,
      }

      if (activeAccount?.credentials?.token) {
        requestHeaders['Authorization'] = `Bearer ${activeAccount.credentials.token}`
      }

      if (activeAccount?.credentials?.cookies) {
        requestHeaders['Cookie'] = activeAccount.credentials.cookies
      }

      const response = await axios.get(modelsApiEndpoint, {
        headers: requestHeaders,
        timeout: 15000,
        validateStatus: () => true,
      })

      if (response.status !== 200) {
        return {
          success: false,
          error: `获取模型失败：HTTP ${response.status}`,
        }
      }

      const models = response.data.data || response.data

      if (!Array.isArray(models) || models.length === 0) {
        return {
          success: false,
          error: '响应中未找到模型',
        }
      }

      const supportedModels: string[] = []
      const modelMappings: Record<string, string> = {}

      models.forEach((model: any) => {
        if (typeof model === 'string') {
          supportedModels.push(model)
          modelMappings[model] = model
        } else if (model && typeof model === 'object') {
          const modelId = model.id || model.model_id || model.name
          const modelName = model.name || model.display_name || modelId

          if (modelId) {
            supportedModels.push(modelName || modelId)
            modelMappings[modelName || modelId] = modelId
          }
        }
      })

      if (supportedModels.length === 0) {
        return {
          success: false,
          error: '解析响应中的模型失败',
        }
      }

      ProviderManager.update(providerId, {
        supportedModels,
        modelMappings,
      })

      return {
        success: true,
        modelsCount: supportedModels.length,
      }
    } catch (error) {
      console.error('[IPC] Failed to update models:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新模型失败',
      }
    }
  })

  ipcMain.handle(IpcChannels.PROVIDERS_GET_EFFECTIVE_MODELS, async (_, providerId: string) => {
    try {
      return storeManager.getEffectiveModels(providerId)
    } catch (error) {
      console.error('[IPC] Failed to get effective models:', error)
      return []
    }
  })

  ipcMain.handle(IpcChannels.PROVIDERS_ADD_CUSTOM_MODEL, async (_, providerId: string, model: { displayName: string; actualModelId: string }) => {
    try {
      return {
        success: true,
        models: storeManager.addCustomModel(providerId, model),
      }
    } catch (error) {
      console.error('[IPC] Failed to add custom model:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '添加自定义模型失败',
        models: [],
      }
    }
  })

  ipcMain.handle(IpcChannels.PROVIDERS_REMOVE_MODEL, async (_, providerId: string, modelName: string) => {
    try {
      return {
        success: true,
        models: storeManager.removeModel(providerId, modelName),
      }
    } catch (error) {
      console.error('[IPC] Failed to remove model:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '移除模型失败',
        models: [],
      }
    }
  })

  ipcMain.handle(IpcChannels.PROVIDERS_RESET_MODELS, async (_, providerId: string) => {
    try {
      return {
        success: true,
        models: storeManager.resetModels(providerId),
      }
    } catch (error) {
      console.error('[IPC] Failed to reset models:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '重置模型失败',
        models: [],
      }
    }
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_GET_ALL, async (_, includeCredentials?: boolean): Promise<Account[]> => {
    return AccountManager.getAll(includeCredentials)
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_GET_BY_ID, async (_, id: string, includeCredentials?: boolean): Promise<Account | null> => {
    return storeManager.getAccountById(id, includeCredentials) || null
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_GET_BY_PROVIDER, async (_, providerId: string): Promise<Account[]> => {
    return storeManager.getAccountsByProviderId(providerId)
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_ADD, async (_, data: {
    providerId: string
    name: string
    email?: string
    credentials: Record<string, string>
    dailyLimit?: number
  }): Promise<Account> => {
    return AccountManager.create(data)
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_UPDATE, async (_, id: string, updates: Partial<Account>): Promise<Account | null> => {
    return AccountManager.update(id, updates)
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_DELETE, async (_, id: string): Promise<boolean> => {
    return AccountManager.delete(id)
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_RESET_STATUS, async (_, id: string, status: AccountStatus = 'active'): Promise<Account | null> => {
    return AccountManager.updateStatus(id, status)
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_VALIDATE, async (_, accountId: string): Promise<boolean> => {
    const result = await AccountManager.validate(accountId)
    return result.valid
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_VALIDATE_TOKEN, async (_, providerId: string, credentials: Record<string, string>) => {
    let provider = ProviderManager.getById(providerId)

    // If provider not in store, check builtin providers
    if (!provider) {
      const builtinConfig = getBuiltinProvider(providerId)
      if (builtinConfig) {
        provider = {
          id: builtinConfig.id,
          name: builtinConfig.name,
          type: 'builtin',
          authType: builtinConfig.authType,
          apiEndpoint: builtinConfig.apiEndpoint,
          headers: builtinConfig.headers,
          enabled: true,
          description: builtinConfig.description,
          supportedModels: builtinConfig.supportedModels || [],
          modelMappings: builtinConfig.modelMappings || {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      }
    }

    if (!provider) {
      return { valid: false, error: '供应商不存在' }
    }

    const tempAccount: Account = {
      id: 'temp',
      providerId,
      name: 'temp',
      credentials,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    return ProviderChecker.checkAccountToken(provider, tempAccount)
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_GET_CREDITS, async (_, accountId: string): Promise<{
    totalCredits: number
    usedCredits: number
    remainingCredits: number
  } | null> => {
    const account = AccountManager.getById(accountId, true)
    if (!account) {
      return null
    }

    const provider = ProviderManager.getById(account.providerId)
    if (!provider) {
      return null
    }

    if (provider.id !== 'minimax') {
      return null
    }

    try {
      const adapter = new MiniMaxAdapter(provider, account)
      return await adapter.getCredits()
    } catch (error) {
      console.error('[IPC] Failed to get credits:', error)
      return null
    }
  })

  ipcMain.handle(IpcChannels.ACCOUNTS_CLEAR_CHATS, async (_, accountId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const account = AccountManager.getById(accountId, true)
      if (!account) {
        return { success: false, error: '账户不存在' }
      }

      const provider = ProviderManager.getById(account.providerId)
      if (!provider) {
        return { success: false, error: '供应商不存在' }
      }

      const clearChats = clearChatsHandlers[provider.id]
      if (!clearChats) {
        return { success: false, error: '该供应商不支持此功能' }
      }

      const success = await clearChats(provider, account)
      return { success }
    } catch (error) {
      console.error('[IPC] Failed to clear chats:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '清空会话失败'
      }
    }
  })

  ipcMain.handle(IpcChannels.OAUTH_START_LOGIN, async (_, providerId: string, providerType: ProviderVendor): Promise<OAuthResult> => {
    console.log('Starting OAuth login:', providerId, providerType)
    return await oauthManager.startLogin({
      providerId,
      providerType: providerType as ProviderType,
    })
  })

  ipcMain.handle(IpcChannels.OAUTH_CANCEL_LOGIN, async (): Promise<void> => {
    console.log('Cancel OAuth login')
    await oauthManager.cancelLogin()
  })

  ipcMain.handle(IpcChannels.OAUTH_LOGIN_WITH_TOKEN, async (_, data: { providerId: string, providerType: ProviderVendor, token: string, realUserID?: string, mimoUserId?: string, mimoPhToken?: string }): Promise<OAuthResult> => {
    return await oauthManager.loginWithToken(data.providerId, data.providerType as ProviderType, data.token, data.realUserID, data.mimoUserId, data.mimoPhToken)
  })

  ipcMain.handle(IpcChannels.OAUTH_START_IN_APP_LOGIN, async (_, data: { providerId: string, providerType: ProviderVendor, timeout?: number }): Promise<OAuthResult> => {
    console.log('Starting in-app OAuth login:', data.providerId, data.providerType)
    const config = storeManager.getConfig()
    const proxyMode = (config as any).oauthProxyMode || 'system'
    return await oauthManager.startInAppLogin(data.providerId, data.providerType as ProviderType, data.timeout, proxyMode)
  })

  ipcMain.handle(IpcChannels.OAUTH_CANCEL_IN_APP_LOGIN, async (): Promise<void> => {
    console.log('Cancel in-app OAuth login')
    oauthManager.cancelInAppLogin()
  })

  ipcMain.handle(IpcChannels.OAUTH_IN_APP_LOGIN_STATUS, async (): Promise<boolean> => {
    return oauthManager.isInAppLoginOpen()
  })

  ipcMain.handle(IpcChannels.OAUTH_VALIDATE_TOKEN, async (_, data: { providerId: string, providerType: ProviderVendor, credentials: Record<string, string> }) => {
    return await oauthManager.validateToken(data.providerId, data.providerType as ProviderType, data.credentials)
  })

  ipcMain.handle(IpcChannels.OAUTH_REFRESH_TOKEN, async (_, data: { providerId: string, providerType: ProviderVendor, credentials: Record<string, string> }) => {
    return await oauthManager.refreshToken(data.providerId, data.providerType as ProviderType, data.credentials)
  })

  ipcMain.handle(IpcChannels.OAUTH_GET_STATUS, async (): Promise<string> => {
    return oauthManager.getStatus()
  })

  ipcMain.handle(IpcChannels.LOGS_GET, async (_, filter?: {
    level?: LogLevel | 'all'
    keyword?: string
    startTime?: number
    endTime?: number
    limit?: number
    offset?: number
  }): Promise<LogEntry[]> => {
    return storeManager.getLogs(filter)
  })

  ipcMain.handle(IpcChannels.LOGS_GET_STATS, async () => {
    return storeManager.getLogStats()
  })

  ipcMain.handle(IpcChannels.LOGS_GET_TREND, async (_, days?: number) => {
    return storeManager.getLogTrend(days)
  })

  ipcMain.handle(IpcChannels.LOGS_GET_ACCOUNT_TREND, async (_, accountId: string, days?: number) => {
    return storeManager.getAccountLogTrend(accountId, days)
  })

  ipcMain.handle(IpcChannels.LOGS_CLEAR, async (): Promise<void> => {
    storeManager.clearLogs()
  })

  ipcMain.handle(IpcChannels.LOGS_EXPORT, async (_, format?: 'json' | 'txt'): Promise<string> => {
    return storeManager.exportLogs(format)
  })

  ipcMain.handle(IpcChannels.LOGS_GET_BY_ID, async (_, id: string): Promise<LogEntry | undefined> => {
    return storeManager.getLogById(id)
  })

  // ==================== Request Logs Handlers ====================

  ipcMain.handle(IpcChannels.REQUEST_LOGS_GET, async (_, filter?: {
    status?: 'success' | 'error'
    providerId?: string
    limit?: number
  }) => {
    return storeManager.getRequestLogs(filter?.limit, filter)
  })

  ipcMain.handle(IpcChannels.REQUEST_LOGS_GET_BY_ID, async (_, id: string) => {
    return storeManager.getRequestLogById(id)
  })

  ipcMain.handle(IpcChannels.REQUEST_LOGS_GET_STATS, async () => {
    return storeManager.getRequestLogStats()
  })

  ipcMain.handle(IpcChannels.REQUEST_LOGS_GET_TREND, async (_, days?: number) => {
    return storeManager.getRequestLogTrend(days)
  })

  ipcMain.handle(IpcChannels.REQUEST_LOGS_CLEAR, async (): Promise<void> => {
    storeManager.clearRequestLogs()
  })

  // ==================== Statistics Handlers ====================

  ipcMain.handle(IpcChannels.STATISTICS_GET, async () => {
    return storeManager.getStatistics()
  })

  ipcMain.handle(IpcChannels.STATISTICS_GET_TODAY, async () => {
    return storeManager.getTodayStatistics()
  })

  ipcMain.handle(IpcChannels.APP_GET_VERSION, async (): Promise<string> => {
    return app.getVersion()
  })

  ipcMain.handle(IpcChannels.APP_CHECK_UPDATE, async () => {
    try {
      await updaterManager.checkForUpdates()
      return updaterManager.getStatus()
    } catch (error) {
      console.error('[App] Check update error:', error)
      return {
        ...updaterManager.getStatus(),
        checking: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle(IpcChannels.APP_DOWNLOAD_UPDATE, async (): Promise<void> => {
    await updaterManager.downloadUpdate()
  })

  ipcMain.handle(IpcChannels.APP_INSTALL_UPDATE, async (): Promise<void> => {
    updaterManager.quitAndInstall()
  })

  ipcMain.handle(IpcChannels.APP_GET_UPDATE_STATUS, async () => {
    return updaterManager.getStatus()
  })

  ipcMain.handle(IpcChannels.APP_MINIMIZE, async (): Promise<void> => {
    mainWindow?.minimize()
  })

  ipcMain.handle(IpcChannels.APP_MAXIMIZE, async (): Promise<void> => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle(IpcChannels.APP_CLOSE, async (): Promise<void> => {
    const config = storeManager.getConfig()
    if (config.minimizeToTray) {
      mainWindow?.hide()
    } else {
      app.isQuitting = true
      mainWindow?.close()
    }
  })

  ipcMain.handle(IpcChannels.APP_SHOW_WINDOW, async (): Promise<void> => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  ipcMain.handle(IpcChannels.APP_HIDE_WINDOW, async (): Promise<void> => {
    mainWindow?.hide()
  })

  ipcMain.handle(IpcChannels.APP_OPEN_EXTERNAL, async (_, url: string): Promise<void> => {
    console.log('[APP_OPEN_EXTERNAL] Opening URL:', url)
    try {
      await shell.openExternal(url)
      console.log('[APP_OPEN_EXTERNAL] Successfully opened')
    } catch (error) {
      console.error('[APP_OPEN_EXTERNAL] Error:', error)
      throw error
    }
  })

  // ==================== System Prompts Handlers ====================

  ipcMain.handle(IpcChannels.PROMPTS_GET_ALL, async (): Promise<SystemPrompt[]> => {
    return storeManager.getSystemPrompts()
  })

  ipcMain.handle(IpcChannels.PROMPTS_GET_BUILTIN, async (): Promise<SystemPrompt[]> => {
    return storeManager.getBuiltinPrompts()
  })

  ipcMain.handle(IpcChannels.PROMPTS_GET_CUSTOM, async (): Promise<SystemPrompt[]> => {
    return storeManager.getCustomPrompts()
  })

  ipcMain.handle(IpcChannels.PROMPTS_GET_BY_ID, async (_, id: string): Promise<SystemPrompt | undefined> => {
    return storeManager.getSystemPromptById(id)
  })

  ipcMain.handle(IpcChannels.PROMPTS_ADD, async (_, prompt: Omit<SystemPrompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<SystemPrompt> => {
    return storeManager.addSystemPrompt(prompt)
  })

  ipcMain.handle(IpcChannels.PROMPTS_UPDATE, async (_, id: string, updates: Partial<SystemPrompt>): Promise<SystemPrompt | null> => {
    return storeManager.updateSystemPrompt(id, updates)
  })

  ipcMain.handle(IpcChannels.PROMPTS_DELETE, async (_, id: string): Promise<boolean> => {
    return storeManager.deleteSystemPrompt(id)
  })

  ipcMain.handle(IpcChannels.PROMPTS_GET_BY_TYPE, async (_, type: SystemPrompt['type']): Promise<SystemPrompt[]> => {
    return storeManager.getSystemPromptsByType(type)
  })

  // ==================== Session Management Handlers ====================

  ipcMain.handle(IpcChannels.SESSION_GET_CONFIG, async (): Promise<SessionConfig> => {
    return sessionManager.getSessionConfig()
  })

  ipcMain.handle(IpcChannels.SESSION_UPDATE_CONFIG, async (_, updates: Partial<SessionConfig>): Promise<SessionConfig> => {
    return sessionManager.updateSessionConfig(updates)
  })

  ipcMain.handle(IpcChannels.SESSION_GET_ALL, async (): Promise<SessionRecord[]> => {
    return sessionManager.getAllSessions()
  })

  ipcMain.handle(IpcChannels.SESSION_GET_ACTIVE, async (): Promise<SessionRecord[]> => {
    return sessionManager.getAllActiveSessions()
  })

  ipcMain.handle(IpcChannels.SESSION_GET_BY_ID, async (_, id: string): Promise<SessionRecord | undefined> => {
    return sessionManager.getSession(id)
  })

  ipcMain.handle(IpcChannels.SESSION_GET_BY_ACCOUNT, async (_, accountId: string): Promise<SessionRecord[]> => {
    return sessionManager.getSessionsByAccount(accountId)
  })

  ipcMain.handle(IpcChannels.SESSION_GET_BY_PROVIDER, async (_, providerId: string): Promise<SessionRecord[]> => {
    return sessionManager.getSessionsByProvider(providerId)
  })

  ipcMain.handle(IpcChannels.SESSION_DELETE, async (_, id: string): Promise<boolean> => {
    return sessionManager.deleteSession(id)
  })

  ipcMain.handle(IpcChannels.SESSION_CLEAR_ALL, async (): Promise<void> => {
    return sessionManager.clearAllSessions()
  })

  ipcMain.handle(IpcChannels.SESSION_CLEAN_EXPIRED, async (): Promise<number> => {
    return sessionManager.cleanExpiredSessions()
  })

  // ==================== Management API Handlers ====================

  ipcMain.handle(IpcChannels.MANAGEMENT_API_GET_CONFIG, async (): Promise<ManagementApiConfig> => {
    const config = ConfigManager.get()
    return config.managementApi
  })

  ipcMain.handle(IpcChannels.MANAGEMENT_API_UPDATE_CONFIG, async (_, updates: Partial<ManagementApiConfig>): Promise<ManagementApiConfig> => {
    const config = ConfigManager.get()
    const currentManagementConfig = config.managementApi
    const newManagementConfig = { ...currentManagementConfig, ...updates }

    ConfigManager.update({ managementApi: newManagementConfig })

    return newManagementConfig
  })

  ipcMain.handle(IpcChannels.MANAGEMENT_API_GENERATE_SECRET, async (): Promise<string> => {
    const newSecret = generateManagementSecret()

    const config = ConfigManager.get()
    const newManagementConfig = { ...config.managementApi, managementApiSecret: newSecret }
    ConfigManager.update({ managementApi: newManagementConfig })

    return newSecret
  })

  // ==================== Context Management Handlers ====================

  ipcMain.handle(IpcChannels.CONTEXT_MANAGEMENT_GET_CONFIG, async () => {
    const config = ConfigManager.get()
    return config.contextManagement || {
      enabled: true,
      strategies: {
        slidingWindow: { enabled: true, maxMessages: 20 },
        tokenLimit: { enabled: false, maxTokens: 4000 },
        summary: { enabled: false, keepRecentMessages: 20 },
      },
      executionOrder: ['slidingWindow', 'tokenLimit', 'summary'],
    }
  })

  ipcMain.handle(IpcChannels.CONTEXT_MANAGEMENT_UPDATE_CONFIG, async (_, updates: Partial<any>) => {
    const config = ConfigManager.get()
    const defaultContextConfig = {
      enabled: true,
      strategies: {
        slidingWindow: { enabled: true, maxMessages: 20 },
        tokenLimit: { enabled: false, maxTokens: 4000 },
        summary: { enabled: false, keepRecentMessages: 20 },
      },
      executionOrder: ['slidingWindow', 'tokenLimit', 'summary'],
    }
    const currentContextConfig = config.contextManagement || defaultContextConfig
    const newContextConfig = {
      ...currentContextConfig,
      ...updates,
      strategies: {
        ...currentContextConfig.strategies,
        ...(updates.strategies || {}),
      },
    }

    ConfigManager.update({ contextManagement: newContextConfig })

    return newContextConfig
  })

  // ==================== Tool Plugins Handlers ====================

  ipcMain.handle(IpcChannels.PLUGINS_GET_ENABLED_LIST, async (): Promise<string[]> => {
    const config = ConfigManager.get()
    return config.enabledPlugins || []
  })

  ipcMain.handle(IpcChannels.PLUGINS_SET_ENABLED_LIST, async (_, ids: string[]): Promise<string[]> => {
    const validIds = new Set(allLegacyToolPlugins.map(p => p.id))
    const filtered = ids.filter(id => validIds.has(id))
    ConfigManager.update({ enabledPlugins: filtered })
    return filtered
  })
}

export function getProxyStatus(): ProxyStatus {
  const isRunning = proxyServer.isRunning()
  const port = proxyStatusManager.getPort()
  const host = isRunning
    ? proxyStatusManager.getHost()
    : storeManager.getConfig().proxyHost || proxyStatusManager.getHost()
  return {
    isRunning,
    port,
    host,
    uptime: proxyStartTime && isRunning ? Date.now() - proxyStartTime : 0,
    connections: proxyStatusManager.getStatistics().activeConnections,
  }
}

export function setProxyStatus(status: ProxyStatus): void {
  // Status is managed by proxyServer instance, only update startTime here
  if (status.isRunning && !proxyStartTime) {
    proxyStartTime = Date.now()
  } else if (!status.isRunning) {
    proxyStartTime = null
  }
}

function registerErrorRecoveryHandlers(mainWindow: BrowserWindow | null): void {
  ipcMain.handle(IpcChannels.STORE_RETRY_INIT, async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await storeManager.initialize()
      if (!storeManager.hasInitializationError()) {
        toolManager.reload()
        mainWindow?.webContents.send(IpcChannels.STORE_INIT_ERROR, { message: null })
        return { success: true }
      }
      return {
        success: false,
        error: storeManager.getInitializationError()?.message || '未知错误'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '初始化存储失败'
      }
    }
  })

  ipcMain.handle(IpcChannels.APP_GET_VERSION, async (): Promise<string> => {
    return app.getVersion()
  })

  ipcMain.handle(IpcChannels.APP_CLOSE, async (): Promise<void> => {
    app.isQuitting = true
    mainWindow?.close()
  })
}

export async function setupChatHandlers(mainWindow: BrowserWindow | null): Promise<void> {
  // Chat handlers are in chat-handlers.ts
  const { registerChatHandlers } = await import('./chat-handlers')
  registerChatHandlers(mainWindow)
}

export async function setupEngineHandlers(mainWindow: BrowserWindow | null): Promise<void> {
  // Engine handlers are in engine-bridge.ts
  const { registerEngineHandlers } = await import('../engine-bridge')
  registerEngineHandlers(mainWindow)
}
