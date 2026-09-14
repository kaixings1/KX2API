/**
 * ToolCallCache — KX2API 适配版
 *
 * 从 doge-desktop src/performance/ToolCallCache.ts 移植
 * 工具调用结果缓存，支持 TTL 和可缓存工具白名单
 */

import { LRUCache } from '../performance/LRUCache.js'

export class ToolCallCache {
  private cache: LRUCache<string, any>
  private cachedTools: Set<string>

  constructor(maxSize = 100 * 1024 * 1024) {
    this.cache = new LRUCache({ maxSize, defaultTTL: 300000 })
    this.cachedTools = new Set([
      'Glob',
      'Grep',
      'Read',
      'WebFetch',
    ])
  }

  isCacheable(toolName: string): boolean {
    return this.cachedTools.has(toolName)
  }

  generateKey(toolName: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key]
        return acc
      }, {} as Record<string, any>)

    return `${toolName}:${JSON.stringify(sortedParams)}`
  }

  get(toolName: string, params: Record<string, any>): any | null {
    if (!this.isCacheable(toolName)) {
      return null
    }

    const key = this.generateKey(toolName, params)
    return this.cache.get(key)
  }

  set(toolName: string, params: Record<string, any>, result: any, ttl?: number): void {
    if (!this.isCacheable(toolName)) {
      return
    }

    const key = this.generateKey(toolName, params)
    this.cache.set(key, result, ttl)
  }

  clear(): void {
    this.cache.clear()
  }

  addCacheableTool(toolName: string): void {
    this.cachedTools.add(toolName)
  }

  removeCacheableTool(toolName: string): void {
    this.cachedTools.delete(toolName)
  }
}
