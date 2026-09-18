/**
 * Config Group Manager
 * Manages API configuration groups stored as JSON files in .doge/ directory
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir } from 'os'
import { storeManager, StoreManager } from './store'

export interface ConfigGroup {
  id: string
  name: string
  fileName: string
  createdAt: number
  updatedAt: number
  providerCount: number
}

export interface ConfigGroupData {
  presets: Record<string, {
    provider: string
    baseURL: string
    apiKey: string
    model: string
    savedModels?: string[]
    savedApiKeys?: string[]
    tokens?: Record<string, number>
    /** 工具调用格式：xml（默认）或 json */
    toolFormat?: 'xml' | 'json'
  }>
  activePreset?: string
}

class ConfigGroupManagerClass {
  private configDir: string
  private storeManager: StoreManager

  constructor() {
    this.configDir = join(process.cwd(), '.doge')
    this.storeManager = storeManager
    this.ensureConfigDir()
  }

  private ensureConfigDir(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true })
    }
  }

  getConfigDir(): string {
    return this.configDir
  }

  listGroups(): ConfigGroup[] {
    this.ensureConfigDir()
    const groups: ConfigGroup[] = []
    const now = Date.now()

    try {
      const files = readdirSync(this.configDir)
        .filter((f) => f.endsWith('.json'))
        .sort()

      for (const file of files) {
        const filePath = join(this.configDir, file)
        try {
          const content = readFileSync(filePath, 'utf-8')
          const data = JSON.parse(content) as ConfigGroupData
          const presetCount = Object.keys(data.presets || {}).length

          groups.push({
            id: file.replace('.json', ''),
            name: file.replace('.json', ''),
            fileName: file,
            createdAt: now,
            updatedAt: now,
            providerCount: presetCount,
          })
        } catch {
          // skip invalid JSON files
          groups.push({
            id: file.replace('.json', ''),
            name: file.replace('.json', ''),
            fileName: file,
            createdAt: now,
            updatedAt: now,
            providerCount: 0,
          })
        }
      }
    } catch (e) {
      console.error('[ConfigGroupManager] Failed to list groups:', e)
    }

    return groups
  }

  getGroup(id: string): ConfigGroup | null {
    const groups = this.listGroups()
    return groups.find((g) => g.id === id) || null
  }

  readGroup(id: string): ConfigGroupData | null {
    const filePath = join(this.configDir, `${id}.json`)
    if (!existsSync(filePath)) return null
    try {
      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as ConfigGroupData
    } catch {
      return null
    }
  }

  writeGroup(id: string, data: ConfigGroupData): boolean {
    const filePath = join(this.configDir, `${id}.json`)
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (e) {
      console.error('[ConfigGroupManager] Failed to write group:', e)
      return false
    }
  }

  createGroup(id: string, initialData?: Partial<ConfigGroupData>): ConfigGroup | null {
    const filePath = join(this.configDir, `${id}.json`)
    if (existsSync(filePath)) return null

    const data: ConfigGroupData = {
      presets: initialData?.presets || {},
      activePreset: initialData?.activePreset,
    }

    if (this.writeGroup(id, data)) {
      return this.getGroup(id)
    }
    return null
  }

  deleteGroup(id: string): boolean {
    const filePath = join(this.configDir, `${id}.json`)
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        return true
      }
      return false
    } catch (e) {
      console.error('[ConfigGroupManager] Failed to delete group:', e)
      return false
    }
  }

  renameGroup(oldId: string, newId: string): boolean {
    const oldPath = join(this.configDir, `${oldId}.json`)
    const newPath = join(this.configDir, `${newId}.json`)
    if (!existsSync(oldPath) || existsSync(newPath)) return false

    try {
      const content = readFileSync(oldPath, 'utf-8')
      writeFileSync(newPath, content, 'utf-8')
      unlinkSync(oldPath)
      return true
    } catch (e) {
      console.error('[ConfigGroupManager] Failed to rename group:', e)
      return false
    }
  }

  getActiveGroup(): ConfigGroup | null {
    const appConfig = this.storeManager.getStore()?.get('config') || {}
    const activeId = appConfig.activeConfigGroup
    if (activeId) {
      return this.getGroup(activeId)
    }
    return null
  }

  setActiveGroup(id: string): boolean {
    const groups = this.listGroups()
    if (!groups.find((g) => g.id === id)) return false

    try {
      this.storeManager.getStore()?.set('config', {
        ...this.storeManager.getStore()?.get('config'),
        activeConfigGroup: id,
      })
      return true
    } catch (e) {
      console.error('[ConfigGroupManager] Failed to set active group:', e)
      return false
    }
  }

  importToGroup(id: string, data: ConfigGroupData): boolean {
    return this.writeGroup(id, data)
  }
}

export const configGroupManager = new ConfigGroupManagerClass()
export default configGroupManager
