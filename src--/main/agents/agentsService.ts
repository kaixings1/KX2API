import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

export interface AgentRecord {
  id: string
  name: string
  role: string
  systemPrompt: string
  model?: string
  status: 'idle' | 'running' | 'error'
  createdAt: number
  lastActiveAt?: number
}

const DATA_DIR = join(app.getPath('userData'), 'data', 'agents')
const FILE_PATH = join(DATA_DIR, 'records.json')

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadAll(): AgentRecord[] {
  try {
    if (!existsSync(FILE_PATH)) return []
    const raw = readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[AgentsService] load failed:', e)
    return []
  }
}

function saveAll(records: AgentRecord[]): void {
  ensureDir()
  writeFileSync(FILE_PATH, JSON.stringify(records, null, 2), 'utf-8')
}

function generateId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function getAllAgents(): AgentRecord[] {
  return loadAll()
}

export function getAgentById(id: string): AgentRecord | null {
  return loadAll().find(a => a.id === id) ?? null
}

export function createAgent(data: Omit<AgentRecord, 'id' | 'createdAt' | 'lastActiveAt'>): AgentRecord {
  const now = Date.now()
  const agent: AgentRecord = {
    ...data,
    id: generateId(),
    createdAt: now,
  }
  const all = loadAll()
  all.push(agent)
  saveAll(all)
  return agent
}

export function updateAgent(id: string, updates: Partial<Omit<AgentRecord, 'id' | 'createdAt'>>): AgentRecord | null {
  const all = loadAll()
  const idx = all.findIndex(a => a.id === id)
  if (idx < 0) return null
  const updated = { ...all[idx], ...updates, lastActiveAt: Date.now() }
  all[idx] = updated
  saveAll(all)
  return updated
}

export function deleteAgent(id: string): boolean {
  const all = loadAll()
  const idx = all.findIndex(a => a.id === id)
  if (idx < 0) return false
  all.splice(idx, 1)
  saveAll(all)
  return true
}
