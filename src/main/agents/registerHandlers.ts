/**
 * Agent IPC handlers — 注册到 ipcMain
 *
 * 职责：
 * - 将 Agent CRUD + 执行请求桥接到 AgentService
 * - 将执行事件通过 IPC 推送到渲染层
 */

import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '../ipc/channels'
import type { AgentRecord } from './types'
import { ModuleDataStore } from '../ipc/ModuleDataStore'
import { setExecutorMainWindow, startExecution, stopExecution, getRunningAgentIds, onComplete, onError } from './ExecutorRunner'

let mainWindow: BrowserWindow | null = null
let handlersRegistered = false

// 导出 store 引用供 backup/restore 使用（横切关注点）
export { agentsStore }

// ==================== Store 初始化（内部实现细节，对外隐藏） ====================

const DEFAULT_AGENTS: Omit<AgentRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '代码审查员',
    role: 'Code Reviewer',
    systemPrompt: '你是一位经验丰富的代码审查员。请检查代码中的潜在问题：安全漏洞、性能瓶颈、可读性、边界条件、错误处理。给出具体行号和建议的修复方案。',
    model: null,
    status: 'idle',
  },
  {
    name: '重构助手',
    role: 'Refactoring Assistant',
    systemPrompt: '你是一位软件重构专家。分析代码结构，识别重复代码、过长函数、深层嵌套等问题，提供逐步重构建议。保持行为不变的前提下提升可维护性。',
    model: null,
    status: 'idle',
  },
  {
    name: '测试生成器',
    role: 'Test Generator',
    systemPrompt: '你是一位测试工程师。根据给定的代码逻辑生成全面的单元测试，覆盖正常路径、边界条件和异常情况。输出可直接运行的测试代码。',
    model: null,
    status: 'idle',
  },
  {
    name: '文档编写员',
    role: 'Documentation Writer',
    systemPrompt: '你是一位技术文档专家。根据代码和注释生成清晰、完整的文档，包括 API 说明、使用示例、参数描述和注意事项。',
    model: null,
    status: 'idle',
  },
]

const agentsStore = new ModuleDataStore<AgentRecord>('agents')

function seedIfEmpty(): void {
  if (agentsStore.size === 0) {
    const now = Date.now()
    for (const data of DEFAULT_AGENTS) {
      const id = `agent_${now}_${Math.random().toString(36).slice(2, 9)}`
      agentsStore.set(id, {
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
      } as AgentRecord)
    }
    console.log('[IPC] Seeded', DEFAULT_AGENTS.length, 'default agents')
  }
}

// ==================== IPC 注册 ====================

export function registerAgentHandlers(main: BrowserWindow): void {
  if (handlersRegistered) return
  handlersRegistered = true

  mainWindow = main
  setExecutorMainWindow(main)
  seedIfEmpty()

  // CRUD

  ipcMain.handle(IpcChannels.AGENTS_GET_ALL, async () => {
    try { return { success: true, data: agentsStore.getAll() }
    } catch (e) { return { success: false, error: (e as Error).message } }
  })

  ipcMain.handle(IpcChannels.AGENTS_GET_BY_ID, async (_, id: string) => {
    try {
      const agent = agentsStore.getById(id)
      if (agent) return { success: true, data: agent }
      return { success: false, error: '智能体不存在' }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.AGENTS_CREATE, async (_, data: Omit<AgentRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const now = Date.now()
      const id = `agent_${now}_${Math.random().toString(36).slice(2, 9)}`
      const agent: AgentRecord = { ...data, id, createdAt: now, updatedAt: now }
      agentsStore.set(id, agent)
      return { success: true, data: agent }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.AGENTS_UPDATE, async (_, id: string, data: Partial<Omit<AgentRecord, 'id' | 'createdAt'>>) => {
    try {
      const existing = agentsStore.getById(id)
      if (!existing) return { success: false, error: '智能体不存在' }
      const updated: AgentRecord = { ...existing, ...data, updatedAt: Date.now() }
      agentsStore.set(id, updated)
      return { success: true, data: updated }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.AGENTS_DELETE, async (_, id: string) => {
    try {
      // 如果正在执行，先中止
      stopExecution(id)
      return { success: agentsStore.delete(id) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // Execute — 启动异步执行，立即返回

  ipcMain.handle(IpcChannels.AGENTS_EXECUTE, async (_, id: string, input: string) => {
    try {
      const agent = agentsStore.getById(id)
      if (!agent) return { success: false, error: '智能体不存在' }

      if (agent.status === 'running') {
        return { success: false, error: '智能体已在运行' }
      }

      startExecution(id, input)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // Abort — 中止执行

  ipcMain.handle(IpcChannels.AGENTS_ABORT, async (_, id: string) => {
    try {
      const success = stopExecution(id)
      return { success }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // Get Running — 获取正在执行的 Agent 列表

  ipcMain.handle(IpcChannels.AGENTS_GET_RUNNING, async () => {
    try {
      const ids = getRunningAgentIds()
      return { success: true, data: ids }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // Stream listeners（通过 ExecutorRunner 注册内部监听器，IPC 推送在 runner 内部处理）
}
