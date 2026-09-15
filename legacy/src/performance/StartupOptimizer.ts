/**
 * StartupOptimizer — KX2API 适配版
 *
 * 从 doge-desktop src/performance/StartupOptimizer.ts 移植
 * 启动流程优化器：按优先级排序阶段，支持依赖管理和耗时统计
 */

export interface StartupPhase {
  name: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  action: () => Promise<void>
  dependencies?: string[]
}

export class StartupOptimizer {
  private phases: StartupPhase[] = []
  private completed: Set<string> = new Set()
  private timings: Map<string, number> = new Map()

  addPhase(phase: StartupPhase): void {
    this.phases.push(phase)
  }

  async run(): Promise<void> {
    const sorted = this.sortByPriority()

    for (const phase of sorted) {
      if (phase.dependencies) {
        for (const dep of phase.dependencies) {
          if (!this.completed.has(dep)) {
            continue
          }
        }
      }

      const startTime = Date.now()

      try {
        await phase.action()
        this.completed.add(phase.name)
        this.timings.set(phase.name, Date.now() - startTime)
      } catch (error) {
        console.error(`Startup phase ${phase.name} failed:`, error)
        if (phase.priority === 'critical') {
          throw error
        }
      }
    }
  }

  private sortByPriority(): StartupPhase[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return [...this.phases].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    )
  }

  getReport(): {
    totalTime: number
    phases: Array<{ name: string; duration: number; completed: boolean }>
  } {
    const phases = this.phases.map((phase) => ({
      name: phase.name,
      duration: this.timings.get(phase.name) || 0,
      completed: this.completed.has(phase.name),
    }))

    const totalTime = phases.reduce((sum, p) => sum + p.duration, 0)

    return { totalTime, phases }
  }
}
