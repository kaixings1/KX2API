/**
 * Agent 执行生命周期管理
 *
 * 职责：
 * - 管理并发执行（每个 agentId 同时只能有一个执行实例）
 * - 异步调度执行，不阻塞 IPC 响应
 * - 通过 IPC 推送流式事件到渲染层
 * - 支持中止执行
 * - 执行完成/错误时通知监听器
 */

import { BrowserWindow } from 'electron'
import { IpcChannels } from '../ipc/channels'
import { agentsStore } from './registerHandlers'
import { AgentExecutor } from './AgentExecutor'
// AgentRecord 的单一真源是 ./types（registerHandlers 只是本地重声明，并未导出）
import type { AgentExecutionEvent, AgentRecord } from './types'

type AbortSignal = { aborted: boolean; reason?: string }

interface RunningExecution {
  agentId: string
  controller: AbortSignal
  executor: AgentExecutor
}

// 全局执行注册表
const running = new Map<string, RunningExecution>()
const completeListeners = new Map<string, Set<(event: { agentId: string; success: boolean; output?: string }) => void>>()
const errorListeners = new Map<string, Set<(event: { agentId: string; error: string }) => void>>()

let mainWindow: BrowserWindow | null = null

export function setExecutorMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

/**
 * 启动 Agent 执行（非阻塞）
 */
export function startExecution(agentId: string, input: string): void {
  // 已有执行实例则忽略
  if (running.has(agentId)) return

  const controller: AbortSignal = { aborted: false }
  const executor = new AgentExecutor()
  const agent = agentsStore.getById(agentId)
  if (!agent) return

  // 更新状态为 running
  agentsStore.set(agentId, { ...agent, status: 'running', updatedAt: Date.now() })

  const record: RunningExecution = { agentId, controller, executor }
  running.set(agentId, record)

  // 异步执行，不阻塞调用者
  ;(async () => {
    try {
      for await (const event of executor.execute(agent, input)) {
        if (controller.aborted) break
        await sendEvent(event)
      }

      if (!controller.aborted) {
        running.delete(agentId)
        agentsStore.set(agentId, { ...agent, status: 'idle', updatedAt: Date.now(), lastActiveAt: Date.now() })
        notifyListeners(completeListeners, agentId, { agentId, success: true })
      }
    } catch (error) {
      if (controller.aborted) return
      running.delete(agentId)
      const msg = error instanceof Error ? error.message : String(error)
      agentsStore.set(agentId, { ...agent, status: 'error', updatedAt: Date.now() })
      sendError({ agentId, error: msg })
      notifyListeners(errorListeners, agentId, { agentId, error: msg })
    }
  })()
}

/**
 * 中止执行
 */
export function stopExecution(agentId: string): boolean {
  const record = running.get(agentId)
  if (!record) return false

  record.controller.aborted = true
  record.controller.reason = 'user_abort'
  running.delete(agentId)

  const agent = agentsStore.getById(agentId)
  if (agent) {
    agentsStore.set(agentId, { ...agent, status: 'idle', updatedAt: Date.now() })
  }

  sendError({ agentId, error: '执行已被中止' })
  return true
}

/**
 * 获取正在执行的 agentId 列表
 */
export function getRunningAgentIds(): string[] {
  return Array.from(running.keys())
}

/**
 * 注册完成监听器
 */
export function onComplete(agentId: string, cb: (event: { agentId: string; success: boolean; output?: string }) => void): () => void {
  if (!completeListeners.has(agentId)) {
    completeListeners.set(agentId, new Set())
  }
  completeListeners.get(agentId)!.add(cb)
  return () => completeListeners.get(agentId)?.delete(cb)
}

/**
 * 注册错误监听器
 */
export function onError(agentId: string, cb: (event: { agentId: string; error: string }) => void): () => void {
  if (!errorListeners.has(agentId)) {
    errorListeners.set(agentId, new Set())
  }
  errorListeners.get(agentId)!.add(cb)
  return () => errorListeners.get(agentId)?.delete(cb)
}

// ==================== 内部辅助方法 ====================

async function sendEvent(event: AgentExecutionEvent): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return
  // agentId 是事件路由依据；缺失说明事件不由本执行器产生，直接忽略
  if (!event.agentId) return

  if (event.type === 'chunk' && event.content) {
    mainWindow.webContents.send(IpcChannels.AGENTS_STREAM_OUTPUT, {
      agentId: event.agentId,
      content: event.content,
    })
  } else if (event.type === 'done') {
    mainWindow.webContents.send(IpcChannels.AGENTS_STREAM_DONE, {
      agentId: event.agentId,
      success: true,
      output: event.output || '',
      error: '',
    })
  } else if (event.type === 'error') {
    sendError({ agentId: event.agentId, error: event.error || '未知错误' })
  }
}

function sendError(data: { agentId: string; error: string }): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(IpcChannels.AGENTS_STREAM_ERROR, data)
}

function notifyListeners(
  map: Map<string, Set<Function>>,
  agentId: string,
  data: unknown,
): void {
  map.get(agentId)?.forEach(cb => {
    try { cb(data) } catch { /* ignore listener errors */ }
  })
  // 通知完成后清空该 agentId 的监听器
  map.delete(agentId)
}
