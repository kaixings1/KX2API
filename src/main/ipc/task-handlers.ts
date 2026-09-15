/**
 * main/ipc/task-handlers.ts — Task IPC handlers
 *
 * 职责：
 * - 提供任务的 CRUD + 执行/中止 IPC 接口
 * - 将执行事件通过 IPC 推送到渲染层
 */

import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from './channels'
import { executeTask, abortTask, getRunningExecutions } from '../tasks/taskExecutor'
import { tasksStore, type TaskRecord } from '../tasks/tasksStore'

let mainWindow: BrowserWindow | null = null

export function registerTaskHandlers(main: BrowserWindow): void {
  mainWindow = main

  // ==================== CRUD ====================

  ipcMain.handle(IpcChannels.TASKS_GET_ALL, async (): Promise<TaskRecord[]> => {
    return tasksStore.getAll()
  })

  ipcMain.handle(IpcChannels.TASKS_GET_BY_ID, async (_event, id: string): Promise<TaskRecord | null> => {
    return tasksStore.getById(id) || null
  })

  ipcMain.handle(IpcChannels.TASKS_CREATE, async (_event, data: Omit<TaskRecord, 'id' | 'createdAt'>): Promise<TaskRecord> => {
    return tasksStore.create(data)
  })

  ipcMain.handle(IpcChannels.TASKS_UPDATE, async (_event, id: string, updates: Partial<TaskRecord>): Promise<TaskRecord | null> => {
    return tasksStore.update(id, updates)
  })

  ipcMain.handle(IpcChannels.TASKS_DELETE, async (_event, id: string): Promise<boolean> => {
    return tasksStore.delete(id)
  })

  ipcMain.handle(IpcChannels.TASKS_SET_STATUS, async (_event, id: string, status: TaskRecord['status']): Promise<TaskRecord | null> => {
    return tasksStore.setStatus(id, status)
  })

  // ==================== Execute ====================

  ipcMain.handle(IpcChannels.TASKS_EXECUTE, async (event, taskId: string) => {
    const sender = event.sender
    const sendEvent = (data: Record<string, unknown>) => {
      if (!sender.isDestroyed()) {
        sender.send(IpcChannels.TASKS_STREAM_EVENT, data)
      }
    }

    const exec = executeTask({
      taskId,
      onComplete: (task) => {
        sendEvent({ type: 'done', task })
      },
      onEvent: (evt) => {
        sendEvent({
          type: evt.type,
          taskId,
          detail: (evt as Record<string, unknown>).detail as string | undefined,
          logEntry: evt.logEntry,
        })
      },
    })

    if (!exec) {
      return { success: false, error: '任务已在执行中' }
    }

    return { success: true }
  })

  // 中止执行
  ipcMain.handle(IpcChannels.TASKS_ABORT, async (_event, taskId: string) => {
    const ok = abortTask(taskId, '用户中止')
    return { success: ok }
  })

  // 获取运行中的任务
  ipcMain.handle(IpcChannels.TASKS_GET_RUNNING, async () => {
    return getRunningExecutions()
  })
}
