/**
 * Agent IPC handlers — 注册到 ipcMain
 *
 * 职责：
 * - 将 Agent CRUD + 执行请求桥接到 AgentService
 * - 将执行事件通过 IPC 推送到渲染层
 */

import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '../ipc/channels'
import type { AgentRecord, AgentExecutionEvent } from './types'
import { ModuleDataStore } from '../ipc/ModuleDataStore'

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
      return { success: false, error: 'Agent not found' }
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
      if (!existing) return { success: false, error: 'Agent not found' }
      const updated: AgentRecord = { ...existing, ...data, updatedAt: Date.now() }
      agentsStore.set(id, updated)
      return { success: true, data: updated }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  ipcMain.handle(IpcChannels.AGENTS_DELETE, async (_, id: string) => {
    try {
      return { success: agentsStore.delete(id) }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })

  // Execute — 流式输出

  ipcMain.handle(IpcChannels.AGENTS_EXECUTE, async (event, id: string, input: string) => {
    try {
      const agent = agentsStore.getById(id)
      if (!agent) return { success: false, error: 'Agent not found' }

      const sender = event.sender
      const sendEvent = (data: Record<string, unknown>) => {
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.AGENTS_STREAM_OUTPUT, data)
        }
      }

      const sendDone = (data: Record<string, unknown>) => {
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.AGENTS_STREAM_DONE, data)
        }
      }

      const sendError = (data: Record<string, unknown>) => {
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.AGENTS_STREAM_ERROR, data)
        }
      }

      // TODO: 替换为真实的 AgentExecutor
      // 当前为基本实现：模拟流式输出
      agentsStore.set(id, { ...agent, status: 'running', updatedAt: Date.now() })

      try {
        const output = `[${agent.name}] 执行结果:\n\n根据你的输入「${input}」，我已完成分析。\n\n建议：\n1. 检查代码结构\n2. 优化性能瓶颈\n3. 添加错误处理`

        const words = output.split('')
        for (const char of words) {
          sendEvent({ agentId: id, content: char })
          await new Promise(r => setTimeout(r, 10))
        }

        agentsStore.set(id, { ...agent, status: 'idle', updatedAt: Date.now(), lastActiveAt: Date.now() })
        sendDone({ agentId: id, success: true, output, error: '' })
        return { success: true }
      } catch (execError) {
        agentsStore.set(id, { ...agent, status: 'error', updatedAt: Date.now() })
        const msg = (execError as Error).message
        sendError({ agentId: id, error: msg })
        return { success: false, error: msg }
      }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
