import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

export interface PluginRecord {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean
  installed: boolean
  icon?: string
}

const DATA_DIR = join(app.getPath('userData'), 'data', 'plugins')
const FILE_PATH = join(DATA_DIR, 'records.json')

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadAll(): PluginRecord[] {
  try {
    if (!existsSync(FILE_PATH)) return []
    const raw = readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[PluginsService] load failed:', e)
    return []
  }
}

function saveAll(records: PluginRecord[]): void {
  ensureDir()
  writeFileSync(FILE_PATH, JSON.stringify(records, null, 2), 'utf-8')
}

function generateId(): string {
  return `plugin_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function getAllPlugins(): PluginRecord[] {
  return loadAll()
}

export function getBuiltinPlugins(): PluginRecord[] {
  return loadAll().filter(p => p.id.startsWith('builtin_'))
}

export function getInstalledPlugins(): PluginRecord[] {
  return loadAll().filter(p => p.installed)
}

export function getPluginById(id: string): PluginRecord | null {
  return loadAll().find(p => p.id === id) ?? null
}

export function installPlugin(pluginId: string): { success: boolean; error?: string } {
  const all = loadAll()
  const idx = all.findIndex(p => p.id === pluginId)
  if (idx >= 0) {
    all[idx].installed = true
    all[idx].enabled = true
    saveAll(all)
    return { success: true }
  }
  return { success: false, error: 'Plugin not found' }
}

export function uninstallPlugin(pluginId: string): { success: boolean; error?: string } {
  const all = loadAll()
  const idx = all.findIndex(p => p.id === pluginId)
  if (idx >= 0) {
    all[idx].installed = false
    all[idx].enabled = false
    saveAll(all)
    return { success: true }
  }
  return { success: false, error: 'Plugin not found' }
}

export function enablePlugin(pluginId: string): { success: boolean } {
  const all = loadAll()
  const idx = all.findIndex(p => p.id === pluginId)
  if (idx >= 0) {
    all[idx].enabled = true
    saveAll(all)
    return { success: true }
  }
  return { success: false }
}

export function disablePlugin(pluginId: string): { success: boolean } {
  const all = loadAll()
  const idx = all.findIndex(p => p.id === pluginId)
  if (idx >= 0) {
    all[idx].enabled = false
    saveAll(all)
    return { success: true }
  }
  return { success: false }
}

export function updatePlugin(pluginId: string): { success: boolean; error?: string } {
  const all = loadAll()
  const idx = all.findIndex(p => p.id === pluginId)
  if (idx >= 0) {
    all[idx].lastActiveAt = Date.now()
    saveAll(all)
    return { success: true }
  }
  return { success: false, error: 'Plugin not found' }
}

export function addPlugin(data: Omit<PluginRecord, 'id'>): PluginRecord {
  const now = Date.now()
  const plugin: PluginRecord = {
    ...data,
    id: generateId(),
  }
  const all = loadAll()
  all.push(plugin)
  saveAll(all)
  return plugin
}
