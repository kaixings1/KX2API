import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannels } from '../ipc/channels'
import { getAllTasks, updateTask } from './tasksService'
import { IpcChannel } from '../ipc/channels'

export interface ScheduledTask {
  taskId: string
  scheduledAt: number
  executed: boolean
}

type Listener = (event: { taskId: string }) => void

class TaskScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private listeners = new Set<Listener>()
  private mainWindow: BrowserWindow | null = null
  private checkInterval: ReturnType<typeof setInterval> | null = null

  initialize(window: BrowserWindow | null): void {
    this.mainWindow = window
    this.startCheck()
  }

  private startCheck(): void {
    if (this.checkInterval) return
    this.checkInterval = setInterval(() => {
      this.checkScheduledTasks()
    }, 15_000)
  }

  private async checkScheduledTasks(): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    try {
      const tasks = getAllTasks()
      const now = Date.now()
      for (const task of tasks) {
        if (task.autoExecute && task.scheduledAt && !task.scheduledAtExecuted) {
          if (task.scheduledAt <= now) {
            this.executeTask(task.id)
          }
        }
      }
    } catch (e) {
      console.error('[TaskScheduler] check failed:', e)
    }
  }

  private async executeTask(taskId: string): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    try {
      updateTask(taskId, { status: 'in_progress', scheduledAtExecuted: true })
      this.mainWindow.webContents.send(IpcChannels.TASKS_AUTO_EXECUTED, { taskId })
      this.listeners.forEach(fn => fn({ taskId }))
    } catch (e) {
      console.error('[TaskScheduler] execute failed:', e)
    }
  }

  onAutoExecuted(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  destroy(): void {
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
    this.listeners.clear()
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
}

export const taskScheduler = new TaskScheduler()
