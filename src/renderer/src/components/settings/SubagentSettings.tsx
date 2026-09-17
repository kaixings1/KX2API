import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import { DEFAULT_SUBAGENT_CONFIG, type SubagentConfig } from '@shared/types'
import { RotateCcw, Users, MessagesSquare } from 'lucide-react'

type Values = Required<SubagentConfig>

interface FieldSpec {
  key: keyof Values
  label: string
  hint: string
  min: number
  max: number
}

const FIELDS: FieldSpec[] = [
  {
    key: 'maxConcurrentAgents',
    label: '子代理最大并发',
    hint: '同时运行的子代理数量上限（含默认代理）。超过上限的请求会被直接拒绝，调大能并行更多任务，但资源占用与 API 压力同步上升。',
    min: 1,
    max: 20,
  },
  {
    key: 'recentMessageWindow',
    label: '摘要窗口条数',
    hint: '生成「离开摘要」时回顾最近多少条消息。窗口越大摘要越准确，但消耗的 token 更多。',
    min: 5,
    max: 200,
  },
]

const ICONS: Record<keyof Values, typeof Users> = {
  maxConcurrentAgents: Users,
  recentMessageWindow: MessagesSquare,
}

export function SubagentSettings() {
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState<Values>({ ...DEFAULT_SUBAGENT_CONFIG })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (config as { subagent?: SubagentConfig } | null)?.subagent
    if (stored) setValues({ ...DEFAULT_SUBAGENT_CONFIG, ...stored })
  }, [config])

  useEffect(() => {
    if (!config) void fetchConfig()
  }, [config, fetchConfig])

  const modifiedCount = FIELDS.filter(
    (f) => values[f.key] !== DEFAULT_SUBAGENT_CONFIG[f.key],
  ).length

  const commit = useCallback(
    async (next: Values) => {
      setSaving(true)
      try {
        await updateConfig({ subagent: next } as never)
      } finally {
        setSaving(false)
      }
    },
    [updateConfig],
  )

  const handleChange = (spec: FieldSpec, raw: string) => {
    if (raw === '') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    setValues((prev) => ({
      ...prev,
      [spec.key]: Math.max(spec.min, Math.min(spec.max, Math.floor(n))),
    }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">子代理与摘要</h3>
                {modifiedCount > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {modifiedCount} 项已修改
                  </Badge>
                )}
                {saving && (
                  <span className="text-[10px] text-muted-foreground">保存中…</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                控制子代理的并发能力与会话摘要的回顾范围。改动即时生效。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || modifiedCount === 0}
              onClick={() => {
                const d = { ...DEFAULT_SUBAGENT_CONFIG }
                setValues(d)
                void commit(d)
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {FIELDS.map((spec) => {
          const Icon = ICONS[spec.key]
          const changed = values[spec.key] !== DEFAULT_SUBAGENT_CONFIG[spec.key]
          return (
            <div
              key={spec.key}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
                  <Label htmlFor={`sub-${spec.key}`} className="text-sm">
                    {spec.label}
                  </Label>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    id={`sub-${spec.key}`}
                    type="number"
                    inputMode="numeric"
                    value={values[spec.key]}
                    min={spec.min}
                    max={spec.max}
                    onChange={(e) => handleChange(spec, e.target.value)}
                    onBlur={() => void commit(values)}
                    className="h-8 w-[100px] text-xs text-right tabular-nums"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!changed || saving}
                    onClick={() => {
                      const next = {
                        ...values,
                        [spec.key]: DEFAULT_SUBAGENT_CONFIG[spec.key],
                      }
                      setValues(next)
                      void commit(next)
                    }}
                    title="恢复默认"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[var(--text-dim)] leading-relaxed">{spec.hint}</p>
              <p className="text-[10px] text-muted-foreground">
                取值 {spec.min} – {spec.max} · 默认 {DEFAULT_SUBAGENT_CONFIG[spec.key]}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
