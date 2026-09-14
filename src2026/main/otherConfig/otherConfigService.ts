import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { storeManager } from '../store/store'

export interface OtherConfig {
  advanced: Record<string, unknown>
  experimental: Record<string, unknown>
  developer: Record<string, unknown>
}

const DATA_DIR = join(app.getPath('userData'), 'data', 'otherConfig')
const FILE_PATH = join(DATA_DIR, 'records.json')

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadAll(): OtherConfig {
  try {
    if (!existsSync(FILE_PATH)) {
      return { advanced: {}, experimental: {}, developer: {} }
    }
    const raw = readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[OtherConfigService] load failed:', e)
    return { advanced: {}, experimental: {}, developer: {} }
  }
}

function saveAll(data: OtherConfig): void {
  ensureDir()
  writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export function getOtherConfig(): OtherConfig {
  return loadAll()
}

export function getAdvancedConfig(): Record<string, unknown> {
  return loadAll().advanced
}

export function updateAdvancedConfig(config: Record<string, unknown>): { success: boolean } {
  const data = loadAll()
  data.advanced = config
  saveAll(data)
  return { success: true }
}

export function updateOtherConfig(updates: Partial<OtherConfig>): OtherConfig {
  const data = loadAll()
  if (updates.advanced) data.advanced = updates.advanced
  if (updates.experimental) data.experimental = updates.experimental
  if (updates.developer) data.developer = updates.developer
  saveAll(data)
  return data
}

export function resetOtherConfig(): { success: boolean } {
  saveAll({ advanced: {}, experimental: {}, developer: {} })
  return { success: true }
}
