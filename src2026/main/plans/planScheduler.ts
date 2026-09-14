import { BrowserWindow } from 'electron'
import { IpcChannels } from '../ipc/channels'
import { getPlanById, updatePlan } from './plansService'

export interface ScheduledPlan {
  planId: string
  cron: string
  lastRunAt: number
  nextRunAt: number
}

type Listener = (event: { planId: string; success: boolean; error?: string }) => void

class PlanScheduler {
  private timers = new Map<string, ReturnType<typeof setInterval>>()
  private listeners = new Set<Listener>()
  private mainWindow: BrowserWindow | null = null
  private running = new Set<string>()
  private tickInterval: ReturnType<typeof setInterval> | null = null

  initialize(window: BrowserWindow | null): void {
    this.mainWindow = window
    this.startTick()
  }

  private startTick(): void {
    if (this.tickInterval) return
    this.tickInterval = setInterval(() => {
      this.checkAll()
    }, 30_000)
  }

  register(planId: string, cron: string): void {
    this.unregister(planId)

    try {
      const nextRun = this.computeNextRun(cron)
      if (!nextRun) return

      updatePlan(planId, { updatedAt: Date.now() } as any)
    } catch (e) {
      console.error('[PlanScheduler] register failed:', e)
    }
  }

  unregister(planId: string): void {
    const timer = this.timers.get(planId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(planId)
    }
  }

  onTrigger(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private async checkAll(): Promise<void> {
    if (!this.mainWindow) return

    // This would need access to all plans - for now, we rely on explicit register/unregister
    // In a full implementation, we'd iterate through plansStore and check each one
  }

  private computeNextRun(cron: string): number | null {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) return null

    const [, minutePart, hourPart] = parts

    const getValues = (part: string): number[] => {
      if (part === '*') return []
      if (part.includes(',')) return part.split(',').map(Number)
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number)
        const result: number[] = []
        for (let i = start; i <= end; i++) result.push(i)
        return result
      }
      if (part.includes('/')) {
        const [start, step] = part.split('/').map(Number)
        const result: number[] = []
        for (let i = start; i < 60; i += step) result.push(i)
        return result
      }
      return [Number(part)]
    }

    const minutes = getValues(minutePart)
    const hours = getValues(hourPart)

    if (minutes.length === 0 && hours.length === 0) {
      return Date.now() + 60 * 1000
    }
    if (hours.length === 0) {
      return Date.now() + (minutes[0] || 0) * 60 * 1000
    }
    if (minutes.length === 0) {
      return Date.now() + (hours[0] || 0) * 3600 * 1000
    }
    if (minutes.length === 1 && hours.length === 1) {
      const [h, m] = [hours[0], minutes[0]]
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
      if (target <= now) target.setDate(target.getDate() + 1)
      return target.getTime()
    }
    return Date.now() + 60 * 1000
  }
}

export const planScheduler = new PlanScheduler()
