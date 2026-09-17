import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  DEFAULT_MEMORY_CONFIG,
  DEFAULT_AUTO_MEMORY_CONFIG,
  type MemoryConfig,
  type AutoMemoryConfig,
} from '@shared/types'
import { Switch } from '@/components/ui/switch'
import { RotateCcw, BookOpen, ListTree, HardDrive, Search, Target, Sparkles } from 'lucide-react'

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
  const [auto, setAuto] = useState<Required<AutoMemoryConfig>>({ ...DEFAULT_AUTO_MEMORY_CONFIG })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (config as { memory?: MemoryConfig } | null)?.memory
    if (stored) setValues({ ...DEFAULT_MEMORY_CONFIG, ...stored })
    const storedAuto = (config as { autoMemory?: AutoMemoryConfig } | null)?.autoMemory
    if (storedAuto) setAuto({ ...DEFAULT_AUTO_MEMORY_CONFIG, ...storedAuto })
  }, [config])

  const commitAuto = useCallback(
    async (next: Required<AutoMemoryConfig>) => {
      setSaving(true)
      try {
        await updateConfig({ autoMemory: next } as never)
      } finally {
        setSaving(false)
      }
    },
    [updateConfig],
  )

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

      {/* 自动记忆：回合结束后台提炼，默认关闭（会额外消耗模型调用） */}
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-memory-enabled" className="text-sm">
                  自动记忆
                </Label>
                {auto.enabled && (
                  <Badge variant="secondary" className="text-[10px]">
                    已开启
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--text-dim)] leading-relaxed max-w-2xl">
                每轮结束后自动判断本次对话是否值得长期保留，值得则提炼成一条记忆。
                命中的内容会进入后续每一轮的上下文，从而跨对话生效。
                <br />
                <span className="text-amber-500 dark:text-amber-400">
                  注意：开启后每轮可能额外消耗一次模型调用，且记忆一旦写错会在后续被反复召回。
                </span>
              </p>
            </div>
          </div>
          <Switch
            id="auto-memory-enabled"
            checked={auto.enabled}
            disabled={saving}
            onCheckedChange={(v) => {
              const next = { ...auto, enabled: v }
              setAuto(next)
              void commitAuto(next)
            }}
          />
        </div>

        {auto.enabled && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--glass-border)]">
            <div className="space-y-1 min-w-0">
              <Label htmlFor="auto-memory-maxchars" className="text-sm">
                提取输入上限
              </Label>
              <p className="text-xs text-[var(--text-dim)]">
                送入提炼模型的最大字符数，越小越省额度。
              </p>
            </div>
            <Input
              id="auto-memory-maxchars"
              type="number"
              inputMode="numeric"
              value={auto.maxInputChars}
              min={500}
              max={100000}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') return
                const n = Number(raw)
                if (!Number.isFinite(n)) return
                setAuto((p) => ({
                  ...p,
                  maxInputChars: Math.max(500, Math.min(100000, Math.floor(n))),
                }))
              }}
              onBlur={() => void commitAuto(auto)}
              className="h-8 w-[110px] text-xs text-right tabular-nums shrink-0"
            />
          </div>
        )}
      </div>
    </div>
  )
}
