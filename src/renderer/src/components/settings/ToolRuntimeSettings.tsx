import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import { RotateCcw, Timer, FileDown, Eye, Layers } from 'lucide-react'

/**
 * 工具结果落盘与执行超时。
 *
 * 这些值原先硬编码在 toolResultStore.ts / toolScheduler.ts 内，
 * 直接决定「大输出是否落盘、模型能看多少预览、单个工具最多跑多久」。
 */
export interface ToolRuntimeConfig {
  /** 工具输出超过多少字符触发落盘 */
  maxResultSizeChars?: number
  /** 落盘后给模型看的预览字节数 */
  previewSizeBytes?: number
  /** 单条消息内多个工具结果的聚合上限 */
  maxResultsPerMessageChars?: number
  /** 单个工具执行超时（毫秒） */
  toolTimeoutMs?: number
}

const DEFAULTS: Required<ToolRuntimeConfig> = {
  maxResultSizeChars: 50000,
  previewSizeBytes: 2000,
  maxResultsPerMessageChars: 200000,
  toolTimeoutMs: 600000,
}

interface FieldSpec {
  key: keyof Required<ToolRuntimeConfig>
  label: string
  hint: string
  min: number
  max: number
  /** 展示时是否折算为更易读的单位 */
  scale?: { div: number; suffix: string }
}

const FIELDS: FieldSpec[] = [
  {
    key: 'maxResultSizeChars',
    label: '结果落盘阈值',
    hint: '单个工具输出超过该字符数时写入磁盘，上下文里只留预览与文件路径，模型需要全文时自行读取。调小更省上下文，但模型要多一次读取。',
    min: 1000,
    max: 500000,
    scale: { div: 1000, suffix: 'k 字符' },
  },
  {
    key: 'previewSizeBytes',
    label: '预览字节数',
    hint: '落盘后模型直接能看到的内容长度（在最近的换行处切开，不会截断半行）。',
    min: 200,
    max: 20000,
    scale: { div: 1000, suffix: 'k 字节' },
  },
  {
    key: 'maxResultsPerMessageChars',
    label: '单轮结果聚合上限',
    hint: '一次回复里多个工具结果的总量上限。单结果阈值拦不住「N 个各 40K」，这里按一轮再设一道闸；超出的结果会被落盘并以预览替代。',
    min: 10000,
    max: 2000000,
    scale: { div: 1000, suffix: 'k 字符' },
  },
  {
    key: 'toolTimeoutMs',
    label: '工具执行超时',
    hint: '单个工具最多执行多久，超时判定为失败。工具自身声明了 timeout 的以工具为准。',
    min: 1000,
    max: 3600000,
    scale: { div: 1000, suffix: '秒' },
  },
]

const ICONS: Record<keyof Required<ToolRuntimeConfig>, typeof Timer> = {
  maxResultSizeChars: FileDown,
  previewSizeBytes: Eye,
  maxResultsPerMessageChars: Layers,
  toolTimeoutMs: Timer,
}

function format(value: number, spec: FieldSpec): string {
  if (!spec.scale) return String(value)
  const v = value / spec.scale.div
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${spec.scale.suffix}`
}

export function ToolRuntimeSettings() {
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState<Required<ToolRuntimeConfig>>({ ...DEFAULTS })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (config as { toolRuntime?: ToolRuntimeConfig } | null)?.toolRuntime
    if (stored) setValues({ ...DEFAULTS, ...stored })
  }, [config])

  useEffect(() => {
    if (!config) void fetchConfig()
  }, [config, fetchConfig])

  const modifiedCount = FIELDS.filter((f) => values[f.key] !== DEFAULTS[f.key]).length

  const commit = useCallback(
    async (next: Required<ToolRuntimeConfig>) => {
      setSaving(true)
      try {
        await updateConfig({ toolRuntime: next } as never)
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
                <h3 className="text-sm font-semibold">工具输出与执行</h3>
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
                控制大体积工具输出如何进入上下文，以及单个工具最多执行多久。
                改动即时生效，影响后续所有工具调用。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || modifiedCount === 0}
              onClick={() => {
                const d = { ...DEFAULTS }
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
          const changed = values[spec.key] !== DEFAULTS[spec.key]
          return (
            <div
              key={spec.key}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
                  <div className="min-w-0">
                    <Label htmlFor={`tr-${spec.key}`} className="text-sm">
                      {spec.label}
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      当前 {format(values[spec.key], spec)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    id={`tr-${spec.key}`}
                    type="number"
                    inputMode="numeric"
                    value={values[spec.key]}
                    min={spec.min}
                    max={spec.max}
                    onChange={(e) => handleChange(spec, e.target.value)}
                    onBlur={() => void commit(values)}
                    className="h-8 w-[104px] text-xs text-right tabular-nums"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!changed || saving}
                    onClick={() => {
                      const next = { ...values, [spec.key]: DEFAULTS[spec.key] }
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
                取值 {format(spec.min, spec)} – {format(spec.max, spec)} · 默认{' '}
                {format(DEFAULTS[spec.key], spec)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
