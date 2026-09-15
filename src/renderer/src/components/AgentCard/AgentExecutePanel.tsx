/**
 * AgentExecutePanel — 执行面板：输入框 + 提交按钮 + 输出展示
 */

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Play } from 'lucide-react'

interface AgentExecutePanelProps {
  show: boolean
  input: string
  isExecuting: boolean
  onInputChange: (value: string) => void
  onSubmit: () => void
  onAbort: () => void
  output: string
}

export function AgentExecutePanel({
  show, input, isExecuting,
  onInputChange, onSubmit, onAbort, output,
}: AgentExecutePanelProps) {
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    outputRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  if (!show) return null

  return (
    <>
      <div className="flex gap-2 mt-3">
        <Input
          value={input}
          onChange={e => onInputChange(e.target.value)}
          placeholder="输入执行指令..."
          onKeyDown={e => {
            if (e.key === 'Enter' && !isExecuting) onSubmit()
          }}
        />
        {isExecuting ? (
          <Button size="sm" variant="destructive" onClick={onAbort}>
            <Loader2 className="h-3 w-3 animate-spin" />
          </Button>
        ) : (
          <Button size="sm" onClick={onSubmit}>
            <Play className="h-3 w-3" />
          </Button>
        )}
      </div>
      {output && (
        <div ref={outputRef} className="mt-2 p-2 bg-black/30 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
          {output}
        </div>
      )}
    </>
  )
}
