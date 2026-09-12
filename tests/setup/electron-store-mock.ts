/**
 * Mock for electron-store package
 *
 * Provides a lightweight in-memory implementation of the Store class
 * that mimics electron-store behavior without requiring Electron.
 */

import { randomUUID } from 'node:crypto'

interface StoreConstructorOptions {
  name?: string
  cwd?: string
  defaults?: Record<string, any>
  encryptionKey?: string
}

/**
 * In-memory mock store that mimics electron-store behavior
 */
class MockStore {
  private data: Record<string, any>
  private defaults: Record<string, any>

  constructor(options: StoreConstructorOptions = {}) {
    this.defaults = options.defaults || {}
    // Deep clone defaults to avoid mutation
    this.data = JSON.parse(JSON.stringify(this.defaults))

    // Track change listeners
    this._listeners = new Map()
  }

  private _listeners: Map<string, Set<Function>>

  get(key: string): any {
    return this.data[key]
  }

  set(key: string, value: any): void {
    const oldValue = this.data[key]
    this.data[key] = value
    this._notifyChange(key, value, oldValue)
  }

  has(key: string): boolean {
    return key in this.data
  }

  delete(key: string): void {
    const oldValue = this.data[key]
    delete this.data[key]
    this._notifyChange(key, undefined, oldValue)
  }

  clear(): void {
    this.data = {}
  }

  onDidChange(key: string, callback: Function): () => void {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set())
    }
    this._listeners.get(key)!.add(callback)
    return () => {
      this._listeners.get(key)?.delete(callback)
    }
  }

  private _notifyChange(key: string, newValue: any, oldValue: any): void {
    const listeners = this._listeners.get(key)
    if (listeners) {
      for (const cb of listeners) {
        try { cb(newValue, oldValue) } catch {}
      }
    }
  }

  getAll(): Record<string, any> {
    return { ...this.data }
  }
}

// Export as CommonJS-compatible module
export default MockStore
