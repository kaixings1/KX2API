/**
 * AgentCardActions — 操作按钮行：执行/中止、编辑、删除
 */

import { Button } from '@/components/ui/button'
import { Play, Loader2, Trash2 } from 'lucide-react'

interface AgentCardActionsProps {
  isExecuting: boolean
  showExecute: boolean
  onToggleExecute: () => void
  onExecute: () => void
  onAbort: () => void
  onEdit: () => void
  onDelete: () => void
}

export function AgentCardActions({
  isExecuting, showExecute,
  onToggleExecute, onExecute, onAbort,
  onEdit, onDelete,
}: AgentCardActionsProps) {
  return (
    <div className="flex gap-1">
      {isExecuting ? (
        <Button size="sm" variant="destructive" onClick={onAbort}>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> 中止
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onToggleExecute}>
          <Play className="h-3 w-3 mr-1" />执行
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={onEdit}>编辑</Button>
      <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
    </div>
  )
}
