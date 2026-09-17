import { useCallback, useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Ban, HelpCircle, Plus, Trash2, RotateCcw, ShieldCheck } from 'lucide-react'

/** 与后端 permissionConfig 的 PermissionRuleEntry 对应 */
interface RuleEntry {
  behavior: 'allow' | 'deny' | 'ask'
  rule: string
  source?: string
}

/** 解析结果预览（与后端 permissionRuleValueFromString 的返回结构对应） */
interface ParsedRule {
  toolName?: string
  ruleContent?: string
}

const BEHAVIORS = [
  { value: 'allow', label: '放行', hint: '直接执行，不再询问', icon: Check, cls: 'text-emerald-500 dark:text-emerald-400' },
  { value: 'deny', label: '拒绝', hint: '直接拒绝，且不可被其它规则放行', icon: Ban, cls: 'text-red-500 dark:text-red-400' },
  { value: 'ask', label: '询问', hint: '每次执行前都向用户确认', icon: HelpCircle, cls: 'text-amber-500 dark:text-amber-400' },
] as const

/** 常见规则模板：降低「不知道该写什么」的门槛 */
const TEMPLATES: RuleEntry[] = [
  { behavior: 'allow', rule: 'Read' },
  { behavior: 'allow', rule: 'Glob' },
  { behavior: 'allow', rule: 'Grep' },
  { behavior: 'ask', rule: 'Bash(rm **)' },
  { behavior: 'ask', rule: 'Bash(git push **)' },
  { behavior: 'ask', rule: 'Bash(npm publish **)' },
]

export function PermissionRulesSettings() {
  const [rules, setRules] = useState<RuleEntry[]>([])
  const [draft, setDraft] = useState<RuleEntry>({ behavior: 'ask', rule: '' })
  const [preview, setPreview] = useState<ParsedRule | null>(null)
  const [configPath, setConfigPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = typeof window !== 'undefined' ? window.electronAPI?.permissions : undefined

  const load = useCallback(async () => {
    if (!api) {
      setError('当前环境不支持权限配置')
      setLoading(false)
      return
    }
    try {
      const [r, p] = await Promise.all([api.getRules(), api.getPath()])
      if (r.success && Array.isArray(r.data)) setRules(r.data as RuleEntry[])
      if (p.success) setConfigPath((p.data as string) ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  // 输入规则字符串时即时预览解析结果 —— 避免保存后才发现工具名写错
  useEffect(() => {
    if (!api || !draft.rule.trim()) {
      setPreview(null)
      return
    }
    let cancelled = false
    void api.parse(draft.rule).then((res) => {
      if (cancelled) return
      setPreview(res.success ? ((res.data as ParsedRule) ?? null) : null)
    })
    return () => {
      cancelled = true
    }
  }, [api, draft.rule])

  const commit = useCallback(
    async (next: RuleEntry[]) => {
      if (!api) return
      setSaving(true)
      setError(null)
      try {
        const res = await api.setRules(next as never)
        if (!res.success) {
          setError(res.error || '保存失败')
          return
        }
        setRules(next)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setSaving(false)
      }
    },
    [api],
  )

  const addRule = () => {
    const rule = draft.rule.trim()
    if (!rule) return
    // 同名同裁决去重，避免重复项
    if (rules.some((r) => r.rule === rule && r.behavior === draft.behavior)) {
      setError('已存在完全相同的规则')
      return
    }
    const next = [...rules, { ...draft, rule }]
    setDraft({ behavior: draft.behavior, rule: '' })
    setError(null)
    void commit(next)
  }

  const removeRule = (idx: number) => {
    const next = rules.filter((_, i) => i !== idx)
    void commit(next)
  }

  const changeBehavior = (idx: number, behavior: RuleEntry['behavior']) => {
    const next = rules.map((r, i) => (i === idx ? { ...r, behavior } : r))
    void commit(next)
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground py-2">加载中…</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                <h3 className="text-sm font-semibold">工具权限规则</h3>
                {rules.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {rules.length} 条
                  </Badge>
                )}
                {saving && (
                  <span className="text-[10px] text-muted-foreground">保存中…</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                精确到参数级别地控制工具调用。例如放行 <code className="text-[var(--accent-primary)]">git status</code>
                {' '}但每次询问 <code className="text-[var(--accent-primary)]">git push</code>。
                <br />
                <span className="text-amber-500 dark:text-amber-400">
                  注意：<b>拒绝</b>优先级最高，不会被其它规则放行；未命中任何规则时沿用原有的权限判定。
                </span>
              </p>
              {configPath && (
                <p className="text-[10px] text-[var(--text-dim)] break-all">
                  配置文件：{configPath}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving}
              onClick={() => void load()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              从磁盘重载
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 新增规则 */}
      <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 space-y-3">
        <Label className="text-sm">新增规则</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={draft.behavior}
            onValueChange={(v) => setDraft((p) => ({ ...p, behavior: v as RuleEntry['behavior'] }))}
          >
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BEHAVIORS.map((b) => (
                <SelectItem key={b.value} value={b.value} className="text-xs">
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={draft.rule}
            onChange={(e) => setDraft((p) => ({ ...p, rule: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addRule()
            }}
            placeholder="Bash(git status) 或 Read 或 Edit(src/**)"
            className="h-8 flex-1 min-w-[220px] text-xs font-mono"
          />
          <Button size="sm" className="gap-1.5 h-8" onClick={addRule} disabled={!draft.rule.trim() || saving}>
            <Plus className="h-3.5 w-3.5" />
            添加
          </Button>
        </div>

        {/* 解析预览 */}
        {draft.rule.trim() && (
          <p className="text-[11px] text-[var(--text-dim)]">
            {preview?.toolName ? (
              <>
                解析结果：工具 <b className="text-[var(--accent-primary)]">{preview.toolName}</b>
                {preview.ruleContent ? (
                  <>
                    ，参数匹配 <code>{preview.ruleContent}</code>
                  </>
                ) : (
                  <>（整个工具，不限参数）</>
                )}
              </>
            ) : (
              <span className="text-amber-500 dark:text-amber-400">无法解析出工具名，保存后该条会被忽略</span>
            )}
          </p>
        )}

        {/* 模板快捷添加 */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-muted-foreground">常用：</span>
          {TEMPLATES.map((t) => {
            const exists = rules.some((r) => r.rule === t.rule && r.behavior === t.behavior)
            return (
              <button
                key={`${t.behavior}:${t.rule}`}
                type="button"
                disabled={exists || saving}
                onClick={() => {
                  setDraft(t)
                  if (!exists) void commit([...rules, t])
                }}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                  exists
                    ? 'border-[var(--glass-border)] text-muted-foreground opacity-50 cursor-not-allowed'
                    : 'border-[var(--glass-border)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                }`}
              >
                {BEHAVIORS.find((b) => b.value === t.behavior)?.label} {t.rule}
              </button>
            )
          })}
        </div>

        {error && <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>}
      </div>

      {/* 规则列表 */}
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">
          暂无规则。未配置时沿用原有的权限判定逻辑，行为与未启用本功能时一致。
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((r, idx) => {
            const meta = BEHAVIORS.find((b) => b.value === r.behavior)
            const Icon = meta?.icon ?? HelpCircle
            return (
              <div
                key={`${r.rule}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${meta?.cls ?? ''}`} />
                  <code className="text-xs font-mono truncate">{r.rule}</code>
                  {r.source && r.source !== 'userSettings' && (
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {r.source}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Select
                    value={r.behavior}
                    onValueChange={(v) => changeBehavior(idx, v as RuleEntry['behavior'])}
                    disabled={saving}
                  >
                    <SelectTrigger className="h-7 w-[86px] text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BEHAVIORS.map((b) => (
                        <SelectItem key={b.value} value={b.value} className="text-xs">
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={saving}
                    onClick={() => removeRule(idx)}
                    title="删除该规则"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
