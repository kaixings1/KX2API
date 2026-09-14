import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

export class ModuleDataStore<T extends Record<string, unknown>> {
  private readonly dir: string
  private readonly filePath: string
  private cache = new Map<string, T>()
  private dirty = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(moduleName: string, fileName = 'records.json') {
    const dataDir = join(app.getPath('userData'), 'data')
    this.dir = join(dataDir, moduleName)
    this.filePath = join(this.dir, fileName)
    this.ensureDir()
    this.loadFromDisk()
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true })
    }
  }

  private loadFromDisk(): void {
    try {
      if (!existsSync(this.filePath)) return
      const raw = readFileSync(this.filePath, 'utf-8')
      const arr: T[] = JSON.parse(raw)
      if (Array.isArray(arr)) {
        this.cache = new Map(arr.map(item => [(item as any).id as string, item]))
      }
    } catch (e) {
      console.error(`[ModuleDataStore:${this.dir}] load failed:`, e)
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      if (!this.dirty) return
      this.saveToDisk()
      this.dirty = false
    }, 300)
  }

  private saveToDisk(): void {
    try {
      const arr = Array.from(this.cache.values())
      writeFileSync(this.filePath, JSON.stringify(arr, null, 2), 'utf-8')
    } catch (e) {
      console.error(`[ModuleDataStore:${this.dir}] save failed:`, e)
    }
  }

  getAll(): T[] {
    return Array.from(this.cache.values())
  }

  values(): IterableIterator<T> {
    return this.cache.values()
  }

  entries(): IterableIterator<[string, T]> {
    return this.cache.entries()
  }

  keys(): IterableIterator<string> {
    return this.cache.keys()
  }

  getById(id: string): T | undefined {
    return this.cache.get(id)
  }

  get(id: string): T | undefined {
    return this.cache.get(id)
  }

  set(id: string, record: T): void {
    this.cache.set(id, record)
    this.dirty = true
    this.scheduleSave()
  }

  delete(id: string): boolean {
    const existed = this.cache.has(id)
    this.cache.delete(id)
    if (existed) {
      this.dirty = true
      this.scheduleSave()
    }
    return existed
  }

  getAllIds(): string[] {
    return Array.from(this.cache.keys())
  }

  count(): number {
    return this.cache.size
  }

  get size(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
    this.dirty = true
    this.saveToDisk()
  }

  has(id: string): boolean {
    return this.cache.has(id)
  }
}
