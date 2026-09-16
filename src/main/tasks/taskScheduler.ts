import { BrowserWindow } from 'electron'
import { tasksService } from './tasksService'

const CHECK_INTERVAL_MS = 15_000

export class TaskScheduler {
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private mainWindow: BrowserWindow | null = null

  initialize(window: BrowserWindow | null): void {
    this.mainWindow = window
    this.startCheck()
  }

  private startCheck(): void {
    if (this.checkInterval) return
    this.checkInterval = setInterval(() => {
      this.checkScheduledTasks().catch(() => {})
    }, CHECK_INTERVAL_MS)
  }

  private async checkScheduledTasks(): Promise<void> {
    try {
      const tasks = tasksService.getAll()
      const now = Date.now()
      for (const task of tasks) {
        if (task.autoExecute && task.scheduledAt && !task.scheduledAtExecuted) {
          if (task.scheduledAt <= now) {
            await this.executeTask(task.id)
          }
        }
      }
    } catch (e) {
      console.error('[TaskScheduler] check failed:', e)
    }
  }

  private async executeTask(id: string): Promise<void> {
    try {
      await tasksService.update(id, { status: 'in_progress', scheduledAtExecuted: true })
      this.mainWindow?.webContents.send('tasks:autoExecuted', { id })
    } catch (e) {
      console.error('[TaskScheduler] execute failed:', e)
    }
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
}

export const taskScheduler = new TaskScheduler()
