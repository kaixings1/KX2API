/**
 * AgentCardHeader — 卡片头部：名称、状态 Badge、角色 Badge
 */

import { CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
import type { AgentRecord } from '../../../../main/agents/types'

interface AgentCardHeaderProps {
  agent: AgentRecord
  onClick: () => void
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  idle: { label: '空闲', variant: 'secondary' },
  running: { label: '运行中', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
}

export function AgentCardHeader({ agent, onClick }: AgentCardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
        <span>{agent.name}</span>
        <Badge variant={STATUS_MAP[agent.status]?.variant}>{STATUS_MAP[agent.status]?.label}</Badge>
        <Badge variant="outline">{agent.role}</Badge>
      </CardTitle>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}
