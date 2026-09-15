/**
 * Agent 数据存储端口（port）
 *
 * 当前实现基于 ModuleDataStore，未来可替换为文件系统或数据库适配器。
 */

import type { AgentRecord } from './types'

export interface IAgentStore {
  getAll(): AgentRecord[]
  getById(id: string): AgentRecord | undefined
  create(data: Omit<AgentRecord, 'id' | 'createdAt' | 'updatedAt'>): AgentRecord
  update(id: string, updates: Partial<Omit<AgentRecord, 'id' | 'createdAt'>>): AgentRecord | null
  delete(id: string): boolean
}
