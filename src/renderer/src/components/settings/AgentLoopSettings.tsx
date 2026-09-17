import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useSettingsStore } from '@/stores/settingsStore'
import { DEFAULT_AGENT_LOOP_CONFIG, type AgentLoopConfig } from '@shared/loopConfig'
import {
  RotateCcw,
  Repeat,
  ShieldAlert,
  Coins,
  Infinity as InfinityIcon,
  Timer,
} from 'lucide-react'

type LoopLimits = Required<AgentLoopConfig>

/** 每个参数的可编辑元信息：标题、说明、图标、取值范围 */
interface FieldSpec {
  key: keyof LoopLimits
  label: string
  hint: string
  min: number
  max: number
  /** 单位后缀，空表示纯次数 */
  unit?: string
}

const FIELDS: FieldSpec[] = [
  {
    key: 'maxIterations',
    label: '最大循环轮数',
    hint: '单次提问内「模型思考 → 调用工具 → 再思考」的最大往返次数。超出即中止，防止无限循环。',
    min: 1,
    max: 1000,
  },
  {
    key: 'maxInvalidToolCalls',
    label: '无效工具名容忍次数',
    hint: '模型连续给出无法识别的工具名达到该次数即停止。调大可容忍模型试错，调小可更快止损。',
    min: 1,
    max: 20,
  },
  {
    key: 'maxToolFailures',
    label: '工具失败容忍次数',
    hint: '工具连续执行失败（报错）达到该次数即停止本轮，避免反复撞同一堵墙。',
    min: 1,
    max: 20,
  },
  {
    key: 'maxConsecutiveMaxTokens',
    label: '输出截断容忍次数',
    hint: '连续因长度上限被截断达到该次数即停止续写，避免反复续写烧掉额度。',
    min: 1,
    max: 20,
  },
  {
    key: 'toolLoopThreshold',
    label: '重复调用切断阈值',
    hint: '连续几轮发出完全相同的工具调用（参数也一致）即判定为卡死并切断。',
    min: 1,
    max: 10,
  },
  {
    key: 'autoContinueMaxCount',
    label: '自动续写次数上限',
    hint: '开启自动续写时，单个任务内最多自动推进的次数。',
    min: 1,
    max: 50,
  },
  {
    key: 'autoContinueDelayMs',
    label: '自动续写等待',
    hint: '命中「是否继续」等询问后，等待多久自动发送「继续」。',
    min: 0,
    max: 60000,
    unit: 'ms',
  },
]

const FIELD_ICONS: Record<keyof LoopLimits, typeof Repeat> = {
  maxIterations: InfinityIcon,
  maxInvalidToolCalls: ShieldAlert,
  maxToolFailures: ShieldAlert,
  maxConsecutiveMaxTokens: Coins,
  toolLoopThreshold: Repeat,
  autoContinueMaxCount: Repeat,
  autoContinueDelayMs: Timer,
}

/** 判断当前值是否偏离默认（用于展示「已改」标记） */
function isModified(values: LoopLimits, key: keyof LoopLimits): boolean {
  return values[key] !== DEFAULT_AGENT_LOOP_CONFIG[key]
}

export function AgentLoopSettings() {
  const { t } = useTranslation()
  const { config, updateConfig, fetchConfig } = useSettingsStore()
  const [values, setValues] = useState<LoopLimits>({ ...DEFAULT_AGENT_LOOP_CONFIG })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // 从全局配置同步初始值；未配置过的用户看到的是默认值
  useEffect(() => {
    const stored = (config as { agentLoop?: AgentLoopConfig } | null)?.agentLoop
    if (stored) {
      setValues({ ...DEFAULT_AGENT_LOOP_CONFIG, ...stored })
    }
  }, [config])

  const modifiedCount = useMemo(
    () => FIELDS.filter((f) => isModified(values, f.key)).length,
    [values],
  )

  const commit = useCallback(
    async (next: LoopLimits) => {
      setSaving(true)
      try {
        await updateConfig({ agentLoop: next } as never)
        setSavedAt(Date.now())
      } finally {
        setSaving(false)
      }
    },
    [updateConfig],
  )

  const handleChange = (key: keyof LoopLimits, raw: string, spec: FieldSpec) => {
    // 允许输入框暂时为空，不立刻纠正，避免打断输入
    if (raw === '') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    const clamped = Math.max(spec.min, Math.min(spec.max, Math.floor(n)))
    setValues((prev) => ({ ...prev, [key]: clamped }))
  }

  const handleBlur = (spec: FieldSpec) => {
    void commit(values)
    void spec
  }

  const resetAll = () => {
    const defaults = { ...DEFAULT_AGENT_LOOP_CONFIG }
    setValues(defaults)
    void commit(defaults)
  }

  const resetOne = (key: keyof LoopLimits) => {
    const next = { ...values, [key]: DEFAULT_AGENT_LOOP_CONFIG[key] }
    setValues(next)
    void commit(next)
  }

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
                <h3 className="text-sm font-semibold">智能体循环控制</h3>
                {modifiedCount > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {modifiedCount} 项已修改
                  </Badge>
                )}
                {saving && (
                  <span className="text-[10px] text-muted-foreground">保存中…</span>
                )}
                {!saving && savedAt && (
                  <span className="text-[10px] text-emerald-500 dark:text-emerald-400">已保存</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                控制智能体在一次提问中循环多少轮、遇到什么情况该停止。
                这些参数原先写死在代码里，调整后立即生效，无需重启。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
              disabled={saving || modifiedCount === 0}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              全部恢复默认
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {FIELDS.map((spec) => {
          const Icon = FIELD_ICONS[spec.key]
          const changed = isModified(values, spec.key)
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
                      <Label htmlFor={`loop-${spec.key}`} className="text-sm">
                        {spec.label}
                      </Label>
                      {changed && (
                        <span
                          className="text-[10px] text-amber-500 dark:text-amber-400"
                          title={`默认 ${DEFAULT_AGENT_LOOP_CONFIG[spec.key]}`}
                        >
                          已改
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    id={`loop-${spec.key}`}
                    type="number"
                    inputMode="numeric"
                    value={values[spec.key]}
                    min={spec.min}
                    max={spec.max}
                    onChange={(e) => handleChange(spec.key, e.target.value, spec)}
                    onBlur={() => handleBlur(spec)}
                    className="h-8 w-[92px] text-xs text-right tabular-nums"
                  />
                  {spec.unit && (
                    <span className="text-[10px] text-muted-foreground">{spec.unit}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!changed || saving}
                    onClick={() => resetOne(spec.key)}
                    title="恢复默认"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-[var(--text-dim)] leading-relaxed">
                {spec.hint}
              </p>
              <p className="text-[10px] text-muted-foreground">
                取值 {spec.min} – {spec.max}
                {spec.unit ? ` ${spec.unit}` : ''} · 默认 {DEFAULT_AGENT_LOOP_CONFIG[spec.key]}
              </p>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-[var(--text-dim)] leading-relaxed">
        {t(
          'settings.agentLoopNote',
          '提示：调大轮数上限与容忍次数会让智能体更「执着」，适合复杂任务但更耗额度；调小则更快失败退出，适合需要严格控制成本的场景。',
        )}
      </p>
    </div>
  )
}
