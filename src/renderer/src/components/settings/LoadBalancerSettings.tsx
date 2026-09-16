import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  DEFAULT_LOAD_BALANCER_CONFIG,
  type LoadBalancerConfig,
} from '@shared/types'
import { RotateCcw, ShieldAlert, Timer } from 'lucide-react'

type Values = Required<LoadBalancerConfig>

interface FieldSpec {
  key: keyof Values
  label: string
  hint: string
  min: number
  max: number
  unit?: string
}

const FIELDS: FieldSpec[] = [
  {
    key: 'failThreshold',
    label: '连续失败摘除阈值',
    hint: '账号连续失败达到该次数即被移出候选池，请求自动切到备用账号。调小切换更积极，调大更容忍网络抖动。',
    min: 1,
    max: 50,
    unit: '次',
  },
  {
    key: 'recoveryTimeMs',
    label: '熔断恢复时间',
    hint: '被摘除的账号经过多久重新参与调度。太短会导致刚失败就被再次选中，太长会让可用账号变少。',
    min: 1000,
    max: 600000,
    unit: 'ms',
  },
]

const ICONS: Record<keyof Values, typeof Timer> = {
  failThreshold: ShieldAlert,
  recoveryTimeMs: Timer,
}

export function LoadBalancerSettings() {
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState<Values>({ ...DEFAULT_LOAD_BALANCER_CONFIG })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (config as { loadBalancer?: LoadBalancerConfig } | null)?.loadBalancer
    if (stored) setValues({ ...DEFAULT_LOAD_BALANCER_CONFIG, ...stored })
  }, [config])

  useEffect(() => {
    if (!config) void fetchConfig()
  }, [config, fetchConfig])

  const modifiedCount = FIELDS.filter(
    (f) => values[f.key] !== DEFAULT_LOAD_BALANCER_CONFIG[f.key],
  ).length

  const commit = useCallback(
    async (next: Values) => {
      setSaving(true)
      try {
        await updateConfig({ loadBalancer: next } as never)
      } finally {
        setSaving(false)
      }
    },
    [updateConfig],
  )

  const handleChange = (key: keyof Values, raw: string, spec: FieldSpec) => {
    if (raw === '') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    setValues((prev) => ({
      ...prev,
      [key]: Math.max(spec.min, Math.min(spec.max, Math.floor(n))),
    }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">账号熔断与故障转移</h3>
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
                决定某个账号在连续失败后何时被暂时摘除、何时重新启用。
                参数改动即时生效，影响后续所有代理请求的账号选择。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || modifiedCount === 0}
              onClick={() => {
                const d = { ...DEFAULT_LOAD_BALANCER_CONFIG }
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
          const changed = values[spec.key] !== DEFAULT_LOAD_BALANCER_CONFIG[spec.key]
          return (
            <div
              key={spec.key}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
                  <Label htmlFor={`lb-${spec.key}`} className="text-sm">
                    {spec.label}
                  </Label>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    id={`lb-${spec.key}`}
                    type="number"
                    inputMode="numeric"
                    value={values[spec.key]}
                    min={spec.min}
                    max={spec.max}
                    onChange={(e) => handleChange(spec.key, e.target.value, spec)}
                    onBlur={() => void commit(values)}
                    className="h-8 w-[100px] text-xs text-right tabular-nums"
                  />
                  {spec.unit && (
                    <span className="text-[10px] text-muted-foreground">{spec.unit}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!changed || saving}
                    onClick={() => {
                      const next = {
                        ...values,
                        [spec.key]: DEFAULT_LOAD_BALANCER_CONFIG[spec.key],
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
                取值 {spec.min} – {spec.max}
                {spec.unit ? ` ${spec.unit}` : ''} · 默认{' '}
                {DEFAULT_LOAD_BALANCER_CONFIG[spec.key]}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
