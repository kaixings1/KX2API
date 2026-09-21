/**
 * 搜索引擎注册表（自 D:\src\tools\MultiSearchTool\engines\index.ts 移植）
 */
import type { SearchEngine, SearchResultItem } from '../types.ts'

import * as duckduckgo from './duckduckgo.ts'
import * as baidu from './baidu.ts'
import * as bing from './bing.ts'

type EngineModule = {
  name: string
  displayName: string
  needsKey: boolean
  envKey?: string
  isAvailable: () => boolean
  search: (query: string, limit: number) => Promise<SearchResultItem[]>
}

const modules: EngineModule[] = [duckduckgo, baidu, bing]

const engines: SearchEngine[] = modules.map((mod) => ({
  name: mod.name,
  displayName: mod.displayName,
  needsKey: mod.needsKey,
  envKey: mod.envKey,
  isAvailable: mod.isAvailable,
  search: mod.search,
}))

export default engines

export function getAvailableEngines(): SearchEngine[] {
  return engines.filter((e) => e.isAvailable())
}

export function getEngine(name: string): SearchEngine | undefined {
  return engines.find((e) => e.name === name)
}
