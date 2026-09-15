/**
 * AgentCard — 卡片主容器：组合 Header + Body + Actions + ExecutePanel
 */

import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import type { AgentRecord } from '../../../../main/agents/types'
import { AgentCardHeader } from './AgentCardHeader'
import { AgentCardBody } from './AgentCardBody'
import { AgentCardActions } from './AgentCardActions'
import { AgentExecutePanel } from './AgentExecutePanel'

interface AgentCardProps {
  agent: AgentRecord
  isExecuting: boolean
  output: string
  executeInput: string
  showExecute: boolean
  onExecute: (id: string, input: string) => void
  onAbort: (id: string) => void
  onEdit: (agent: AgentRecord) => void
  onDelete: (id: string) => void
  onToggleExecute: (id: string) => void
  onExecuteInputChange: (value: string) => void
}

export function AgentCard({
  agent, isExecuting, output, executeInput,
  showExecute, onExecute, onAbort,
  onEdit, onDelete, onToggleExecute, onExecuteInputChange,
}: AgentCardProps) {
  const navigate = useNavigate()

  return (
    <Card className="hover:border-[var(--accent-primary)] transition-colors">
      <CardHeader className="pb-2">
        <AgentCardHeader
          agent={agent}
          onClick={() => navigate(`/agents/${agent.id}`)}
        />
      </CardHeader>
      <CardContent className="py-3 space-y-2">
        <AgentCardBody agent={agent} />
        <AgentCardActions
          isExecuting={isExecuting}
          showExecute={showExecute}
          onToggleExecute={onToggleExecute}
          onExecute={() => onExecute(agent.id, executeInput)}
          onAbort={() => onAbort(agent.id)}
          onEdit={onEdit}
          onDelete={() => onDelete(agent.id)}
        />
        <AgentExecutePanel
          show={showExecute}
          input={executeInput}
          isExecuting={isExecuting}
          onInputChange={onExecuteInputChange}
          onSubmit={() => onExecute(agent.id, executeInput)}
          onAbort={() => onAbort(agent.id)}
          output={output}
        />
      </CardContent>
    </Card>
  )
}
