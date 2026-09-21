/**
 * ToolMetricsPanel — 工具运行时度量面板（dev.txt §13）
 *
 * 背景：`toolMetrics` 一直在采集数据（每次工具调用、每次上下文构建），
 * IPC handler 与 preload API 也都就绪，但**渲染层从来没有调用方** ——
 * 记录只进内存环形缓冲（2000 条上限）后就被覆盖，用户与开发者都看不到。
 * 本组件补上这个出口。
 *
 * 展示两类信息：
 *   1. 上下文状态（contextStatus）：是否启用分层、工具总数、全量基线 token、预算
 *      —— 用来判断"分层到底省了多少"
 *   2. 运行时汇总（metrics）：成功率 / 误选率 / 被拒率 / 耗时 / TopN 工具
 *      —— 其中**误选率**（模型调了没加载的工具）是分层模式的核心风险指标
 *
 * 注意：数据是**进程内内存态**，重启 Electron 即清零；这是设计如此
 * （见 toolMetrics.ts 头注释），故界面标注了这一点，避免被误读成"功能坏了"。
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionCard } from '@/components/ui/section-card'
import { RefreshCw, Trash2, Gauge, Layers } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface MetricsSummary {
  totalCalls: number
  successRate: number
  misselectRate: number
  deniedRate: number
  avgDurationMs: number
  avgOutputBytes: number
  totalContexts: number
  avgExposedTools: number
  avgToolTokens: number
  layeredRatio: number
  topTools: Array<{ name: string; count: number }>
}

interface ContextStatus {
  layered: boolean
  totalTools: number
  fullContextTokens: number
  budgetTokens: number
}

/** 百分比显示（数据源是 0~1 的比例） */
function pct(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function num(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

export function ToolMetricsPanel() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const api = window.electronAPI.tools

  const [summary, setSummary] = useState<MetricsSummary | null>(null)
  const [status, setStatus] = useState<ContextStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 两个请求互不依赖，并行取
      const [m, s] = await Promise.all([api.metrics(), api.contextStatus()])
      if (m.success) setSummary(m.data as MetricsSummary)
      else if (m.error) toast({ title: m.error, variant: 'destructive' })
      if (s.success) setStatus(s.data as ContextStatus)
      else if (s.error) toast({ title: s.error, variant: 'destructive' })
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [api, toast])

  useEffect(() => {
    void load()
  }, [load])

  const handleReset = async () => {
    const r = await api.resetMetrics()
    if (r.success) {
      toast({ title: t('tools.metricsResetDone', '度量已清空') })
      await load()
    } else {
      toast({ title: r.error || t('tools.metricsResetFailed', '清空失败'), variant: 'destructive' })
    }
  }

  /** 单条指标卡片 */
  const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-3 py-2">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-lg text-[var(--text-primary)] font-medium">{value}</div>
      {hint && <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{hint}</div>}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ========== 上下文状态 ========== */}
      <SectionCard
        icon={Layers}
        title={t('tools.contextStatusTitle', '工具上下文状态')}
      >
        <p className="text-xs text-[var(--text-dim)] leading-relaxed mb-3">
          {t(
            'tools.contextStatusDesc',
            '分层暴露默认关闭（设 KX2_TOOL_CONTEXT=layered 启用）。全量 token 是"所有工具都发给模型"的基线成本，用于对比分层收益。',
          )}
        </p>
        {status ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-3 py-2">
              <div className="text-xs text-[var(--text-muted)]">{t('tools.exposureMode', '暴露模式')}</div>
              <div className="mt-1">
                {status.layered ? (
                  <Badge className="bg-[var(--accent-primary)]">{t('tools.layered', '分层')}</Badge>
                ) : (
                  <Badge variant="outline">{t('tools.legacyFull', '全量')}</Badge>
                )}
              </div>
            </div>
            <Stat label={t('tools.totalTools', '工具总数')} value={num(status.totalTools)} />
            <Stat
              label={t('tools.fullContextTokens', '全量 token 基线')}
              value={num(status.fullContextTokens)}
              hint={t('tools.fullContextTokensHint', '当前全部工具都发送时的估算')}
            />
            <Stat
              label={t('tools.budgetTokens', '工具预算')}
              value={num(status.budgetTokens)}
              hint={t('tools.budgetTokensHint', '默认占上下文窗口 20%')}
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">{t('tools.metricsNoData', '暂无数据')}</p>
        )}
      </SectionCard>

      {/* ========== 运行时度量 ========== */}
      <SectionCard
        icon={Gauge}
        title={t('tools.metricsTitle', '运行时度量')}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-xs text-[var(--text-dim)] leading-relaxed">
            {t(
              'tools.metricsDesc',
              '统计本次运行（进程内内存态，重启后清零）。误选率指模型调用了不在活跃集里的工具 —— 分层模式下该值升高说明检索/加载环节需要调优。',
            )}
          </p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {t('tools.refresh', '刷新')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleReset()}>
              <Trash2 className="w-4 h-4 mr-1" />
              {t('tools.resetMetrics', '清空')}
            </Button>
          </div>
        </div>

        {summary && summary.totalCalls + summary.totalContexts > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat label={t('tools.totalCalls', '工具调用次数')} value={num(summary.totalCalls)} />
              <Stat label={t('tools.successRate', '成功率')} value={pct(summary.successRate)} />
              <Stat
                label={t('tools.misselectRate', '误选率')}
                value={pct(summary.misselectRate)}
                hint={t('tools.misselectHint', '调用了未加载的工具')}
              />
              <Stat label={t('tools.deniedRate', '被拒率')} value={pct(summary.deniedRate)} />
              <Stat label={t('tools.avgDuration', '平均耗时')} value={`${num(summary.avgDurationMs, 1)} ms`} />
              <Stat
                label={t('tools.avgToolTokens', '平均工具 token')}
                value={num(summary.avgToolTokens)}
                hint={t('tools.avgToolTokensHint', '每轮请求工具部分占用')}
              />
              <Stat label={t('tools.totalContexts', '上下文构建次数')} value={num(summary.totalContexts)} />
              <Stat label={t('tools.avgExposed', '平均暴露工具数')} value={num(summary.avgExposedTools, 1)} />
              <Stat
                label={t('tools.layeredRatio', '分层请求占比')}
                value={pct(summary.layeredRatio)}
              />
            </div>

            {summary.topTools.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  {t('tools.topTools', '调用最多的工具：')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {summary.topTools.map((tool) => (
                    <Badge key={tool.name} variant="outline">
                      /{tool.name} × {tool.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {t('tools.metricsEmpty', '暂无记录 —— 发起一次对话后回来看这里。')}
          </p>
        )}
      </SectionCard>
    </div>
  )
}

export default ToolMetricsPanel
