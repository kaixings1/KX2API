/**
 * useAgents — Agent CRUD 状态管理 Hook
 */

import { useState, useCallback, useEffect } from 'react'
import type { AgentRecord } from '../../../../main/agents/types'

export function useAgents() {
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.electronAPI.agents.getAll()
      setAgents(Array.isArray(res) ? res : [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (data: Omit<AgentRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await window.electronAPI.agents.create(data)
    await load()
    return result
  }, [load])

  const update = useCallback(async (id: string, updates: Partial<AgentRecord>) => {
    const result = await window.electronAPI.agents.update(id, updates)
    await load()
    return result
  }, [load])

  const remove = useCallback(async (id: string) => {
    await window.electronAPI.agents.delete(id)
    await load()
  }, [load])

  return { agents, loading, error, load, create, update, remove }
}
