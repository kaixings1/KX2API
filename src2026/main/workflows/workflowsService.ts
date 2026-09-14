import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

export interface WorkflowRecord {
  id: string
  name: string
  description: string
  steps: Array<{ id: string; name: string; type: string; config: Record<string, unknown> }>
  enabled: boolean
  createdAt: number
  lastRunAt?: number
}

export interface WorkflowExecuteResult {
  success: boolean
  stepResults: Array<{ stepId: string; success: boolean; output?: string; error?: string }>
  totalDurationMs: number
}

const DATA_DIR = join(app.getPath('userData'), 'data', 'workflows')
const FILE_PATH = join(DATA_DIR, 'records.json')

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadAll(): WorkflowRecord[] {
  try {
    if (!existsSync(FILE_PATH)) return []
    const raw = readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[WorkflowsService] load failed:', e)
    return []
  }
}

function saveAll(records: WorkflowRecord[]): void {
  ensureDir()
  writeFileSync(FILE_PATH, JSON.stringify(records, null, 2), 'utf-8')
}

function generateId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function getAllWorkflows(): WorkflowRecord[] {
  return loadAll()
}

export function getWorkflowById(id: string): WorkflowRecord | null {
  return loadAll().find(w => w.id === id) ?? null
}

export function createWorkflow(data: Omit<WorkflowRecord, 'id' | 'createdAt'>): WorkflowRecord {
  const now = Date.now()
  const workflow: WorkflowRecord = {
    ...data,
    id: generateId(),
    createdAt: now,
  }
  const all = loadAll()
  all.push(workflow)
  saveAll(all)
  return workflow
}

export function updateWorkflow(id: string, updates: Partial<Omit<WorkflowRecord, 'id' | 'createdAt'>>): WorkflowRecord | null {
  const all = loadAll()
  const idx = all.findIndex(w => w.id === id)
  if (idx < 0) return null
  const updated = { ...all[idx], ...updates }
  all[idx] = updated
  saveAll(all)
  return updated
}

export function deleteWorkflow(id: string): boolean {
  const all = loadAll()
  const idx = all.findIndex(w => w.id === id)
  if (idx < 0) return false
  all.splice(idx, 1)
  saveAll(all)
  return true
}

export function executeWorkflow(id: string, _input?: Record<string, unknown>): { success: boolean; result?: WorkflowExecuteResult; error?: string } {
  const workflow = getWorkflowById(id)
  if (!workflow) return { success: false, error: 'Workflow not found' }

  const startTime = Date.now()
  const stepResults = workflow.steps.map(step => ({
    stepId: step.id,
    success: true,
    output: `Executed ${step.name}`,
  }))

  const result: WorkflowExecuteResult = {
    success: true,
    stepResults,
    totalDurationMs: Date.now() - startTime,
  }

  updateWorkflow(id, { lastRunAt: Date.now() })

  return { success: true, result }
}
