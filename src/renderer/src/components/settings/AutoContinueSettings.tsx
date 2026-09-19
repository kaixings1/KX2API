import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/stores/settingsStore'
import type { AutoContinueConfig } from '@shared/autoContinue'
import { DEFAULT_AUTO_CONTINUE_CONFIG } from '@shared/autoContinue'
import { RotateCcw, Repeat, MessageSquareMore, Lightbulb, BookOpen, CircleCheck } from 'lucide-react'

type Values = Required<Pick<AutoContinueConfig, 'enabled' | 'readSearch' | 'continueKeyword' | 'intentOnly' | 'endTurn'>> & {
  maxCount: number
}

const DEFAULTS: Values = {
  enabled: DEFAULT_AUTO_CONTINUE_CONFIG.enabled,
  maxCount: 5,
  readSearch: DEFAULT_AUTO_CONTINUE_CONFIG.readSearch,
  continueKeyword: DEFAULT_AUTO_CONTINUE_CONFIG.continueKeyword,
  intentOnly: DEFAULT_AUTO_CONTINUE_CONFIG.intentOnly,
  endTurn: DEFAULT_AUTO_CONTINUE_CONFIG.endTurn,
}

interface ToggleSpec {
  key: 'readSearch' | 'continueKeyword' | 'intentOnly' | 'endTurn'
  label: string
  hint: string
  icon: typeof BookOpen
  warn?: string
}

const TOGGLES: ToggleSpec[] = [
  {
    key: 'continueKeyword',
    label: '询问式结尾自动继续',
    hint: '模型在结尾用"是否继续 / 继续吗 / 要我…还是… / 要不要…"这类询问语气征求确认时，自动回复"继续"，让任务持续推进而不是停在提问上。适合你希望它自己做主、少打断的场景。',
    icon: MessageSquareMore,
    warn: '开启后模型在真正需要你拍板的两难选择处也可能被自动带过，若某些步骤必须人工决策，可单独关闭此项。',
  },
  {
    key: 'intentOnly',
    label: '只表达意图就动手',
    hint: '模型只说了"我要… / 我将… / 先让我…"这类计划却没有任何动作或结果就收尾时，自动追一条"请继续执行"，逼它把事做下去，避免"说了就要做、结果没了下文"。',
    icon: Lightbulb,
  },
  {
    key: 'readSearch',
    label: '读文件/搜索后自动续写',
    hint: '模型调用读取、文件列表或搜索类工具后如果提前终止（常见于先翻资料再作答两步走），自动续写让它基于刚拿到的内容继续。',
    icon: BookOpen,
  },
  {
    key: 'endTurn',
    label: '收到答复后自动推进',
    hint: '模型给出一个简短答复（end_turn）后，在次数上限内自动再催一轮"继续"，用于"边想边做"的多步任务自动串完。',
    icon: CircleCheck,
  },
]

export function AutoContinueSettings() {
  const { t } = useTranslation()
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState<Values>({ ...DEFAULTS })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // 从全局配置同步；未配置过的用户看到默认值
  useEffect(() => {
    const stored = (config as { autoContinue?: AutoContinueConfig } | null)?.autoContinue
    if (stored) {
      setValues({
        enabled: stored.enabled ?? DEFAULTS.enabled,
        maxCount: stored.maxCount ?? DEFAULTS.maxCount,
        readSearch: stored.readSearch ?? DEFAULTS.readSearch,
        continueKeyword: stored.continueKeyword ?? DEFAULTS.continueKeyword,
        intentOnly: stored.intentOnly ?? DEFAULTS.intentOnly,
        endTurn: stored.endTurn ?? DEFAULTS.endTurn,
      })
    }
  }, [config])

  const commit = useCallback(
    async (next: Values) => {
      setSaving(true)
      try {
        await updateConfig({ autoContinue: next } as never)
        setSavedAt(Date.now())
      } finally {
        setSaving(false)
      }
    },
    [updateConfig],
  )

  useEffect(() => {
    if (!config) void fetchConfig()
  }, [config, fetchConfig])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">自动流程控制</h3>
                {values.enabled && (
                  <Badge variant="secondary" className="text-[10px]">
                    已开启
                  </Badge>
                )}
                {saving && <span className="text-[10px] text-muted-foreground">保存中…</span>}
                {!saving && savedAt && (
                  <span className="text-[10px] text-emerald-500 dark:text-emerald-400">已保存</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-dim)] leading-relaxed max-w-2xl">
                让智能体在常见中断点自动往下推进，而不是停在一个需要你点头的结尾。
                适合"说了要做却中途停下"、或"反过来问你继续还是停在原地"的长任务。
                总开关关闭时以下场景均不生效。
              </p>
            </div>
            <Switch
              id="autocontinue-enabled"
              checked={values.enabled}
              disabled={saving}
              onCheckedChange={(v) => {
                const next = { ...values, enabled: v }
                setValues(next)
                void commit(next)
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 次数上限 */}
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Repeat className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
            <div className="min-w-0 space-y-1">
              <Label htmlFor="ai-continue-max" className="text-sm">
                单任务自动续写次数上限
              </Label>
              <p className="text-xs text-[var(--text-dim)] leading-relaxed">
                单个提问内自动触发"继续"的最多次数。到顶即停止，避免自动推进失控无限空转。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Input
              id="ai-continue-max"
              type="number"
              inputMode="numeric"
              value={values.maxCount}
              min={1}
              max={50}
              disabled={!values.enabled || saving}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') return
                const n = Number(raw)
                if (!Number.isFinite(n)) return
                const clamped = Math.max(1, Math.min(50, Math.floor(n)))
                setValues((prev) => ({ ...prev, maxCount: clamped }))
              }}
              onBlur={() => void commit(values)}
              className="h-8 w-[92px] text-xs text-right tabular-nums"
            />
            <span className="text-[10px] text-muted-foreground">次</span>
          </div>
        </div>
      </div>

      {/* 场景开关 */}
      {TOGGLES.map((spec) => {
        const Icon = spec.icon
        return (
          <div
            key={spec.key}
            className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--accent-primary)]" />
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`ai-continue-${spec.key}`} className="text-sm">
                      {spec.label}
                    </Label>
                    {values[spec.key] && (
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400">已开启</span>
                    )}
                  </div>
                </div>
              </div>
              <Switch
                id={`ai-continue-${spec.key}`}
                checked={values[spec.key]}
                disabled={!values.enabled || saving}
                onCheckedChange={(v) => {
                  const next = { ...values, [spec.key]: v }
                  setValues(next)
                  void commit(next)
                }}
              />
            </div>
            <p className="text-xs text-[var(--text-dim)] leading-relaxed">{spec.hint}</p>
            {spec.warn && (
              <p className="text-[10px] text-amber-500 dark:text-amber-400 leading-relaxed">{spec.warn}</p>
            )}
          </div>
        )
      })}

      <p className="text-xs text-[var(--text-dim)] leading-relaxed">
        {t(
          'settings.autoContinueNote',
          '提示：自动流程控制是为了减少你在长任务中频繁点"继续"。开启"询问式结尾自动继续"时，若发现它绕过你真的需要的选择，请改让它在关键取舍处停下明确征询你的意见。',
        )}
      </p>
    </div>
  )
}