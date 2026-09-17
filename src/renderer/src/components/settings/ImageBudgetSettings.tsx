import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import { DEFAULT_IMAGE_BUDGET_CONFIG, type ImageBudgetConfig } from '@shared/types'
import { RotateCcw, ImageIcon, ImageOff, ShieldCheck } from 'lucide-react'

type Values = Required<ImageBudgetConfig>

interface FieldSpec {
  key: keyof Values
  label: string
  hint: string
  min: number
  max: number
  /** 展示时折算单位 */
  scale?: { div: number; suffix: string }
  /** 0 是否表示"不限制" */
  zeroMeansUnlimited?: boolean
}

const FIELDS: FieldSpec[] = [
  {
    key: 'historyBase64TokenThreshold',
    label: '历史图片总量上限',
    hint: '最近几轮之外的图片合计超过该 token 数时，从最旧的开始替换为占位文本。填 0 表示永不裁剪历史图片。',
    min: 0,
    max: 500000,
    scale: { div: 1000, suffix: 'k token' },
    zeroMeansUnlimited: true,
  },
  {
    key: 'maxImageTokensPerMessage',
    label: '单条消息图片上限',
    hint: '单条消息内的图片总量超过该值时，保留最后的若干张（用户最后发的更可能相关）。填 0 表示不限制。',
    min: 0,
    max: 200000,
    scale: { div: 1000, suffix: 'k token' },
    zeroMeansUnlimited: true,
  },
  {
    key: 'keepRecentMessages',
    label: '最近消息保护条数',
    hint: '最近这么多条消息里的图片永不替换 —— 用户刚发的图正在被讨论，替换掉等于答非所问。',
    min: 0,
    max: 20,
    scale: { div: 1, suffix: '条' },
  },
]

const ICONS: Record<keyof Values, typeof ImageIcon> = {
  historyBase64TokenThreshold: ImageOff,
  maxImageTokensPerMessage: ImageIcon,
  keepRecentMessages: ShieldCheck,
}

function fmt(v: number, spec: FieldSpec): string {
  if (spec.zeroMeansUnlimited && v === 0) return '不限制'
  const n = spec.scale ? v / spec.scale.div : v
  const num = Number.isInteger(n) ? n : n.toFixed(1)
  return spec.scale ? `${num} ${spec.scale.suffix}` : String(v)
}

export function ImageBudgetSettings() {
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState<Values>({ ...DEFAULT_IMAGE_BUDGET_CONFIG })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (config as { imageBudget?: ImageBudgetConfig } | null)?.imageBudget
    if (stored) setValues({ ...DEFAULT_IMAGE_BUDGET_CONFIG, ...stored })
  }, [config])

  useEffect(() => {
    if (!config) void fetchConfig()
  }, [config, fetchConfig])

  const modifiedCount = FIELDS.filter(
    (f) => values[f.key] !== DEFAULT_IMAGE_BUDGET_CONFIG[f.key],
  ).length

  const commit = useCallback(
    async (next: Values) => {
      setSaving(true)
      try {
        await updateConfig({ imageBudget: next } as never)
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

  const disabled = values.historyBase64TokenThreshold === 0 &&
    values.maxImageTokensPerMessage === 0

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">图片上下文预算</h3>
                {modifiedCount > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {modifiedCount} 项已修改
                  </Badge>
                )}
                {disabled && (
                  <Badge variant="outline" className="text-[10px] text-amber-500">
                    当前不裁剪
                  </Badge>
                )}
                {saving && (
                  <span className="text-[10px] text-muted-foreground">保存中…</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                图片的 base64 数据会**永久驻留对话历史**，且不像文本那样能被摘要压缩
                —— 几张截图就能堆出几十万 token。这里控制超限的历史图片如何被替换为占位文本。
                <br />
                <span className="text-[var(--text-dim)]">
                  被替换的图片不会消失：模型会看到「此处曾有图」的提示，需要时你可以让它重新读取或再发一次。
                </span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || modifiedCount === 0}
              onClick={() => {
                const d = { ...DEFAULT_IMAGE_BUDGET_CONFIG }
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
          const changed = values[spec.key] !== DEFAULT_IMAGE_BUDGET_CONFIG[spec.key]
          return (
            <div
              key={spec.key}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
                  <div className="min-w-0">
                    <Label htmlFor={`img-${spec.key}`} className="text-sm">
                      {spec.label}
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      当前 {fmt(values[spec.key], spec)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    id={`img-${spec.key}`}
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
                      const next = { ...values, [spec.key]: DEFAULT_IMAGE_BUDGET_CONFIG[spec.key] }
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
                取值 {fmt(spec.min, spec)} – {fmt(spec.max, spec)} · 默认{' '}
                {fmt(DEFAULT_IMAGE_BUDGET_CONFIG[spec.key], spec)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
