import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { storeManager } from '../store/store'

export interface ToolDef {
  id: string
  name: string
  displayName: string
  description: string
  usage: string
  platform: string
  tags: string[]
  enabled: boolean
  builtin: boolean
}

export interface ToolGroup {
  id: string
  name: string
  description: string
  toolIds: string[]
  enabled: boolean
  builtin: boolean
}

export interface HintRule {
  id: string
  name: string
  description: string
  patterns: string[]
  groupIds: string[]
  priority: number
  enabled: boolean
  builtin: boolean
}

const DATA_DIR = join(app.getPath('userData'), 'data', 'tools')
const FILE_PATH = join(DATA_DIR, 'records.json')

interface ToolStore {
  tools: ToolDef[]
  groups: ToolGroup[]
  hintRules: HintRule[]
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadAll(): ToolStore {
  try {
    if (!existsSync(FILE_PATH)) return { tools: [], groups: [], hintRules: [] }
    const raw = readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[ToolsService] load failed:', e)
    return { tools: [], groups: [], hintRules: [] }
  }
}

function saveAll(data: ToolStore): void {
  ensureDir()
  writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

function generateId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function getAllToolsData(): ToolStore {
  return loadAll()
}

export function addTool(tool: Omit<ToolDef, 'id'>): ToolDef {
  const data = loadAll()
  const newTool: ToolDef = { ...tool, id: generateId() }
  data.tools.push(newTool)
  saveAll(data)
  return newTool
}

export function updateTool(id: string, updates: Partial<ToolDef>): ToolDef | null {
  const data = loadAll()
  const idx = data.tools.findIndex(t => t.id === id)
  if (idx < 0) return null
  data.tools[idx] = { ...data.tools[idx], ...updates }
  saveAll(data)
  return data.tools[idx]
}

export function removeTool(id: string): boolean {
  const data = loadAll()
  const existed = data.tools.some(t => t.id === id)
  data.tools = data.tools.filter(t => t.id !== id)
  data.groups.forEach(g => { g.toolIds = g.toolIds.filter(tid => tid !== id) })
  saveAll(data)
  return existed
}

export function toggleTool(id: string): ToolDef | null {
  const data = loadAll()
  const idx = data.tools.findIndex(t => t.id === id)
  if (idx < 0) return null
  data.tools[idx].enabled = !data.tools[idx].enabled
  saveAll(data)
  return data.tools[idx]
}

export function addGroup(group: Omit<ToolGroup, 'id'>): ToolGroup {
  const data = loadAll()
  const newGroup: ToolGroup = { ...group, id: generateId() }
  data.groups.push(newGroup)
  saveAll(data)
  return newGroup
}

export function updateGroup(id: string, updates: Partial<ToolGroup>): ToolGroup | null {
  const data = loadAll()
  const idx = data.groups.findIndex(g => g.id === id)
  if (idx < 0) return null
  data.groups[idx] = { ...data.groups[idx], ...updates }
  saveAll(data)
  return data.groups[idx]
}

export function removeGroup(id: string): boolean {
  const data = loadAll()
  const existed = data.groups.some(g => g.id === id)
  data.groups = data.groups.filter(g => g.id !== id)
  saveAll(data)
  return existed
}

export function addToGroup(toolId: string, groupId: string): boolean {
  const data = loadAll()
  const group = data.groups.find(g => g.id === groupId)
  if (!group || group.toolIds.includes(toolId)) return false
  group.toolIds.push(toolId)
  saveAll(data)
  return true
}

export function removeFromGroup(toolId: string, groupId: string): boolean {
  const data = loadAll()
  const group = data.groups.find(g => g.id === groupId)
  if (!group) return false
  group.toolIds = group.toolIds.filter(tid => tid !== toolId)
  saveAll(data)
  return true
}

export function addHintRule(rule: Omit<HintRule, 'id'>): HintRule {
  const data = loadAll()
  const newRule: HintRule = { ...rule, id: generateId() }
  data.hintRules.push(newRule)
  saveAll(data)
  return newRule
}

export function updateHintRule(id: string, updates: Partial<HintRule>): HintRule | null {
  const data = loadAll()
  const idx = data.hintRules.findIndex(r => r.id === id)
  if (idx < 0) return null
  data.hintRules[idx] = { ...data.hintRules[idx], ...updates }
  saveAll(data)
  return data.hintRules[idx]
}

export function removeHintRule(id: string): boolean {
  const data = loadAll()
  const existed = data.hintRules.some(r => r.id === id)
  data.hintRules = data.hintRules.filter(r => r.id !== id)
  saveAll(data)
  return existed
}

export function matchHints(input: string): { groups: ToolGroup[]; tools: ToolDef[] } {
  const data = loadAll()
  const matchedGroupIds = new Set<string>()
  const matchedTools: ToolDef[] = []

  for (const rule of data.hintRules) {
    if (!rule.enabled) continue
    const matched = rule.patterns.some(p => input.toLowerCase().includes(p.toLowerCase()))
    if (matched) {
      rule.groupIds.forEach(gid => matchedGroupIds.add(gid))
    }
  }

  const groups = data.groups.filter(g => matchedGroupIds.has(g.id))
  const groupToolIds = new Set(groups.flatMap(g => g.toolIds))
  matchedTools.push(...data.tools.filter(t => groupToolIds.has(t.id) && t.enabled))

  return { groups, tools: matchedTools }
}

export function resetTools(): { success: boolean } {
  saveAll({ tools: [], groups: [], hintRules: [] })
  return { success: true }
}
