/**
 * main/profiles/manager.ts — 配置组管理
 *
 * 直接读写 doge-code 的配置文件，不做数据复制：
 * - 项目级: .doge/ 目录下所有 .json 文件（f.json, k.json 等）
 * - 全局级: ~/.doge/providers.json
 *
 * UI 状态（activePreset）单独存储在 .doge/state.json，避免污染其他文件。
 */

import { homedir } from 'os'
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'

export interface Profile {
  name: string
  provider: 'openai' | 'anthropic' | 'custom'
  baseUrl: string
  apiKey: string
  model: string
  savedModels?: string[]
  savedApiKeys?: string[]
  /** 来源标记 */
  _source?: 'project' | 'global'
  /** 是否项目激活预设 */
  _active?: boolean
  /** 最大工具调用轮次 */
  maxToolRounds?: number
  /** 重复循环检测阈值 */
  maxRepeat?: number
}

interface PresetData {
  provider?: string
  baseURL?: string
  apiKey?: string
  model?: string
  savedModels?: string[]
  savedApiKeys?: string[]
  tokens?: Record<string, unknown>
}

interface ProjectStorage {
  activePreset?: string
  presets: Record<string, PresetData>
}

interface GlobalStorage {
  presets: Record<string, PresetData>
}

/** 获取所有可能的项目根目录（用于定位 .doge/） */
function getPossibleBases(): string[] {
  const bases: string[] = []

  // 1. process.cwd() — 开发环境通常指向项目根目录
  try { bases.push(process.cwd()) } catch { /* ignore */ }

  // 2. app.getAppPath() — Electron 的源码/资源路径
  try {
    const ap = app.getAppPath?.()
    if (ap && !ap.includes('electron.asar') && !bases.includes(ap)) {
      bases.push(ap)
    }
  } catch { /* ignore */ }

  // 3. main 模块所在目录
  try {
    const mainFile = require.main?.filename || process.argv[1] || ''
    const mainDir = dirname(mainFile)
    // 如果 main 在 out/main/ 或 dist/ 下，往上找一级到项目根
    const candidate = mainDir.includes('out' + join('main')) ? dirname(dirname(mainDir)) : mainDir
    if (!bases.includes(candidate)) bases.push(candidate)
  } catch { /* ignore */ }

  // 去重
  return [...new Set(bases)]
}

/** 获取 .doge 目录下的所有配置文件路径 */
function getProjectConfigPaths(): string[] {
  const candidates: string[] = []

  // 1. 优先读取 DOGE_API_JSON 环境变量指向的文件
  const envPath = process.env.DOGE_API_JSON
  if (envPath && typeof envPath === 'string' && envPath.trim()) {
    const raw = envPath.trim()
    if (isAbsolute(raw)) {
      if (existsSync(raw)) candidates.push(raw)
    } else {
      // 相对路径：在所有可能的 base 目录下查找
      for (const base of getPossibleBases()) {
        const resolved = join(base, raw)
        if (existsSync(resolved) && !candidates.includes(resolved)) {
          candidates.push(resolved)
          break
        }
      }
    }
  }

  // 2. 扫描所有 base 目录下的 .doge/*.json
  for (const base of getPossibleBases()) {
    const dogeBase = join(base, '.doge')
    if (!existsSync(dogeBase)) continue
    const apiPath = join(dogeBase, 'api.json')
    if (existsSync(apiPath) && !candidates.includes(apiPath)) candidates.push(apiPath)
    try {
      const files = readdirSync(dogeBase)
      for (const f of files) {
        if (f.endsWith('.json') && f !== 'state.json') {
          const fp = join(dogeBase, f)
          if (!candidates.includes(fp)) candidates.push(fp)
        }
      }
    } catch {
      // skip unreadable directory
    }
  }

  return candidates
}

function isAbsolute(p: string): boolean {
  return /^[a-zA-Z]:[/\\]/.test(p) || p.startsWith('/') || p.startsWith('\\')
}

function getGlobalConfigPath(): string {
  return join(homedir(), '.doge', 'providers.json')
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function normalizePreset(name: string, data: PresetData): Profile {
  const tokens = data.tokens as Record<string, unknown> || {}
  return {
    name,
    provider: (data.provider === 'anthropic' ? 'anthropic' : 'openai') as 'openai' | 'anthropic' | 'custom',
    baseUrl: data.baseURL || '',
    apiKey: data.apiKey || '',
    model: data.model || '',
    savedModels: data.savedModels,
    savedApiKeys: data.savedApiKeys,
    maxToolRounds: tokens.maxToolRounds as number | undefined,
    maxRepeat: tokens.maxRepeat as number | undefined,
  }
}

export class ProfileManager {
  private projectPaths: string[]
  private globalPath: string
  private statePath: string

  constructor() {
    this.projectPaths = getProjectConfigPaths()
    this.globalPath = getGlobalConfigPath()
    // state.json 始终写在 cwd/.doge/ 下
    this.statePath = join(process.cwd(), '.doge', 'state.json')
  }

  getProjectPath(): string {
    return this.projectPaths[0] ?? join(process.cwd(), '.doge', 'api.json')
  }

  getProjectPaths(): string[] {
    return this.projectPaths
  }

  getGlobalPath(): string {
    return this.globalPath
  }

  /** 重新扫描配置文件路径（用于热更新场景） */
  refreshPaths(): void {
    this.projectPaths = getProjectConfigPaths()
  }

  private readProject(): ProjectStorage {
    const merged: ProjectStorage = { presets: {} }
    for (const p of this.projectPaths) {
      const data = readJsonFile<ProjectStorage>(p, { presets: {} })
      for (const [k, v] of Object.entries(data.presets ?? {})) {
        merged.presets[k] = v
      }
    }
    return merged
  }

  private writeProject(data: ProjectStorage): void {
    const path = this.projectPaths[0] ?? join(process.cwd(), '.doge', 'api.json')
    const dir = dirname(path)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  }

  private readState(): { activePreset?: string } {
    return readJsonFile<{ activePreset?: string }>(this.statePath, {})
  }

  private writeState(data: { activePreset?: string }): void {
    const dir = dirname(this.statePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(this.statePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  list(): Profile[] {
    const project = this.readProject()
    const global = this.readGlobal()
    const activeName = this.readState().activePreset

    const merged: Record<string, Profile> = {}

    for (const [name, data] of Object.entries(global.presets)) {
      merged[name] = {
        ...normalizePreset(name, data),
        _source: 'global',
        _active: name === activeName,
      }
    }

    for (const [name, data] of Object.entries(project.presets)) {
      merged[name] = {
        ...normalizePreset(name, data),
        _source: 'project',
        _active: name === activeName,
      }
    }

    return Object.values(merged)
  }

  getActive(): Profile | null {
    const project = this.readProject()
    const global = this.readGlobal()
    const activeName = this.readState().activePreset
    if (!activeName) return null

    if (project.presets[activeName]) {
      return { ...normalizePreset(activeName, project.presets[activeName]), _source: 'project', _active: true }
    }
    if (global.presets[activeName]) {
      return { ...normalizePreset(activeName, global.presets[activeName]), _source: 'global', _active: true }
    }
    return null
  }

  get(name: string): Profile | undefined {
    const project = this.readProject()
    const global = this.readGlobal()

    if (project.presets[name]) {
      return { ...normalizePreset(name, project.presets[name]), _source: 'project', _active: name === this.readState().activePreset }
    }
    if (global.presets[name]) {
      return { ...normalizePreset(name, global.presets[name]), _source: 'global', _active: false }
    }
    return undefined
  }

  upsert(profile: Profile): void {
    this.refreshPaths()
    const project = this.readProject()
    const existing = project.presets[profile.name]
    const tokens: Record<string, unknown> = {}
    const existingTokens = (existing && existing.tokens) ? existing.tokens as Record<string, unknown> : {}
    if (profile.maxToolRounds !== undefined && profile.maxToolRounds > 0) {
      tokens.maxToolRounds = profile.maxToolRounds
    }
    if (profile.maxRepeat !== undefined && profile.maxRepeat > 0) {
      tokens.maxRepeat = profile.maxRepeat
    }
    const mergedTokens = { ...existingTokens, ...tokens }

    const savedModels = profile.savedModels || (existing && existing.savedModels) || []
    const savedApiKeys = profile.savedApiKeys || (existing && existing.savedApiKeys) || []

    project.presets[profile.name] = {
      provider: profile.provider === 'custom' ? 'openai' : profile.provider,
      baseURL: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
      savedModels,
      savedApiKeys,
    }
    if (Object.keys(mergedTokens).length > 0) {
      project.presets[profile.name].tokens = mergedTokens
    }
    this.writeProject(project)
    this.writeState({ activePreset: profile.name })
  }

  setActive(name: string): Profile | null {
    this.refreshPaths()
    const profile = this.get(name)
    if (!profile) return null

    this.writeState({ activePreset: name })
    return { ...profile, _active: true }
  }

  remove(name: string): boolean {
    this.refreshPaths()
    const project = this.readProject()
    if (!project.presets[name]) return false

    delete project.presets[name]
    const activeName = this.readState().activePreset
    if (activeName === name) {
      const remaining = Object.keys(project.presets)
      project.activePreset = remaining.length > 0 ? remaining[0] : undefined
    }
    this.writeProject(project)
    if (!project.presets[name]) {
      this.writeState({ activePreset: project.activePreset })
    }
    return true
  }

  toEngineConfig(profile: Profile): {
    provider: 'openai' | 'anthropic' | 'custom'
    baseUrl: string
    apiKey: string
    model: string
    maxTokens: number
    maxToolRounds: number
    maxRepeat: number
  } {
    return {
      provider: profile.provider,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
      maxTokens: 4096,
      maxToolRounds: profile.maxToolRounds || 5,
      maxRepeat: profile.maxRepeat || 3,
    }
  }
}
