import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  DEFAULT_PROXY_RUNTIME_CONFIG,
  DEFAULT_LOG_RUNTIME_CONFIG,
  type ProxyRuntimeConfig,
  type LogRuntimeConfig,
} from '@shared/types'
import { RotateCcw, CopyX, Waves, Wifi, Clock, Database, Archive, HardDrive, Layers } from 'lucide-react'

interface Spec<T> {
  key: keyof T
  label: string
  hint: string
  min: number
  max: number
  unit?: string
  scale?: { div: number; suffix: string }
}

const PROXY_FIELDS: Spec<Required<ProxyRuntimeConfig>>[] = [
  {
    key: 'dedupWindowMs',
    label: '请求去重窗口',
    hint: '同一窗口内内容相同的请求会被合并为一次上游调用，避免用户连点或重试造成重复扣费。窗口过大可能把两次独立提问误判为重复。',
    min: 100,
    max: 60000,
    scale: { div: 1000, suffix: '秒' },
  },
  {
    key: 'dedupMaxBufferMb',
    label: '去重流缓冲上限',
    hint: '共享流的缓冲内存上限。多个请求命中同一去重条目时复用该缓冲，超限即停止缓存后续内容。',
    min: 1,
    max: 200,
    unit: 'MB',
  },
  {
    key: 'queueDetectorMaxBytes',
    label: '队列检测缓冲',
    hint: '判断模型是否把工具调用写成了排队文本所需的缓冲长度。太小会因截断漏判，太大增加内存与首字延迟。',
    min: 4096,
    max: 1048576,
    scale: { div: 1024, suffix: 'KB' },
  },
  {
    key: 'checkTimeoutMs',
    label: '供应商探测超时',
    hint: '连通性检测等待多久判定失败。太短会把响应慢但可用的供应商误判为不可用。',
    min: 1000,
    max: 120000,
    scale: { div: 1000, suffix: '秒' },
  },
  {
    key: 'taskCheckIntervalMs',
    label: '定时任务轮询间隔',
    hint: '多久检查一次待执行的定时任务。越短越准时，但空转更频繁。',
    min: 1000,
    max: 600000,
    scale: { div: 1000, suffix: '秒' },
  },
]

const LOG_FIELDS: Spec<Required<LogRuntimeConfig>>[] = [
  {
    key: 'maxLogs',
    label: '内存日志条数',
    hint: '主进程内存中保留的日志条数上限，超出后丢弃最旧的。调大便于排查历史问题，但占用更多内存。',
    min: 100,
    max: 200000,
  },
  {
    key: 'retentionDays',
    label: '日志保留天数',
    hint: '磁盘上日志文件的保留时长，超期自动清理。',
    min: 1,
    max: 365,
    unit: '天',
  },
  {
    key: 'auditBufferSize',
    label: '审计缓冲条数',
    hint: '审计日志攒够多少条才写入磁盘。缓冲越大写入越少，但异常退出时可能丢失更多未落盘记录。',
    min: 1,
    max: 10000,
  },
  {
    key: 'auditFlushIntervalMs',
    label: '审计落盘间隔',
    hint: '即使未攒满也会按此间隔强制落盘。越短越安全，但 I/O 更频繁。',
    min: 500,
    max: 600000,
    scale: { div: 1000, suffix: '秒' },
  },
  {
    key: 'promptSectionCacheLimit',
    label: '提示分片缓存条数',
    hint: '缓存系统提示分片的条目上限，命中即可跳过重复计算（记忆召回、工具上下文等）。越大复用越多，但常驻内存越多。',
    min: 10,
    max: 5000,
  },
]

const PROXY_ICONS: Record<keyof Required<ProxyRuntimeConfig>, typeof Clock> = {
  dedupWindowMs: CopyX,
  dedupMaxBufferMb: Database,
  queueDetectorMaxBytes: Waves,
  checkTimeoutMs: Wifi,
  taskCheckIntervalMs: Clock,
}

const LOG_ICONS: Record<keyof Required<LogRuntimeConfig>, typeof Clock> = {
  maxLogs: Archive,
  retentionDays: Archive,
  auditBufferSize: HardDrive,
  auditFlushIntervalMs: Clock,
  promptSectionCacheLimit: Layers,
}

function fmt(v: number, spec: Spec<never>): string {
  if (!spec.scale) return spec.unit ? `${v} ${spec.unit}` : String(v)
  const n = v / spec.scale.div
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${spec.scale.suffix}`
}

/** 通用字段网格 */
function FieldGrid<T extends Record<string, number>>({
  fields,
  icons,
  values,
  defaults,
  onChange,
  onCommit,
  onReset,
  saving,
  prefix,
}: {
  fields: Spec<T>[]
  icons: Record<keyof T, typeof Clock>
  values: T
  defaults: T
  onChange: (spec: Spec<T>, raw: string) => void
  onCommit: () => void
  onReset: (spec: Spec<T>) => void
  saving: boolean
  prefix: string
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((spec) => {
        const Icon = icons[spec.key]
        const changed = values[spec.key] !== defaults[spec.key]
        return (
          <div
            key={String(spec.key)}
            className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
                <div className="min-w-0">
                  <Label htmlFor={`${prefix}-${String(spec.key)}`} className="text-sm">
                    {spec.label}
                  </Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    当前 {fmt(values[spec.key], spec as Spec<never>)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Input
                  id={`${prefix}-${String(spec.key)}`}
                  type="number"
                  inputMode="numeric"
                  value={values[spec.key]}
                  min={spec.min}
                  max={spec.max}
                  onChange={(e) => onChange(spec, e.target.value)}
                  onBlur={onCommit}
                  className="h-8 w-[104px] text-xs text-right tabular-nums"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!changed || saving}
                  onClick={() => onReset(spec)}
                  title="恢复默认"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-[var(--text-dim)] leading-relaxed">{spec.hint}</p>
            <p className="text-[10px] text-muted-foreground">
              取值 {fmt(spec.min, spec as Spec<never>)} – {fmt(spec.max, spec as Spec<never>)} ·
              默认 {fmt(defaults[spec.key], spec as Spec<never>)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

/** 区块外壳（标题 + 已改计数 + 恢复默认） */
function SectionShell({
  title,
  desc,
  modified,
  saving,
  onResetAll,
  children,
}: {
  title: string
  desc: string
  modified: number
  saving: boolean
  onResetAll: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{title}</h3>
                {modified > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {modified} 项已修改
                  </Badge>
                )}
                {saving && (
                  <span className="text-[10px] text-muted-foreground">保存中…</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{desc}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || modified === 0}
              onClick={onResetAll}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认
            </Button>
          </div>
        </CardContent>
      </Card>
      {children}
    </div>
  )
}

export function ProxyRuntimeSettings() {
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState({ ...DEFAULT_PROXY_RUNTIME_CONFIG })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (config as { proxyRuntime?: ProxyRuntimeConfig } | null)?.proxyRuntime
    if (stored) setValues({ ...DEFAULT_PROXY_RUNTIME_CONFIG, ...stored })
  }, [config])

  useEffect(() => {
    if (!config) void fetchConfig()
  }, [config, fetchConfig])

  const modified = PROXY_FIELDS.filter(
    (f) => values[f.key] !== DEFAULT_PROXY_RUNTIME_CONFIG[f.key],
  ).length

  const commit = useCallback(
    async (next: typeof values) => {
      setSaving(true)
      try {
        await updateConfig({ proxyRuntime: next } as never)
      } finally {
        setSaving(false)
      }
    },
    [updateConfig],
  )

  return (
    <SectionShell
      title="代理转发与探测"
      desc="控制请求去重、流式缓冲、供应商探测与定时任务的节奏。参数改动即时生效，影响后续所有代理请求。"
      modified={modified}
      saving={saving}
      onResetAll={() => {
        const d = { ...DEFAULT_PROXY_RUNTIME_CONFIG }
        setValues(d)
        void commit(d)
      }}
    >
      <FieldGrid
        fields={PROXY_FIELDS}
        icons={PROXY_ICONS}
        values={values}
        defaults={DEFAULT_PROXY_RUNTIME_CONFIG}
        saving={saving}
        prefix="pxr"
        onCommit={() => void commit(values)}
        onChange={(spec, raw) => {
          if (raw === '') return
          const n = Number(raw)
          if (!Number.isFinite(n)) return
          setValues((prev) => ({
            ...prev,
            [spec.key]: Math.max(spec.min, Math.min(spec.max, Math.floor(n))),
          }))
        }}
        onReset={(spec) => {
          const next = { ...values, [spec.key]: DEFAULT_PROXY_RUNTIME_CONFIG[spec.key] }
          setValues(next)
          void commit(next)
        }}
      />
    </SectionShell>
  )
}

export function LogRuntimeSettings() {
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState({ ...DEFAULT_LOG_RUNTIME_CONFIG })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (config as { logRuntime?: LogRuntimeConfig } | null)?.logRuntime
    if (stored) setValues({ ...DEFAULT_LOG_RUNTIME_CONFIG, ...stored })
  }, [config])

  useEffect(() => {
    if (!config) void fetchConfig()
  }, [config, fetchConfig])

  const modified = LOG_FIELDS.filter(
    (f) => values[f.key] !== DEFAULT_LOG_RUNTIME_CONFIG[f.key],
  ).length

  const commit = useCallback(
    async (next: typeof values) => {
      setSaving(true)
      try {
        await updateConfig({ logRuntime: next } as never)
      } finally {
        setSaving(false)
      }
    },
    [updateConfig],
  )

  return (
    <SectionShell
      title="日志保留与缓存"
      desc="控制日志的内存与磁盘占用、审计落盘节奏，以及提示分片缓存的容量。"
      modified={modified}
      saving={saving}
      onResetAll={() => {
        const d = { ...DEFAULT_LOG_RUNTIME_CONFIG }
        setValues(d)
        void commit(d)
      }}
    >
      <FieldGrid
        fields={LOG_FIELDS}
        icons={LOG_ICONS}
        values={values}
        defaults={DEFAULT_LOG_RUNTIME_CONFIG}
        saving={saving}
        prefix="lgr"
        onCommit={() => void commit(values)}
        onChange={(spec, raw) => {
          if (raw === '') return
          const n = Number(raw)
          if (!Number.isFinite(n)) return
          setValues((prev) => ({
            ...prev,
            [spec.key]: Math.max(spec.min, Math.min(spec.max, Math.floor(n))),
          }))
        }}
        onReset={(spec) => {
          const next = { ...values, [spec.key]: DEFAULT_LOG_RUNTIME_CONFIG[spec.key] }
          setValues(next)
          void commit(next)
        }}
      />
    </SectionShell>
  )
}
