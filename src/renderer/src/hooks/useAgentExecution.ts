/**
 * useAgentExecution — Agent 执行状态管理 Hook
 * 封装 execute/abort/getRunning + onOutput/onDone/onError 监听
 */

import { useState, useCallback } from 'react'
import type { AgentRecord } from '../../../../main/agents/types'

export function useAgentExecution() {
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<Record<string, string>>({})

  const execute = useCallback(async (agent: AgentRecord, input: string) => {
    setExecutingId(agent.id)
    setOutputs(prev => ({ ...prev, [agent.id]: '' }))

    const unsubOutput = window.electronAPI.agents.onOutput(({ agentId, content }) => {
      setOutputs(prev => ({ ...prev, [agentId]: (prev[agentId] || '') + content }))
    })

    const unsubDone = window.electronAPI.agents.onDone(({ agentId, success, output, error }) => {
      unsubOutput()
      unsubDone()
      unsubError()
      setExecutingId(null)
      if (success) {
        setOutputs(prev => ({ ...prev, [agentId]: output }))
      }
    })

    const unsubError = window.electronAPI.agents.onError(({ agentId, error }) => {
      unsubOutput()
      unsubDone()
      unsubError()
      setExecutingId(null)
      setOutputs(prev => ({ ...prev, [agentId]: `错误: ${error}` }))
    })

    await window.electronAPI.agents.execute(agent.id, input)
  }, [])

  const abort = useCallback(async (id: string) => {
    await window.electronAPI.agents.abort(id)
    setExecutingId(null)
  }, [])

  const getRunning = useCallback(async (): Promise<string[]> => {
    const res = await window.electronAPI.agents.getRunning()
    return res.data || []
  }, [])

  return { executingId, outputs, execute, abort, getRunning }
}
