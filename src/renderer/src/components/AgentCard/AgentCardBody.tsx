/**
 * AgentCardBody — 卡片主体：systemPrompt 预览、模型和创建时间
 */

import type { AgentRecord } from '../../../../main/agents/types'

interface AgentCardBodyProps {
  agent: AgentRecord
}

export function AgentCardBody({ agent }: AgentCardBodyProps) {
  return (
    <>
      <p className="text-sm text-muted-foreground line-clamp-3">{agent.systemPrompt}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {agent.model && <span>Model: {agent.model}</span>}
        <span>ID: {agent.id}</span>
        <span>创建: {new Date(agent.createdAt).toLocaleDateString()}</span>
      </div>
    </>
  )
}
