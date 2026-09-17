import { BrowserWindow } from 'electron'
import { tasksService } from './tasksService'

/** 定时任务轮询间隔默认值（毫秒） */
export const DEFAULT_CHECK_INTERVAL_MS = 15_000

export class TaskScheduler {
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private mainWindow: BrowserWindow | null = null
  private checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS

  constructor(checkIntervalMs?: number) {
    this.setCheckInterval(checkIntervalMs)
  }

  /**
   * 设置轮询间隔（设置界面改完即时生效）。
   * 间隔决定定时任务的准点程度与轮询开销：越短越准时，但空转更频繁。
   */
  setCheckInterval(ms?: number | void): void {
    if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) {
      this.checkIntervalMs = Math.floor(ms)
      // 间隔变更需重建定时器才生效
      if (this.checkInterval) {
        clearInterval(this.checkInterval)
        this.checkInterval = null
        this.startCheck()
      }
    }
  }

  /** 当前轮询间隔（供 UI 回显） */
  getCheckInterval(): number {
    return this.checkIntervalMs
  }

  initialize(window: BrowserWindow | null): void {
    this.mainWindow = window
    this.startCheck()
  }

  private startCheck(): void {
    if (this.checkInterval) return
    this.checkInterval = setInterval(() => {
      this.checkScheduledTasks().catch(() => {})
    }, this.checkIntervalMs)
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
