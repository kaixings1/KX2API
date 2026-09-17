import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  DEFAULT_MEMORY_CONFIG,
  type MemoryConfig,
} from '@shared/types'
import { RotateCcw, BookOpen, ListTree, HardDrive, Search, Target } from 'lucide-react'

type Values = Required<MemoryConfig>

interface FieldSpec {
  key: keyof Values
  label: string
  hint: string
  min: number
  max: number
}

const FIELDS: FieldSpec[] = [
  {
    key: 'maxMemoriesPerTurn',
    label: '每轮召回条数',
    hint: '单次对话最多注入几条记忆。调大能带入更多背景，但会占用上下文且可能引入无关信息。',
    min: 1,
    max: 50,
  },
  {
    key: 'maxLinesPerMemory',
    label: '单条记忆行数上限',
    hint: '每条记忆最多读取多少行正文，超出部分截断。',
    min: 10,
    max: 2000,
  },
  {
    key: 'maxBytesPerMemory',
    label: '单条记忆字节上限',
    hint: '每条记忆最多注入多少字节，与行数上限共同决定单条体积。',
    min: 256,
    max: 65536,
  },
  {
    key: 'maxScanFiles',
    label: '扫描文件数上限',
    hint: '每次召回最多扫描多少个记忆文件。上限越大召回越全，但每轮请求的扫描开销越大。',
    min: 10,
    max: 5000,
  },
  {
    key: 'minRelevanceScore',
    label: '相关性分数门槛',
    hint: '低于该分数的记忆视为不相关、不予注入。调高更精准但可能漏掉有用背景。',
    min: 1,
    max: 20,
  },
]

const ICONS: Record<keyof Values, typeof Search> = {
  maxMemoriesPerTurn: BookOpen,
  maxLinesPerMemory: ListTree,
  maxBytesPerMemory: HardDrive,
  maxScanFiles: Search,
  minRelevanceScore: Target,
}

export function MemorySettings() {
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState<Values>({ ...DEFAULT_MEMORY_CONFIG })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (config as { memory?: MemoryConfig } | null)?.memory
    if (stored) setValues({ ...DEFAULT_MEMORY_CONFIG, ...stored })
  }, [config])

  useEffect(() => {
    if (!config) void fetchConfig()
  }, [config, fetchConfig])

  const modifiedCount = FIELDS.filter((f) => values[f.key] !== DEFAULT_MEMORY_CONFIG[f.key]).length

  const commit = useCallback(
    async (next: Values) => {
      setSaving(true)
      try {
        await updateConfig({ memory: next } as never)
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
                <h3 className="text-sm font-semibold">记忆召回</h3>
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
                控制每轮对话把哪些历史记忆、注入多少内容给模型。
                取值偏大更「记得住」，但无关节选也会挤占上下文。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || modifiedCount === 0}
              onClick={() => {
                const d = { ...DEFAULT_MEMORY_CONFIG }
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
          const changed = values[spec.key] !== DEFAULT_MEMORY_CONFIG[spec.key]
          return (
            <div
              key={spec.key}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
                  <Label htmlFor={`mem-${spec.key}`} className="text-sm">
                    {spec.label}
                  </Label>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    id={`mem-${spec.key}`}
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
                      const next = { ...values, [spec.key]: DEFAULT_MEMORY_CONFIG[spec.key] }
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
                取值 {spec.min} – {spec.max} · 默认 {DEFAULT_MEMORY_CONFIG[spec.key]}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
