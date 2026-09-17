import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

export interface PlanStep {
  id: string
  description: string
  status: 'pending' | 'completed' | string
  result?: string | null
}

export interface PlanRecord {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  steps: PlanStep[]
  createdAt: number
  completedAt?: number | null
}

const DATA_DIR = join(app.getPath('userData'), 'data', 'plans')
const FILE_PATH = join(DATA_DIR, 'records.json')

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadAll(): PlanRecord[] {
  try {
    if (!existsSync(FILE_PATH)) return []
    const raw = readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[PlansService] load failed:', e)
    return []
  }
}

function saveAll(records: PlanRecord[]): void {
  ensureDir()
  writeFileSync(FILE_PATH, JSON.stringify(records, null, 2), 'utf-8')
}

function generateId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function getAllPlans(): PlanRecord[] {
  return loadAll()
}

export function getPlanById(id: string): PlanRecord | null {
  return loadAll().find(p => p.id === id) ?? null
}

export function createPlan(data: { title: string; description: string; steps: PlanStep[] }): PlanRecord {
  const now = Date.now()
  const plan: PlanRecord = {
    id: generateId(),
    title: data.title,
    description: data.description,
    status: 'pending',
    steps: data.steps.map(s => ({
      id: s.id || `step_${now}_${Math.random().toString(36).slice(2, 6)}`,
      description: s.description,
      status: 'pending',
    })),
    createdAt: now,
  }
  const all = loadAll()
  all.push(plan)
  saveAll(all)
  return plan
}

export function updatePlan(id: string, updates: Partial<Pick<PlanRecord, 'title' | 'description' | 'status' | 'steps' | 'completedAt'>>): PlanRecord | null {
  const all = loadAll()
  const idx = all.findIndex(p => p.id === id)
  if (idx < 0) return null
  const updated = { ...all[idx], ...updates }
  all[idx] = updated
  saveAll(all)
  return updated
}

export function deletePlan(id: string): boolean {
  const all = loadAll()
  const idx = all.findIndex(p => p.id === id)
  if (idx < 0) return false
  all.splice(idx, 1)
  saveAll(all)
  return true
}

export function executePlan(id: string): { success: boolean; error?: string } {
  const plan = getPlanById(id)
  if (!plan) return { success: false, error: '计划不存在' }

  if (plan.status === 'running') {
    return { success: false, error: '计划正在运行中' }
  }

  const updatedSteps = plan.steps.map((s, i) => ({
    id: s.id,
    description: s.description,
    status: (i === 0 ? 'completed' : 'pending') as PlanStep['status'],
    result: i === 0 ? 'Executed' : null,
  }))

  const allDone = updatedSteps.every(s => s.status === 'completed')
  const status: PlanRecord['status'] = allDone ? 'completed' : 'running'

  const result = updatePlan(id, {
    steps: updatedSteps,
    status,
    completedAt: allDone ? Date.now() : null,
  })

  return result ? { success: true } : { success: false, error: '更新计划失败' }
}
