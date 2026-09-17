import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { BackButton } from '@/components/ui/back-button'
import { Trash2, Play, Loader2, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const plansApi = window.electronAPI.plans

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: '待执行', variant: 'secondary' },
  running: { label: '执行中', variant: 'default' },
  completed: { label: '已完成', variant: 'outline' },
  failed: { label: '失败', variant: 'destructive' },
}

interface PlanStep {
  id: string
  description: string
  status: string
  result?: string
}

interface PlanDetail {
  id: string
  title: string
  description: string
  steps: PlanStep[]
  status: string
  createdAt: number
  updatedAt: number
}

export function PlanDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [executing, setExecuting] = useState(false)
  const [execError, setExecError] = useState<string | null>(null)

  const planIdRef = useRef(id)

  const loadPlan = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const plan = await plansApi.getById(id)
      if (plan) {
        const p = plan as PlanDetail
        setPlan(p)
        setEditTitle(p.title)
        setEditDescription(p.description)
      }
    } catch (e) {
      console.error('[PlanDetail] Failed to load:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadPlan() }, [loadPlan])

  useEffect(() => {
    if (!id) return
    planIdRef.current = id
    const unsubPhase = plansApi.onPhaseChange((evt) => {
      setPlan(prev => {
        if (!prev || prev.id !== planIdRef.current) return prev
        const steps = prev.steps.map(s => {
          if (s.id === evt.stepId && evt.phase === 'complete') {
            return { ...s, status: 'completed' }
          }
          return s
        })
        const allDone = steps.every(s => s.status === 'completed')
        const anyDone = steps.some(s => s.status === 'completed')
        const status = allDone ? 'completed' : anyDone ? 'running' : 'pending'
        return { ...prev, steps, status }
      })
    })
    const unsubDone = plansApi.onDone(() => { loadPlan() })
    const unsubError = plansApi.onError((evt) => {
      setExecError(evt.error)
      setExecuting(false)
      loadPlan()
    })
    return () => {
      unsubPhase()
      unsubDone()
      unsubError()
    }
  }, [id, loadPlan])

  const handleSave = async () => {
    if (!id) return
    await plansApi.update(id, { title: editTitle, description: editDescription })
    setEditOpen(false)
    loadPlan()
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm(t('plans.confirmDelete', '确定删除此计划?'))) return
    await plansApi.delete(id)
    navigate('/plans')
  }

  const handleExecute = async () => {
    if (!id) return
    setExecuting(true)
    setExecError(null)
    try {
      const res = await plansApi.execute(id)
      if (!res.success) {
        setExecError(res.error || '执行失败')
      }
    } catch (e) {
      setExecError(e instanceof Error ? e.message : '执行失败')
    } finally {
      setExecuting(false)
      loadPlan()
    }
  }

  const handleStepToggle = async (stepId: string) => {
    if (!id || !plan) return
    const updatedSteps = plan.steps.map(s =>
      s.id === stepId ? { ...s, status: s.status === 'completed' ? 'pending' : 'completed' } : s
    )
    const allDone = updatedSteps.every(s => s.status === 'completed')
    const anyDone = updatedSteps.some(s => s.status === 'completed')
    const status = allDone ? 'completed' : anyDone ? 'running' : 'pending'
    await plansApi.update(id, { steps: updatedSteps, status })
    loadPlan()
  }

  const getProgress = () => {
    if (!plan || plan.steps.length === 0) return 0
    return Math.round(plan.steps.filter(s => s.status === 'completed').length / plan.steps.length * 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="space-y-4">
        <BackButton to="/plans" label="返回列表" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            计划不存在或已被删除
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: t('plans.title', '计划管理'), href: '/plans' },
        { label: plan.title },
      ]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/plans" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{plan.title}</h2>
            <p className="text-muted-foreground text-sm">{t('plans.idLabel', 'ID')}: {plan.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>{t('common.edit', '编辑')}</Button>
          <Button variant="default" size="sm" onClick={handleExecute} disabled={plan.status === 'running' || executing}>
            <Play className="h-3 w-3 mr-1" /> {executing ? t('plans.executing', '执行中...') : t('plans.execute', '执行')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {execError && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="py-3 text-sm text-red-500 dark:text-red-400">
            {t('plans.executionFailed', '执行失败')}: {execError}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('plans.basicInfo', '基本信息')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('plans.titleLabel', '标题')}</span>
              <span>{plan.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('plans.statusLabel', '状态')}</span>
              <Badge variant={STATUS_MAP[plan.status]?.variant || 'secondary'}>
                {STATUS_MAP[plan.status]?.label || plan.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('plans.progress', '步骤进度')}</span>
              <span>{getProgress()}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('plans.timeInfo', '时间信息')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('plans.createdAt', '创建时间')}</span>
              <span>{new Date(plan.createdAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('plans.descriptionLabel', '描述')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{plan.description || t('plans.noDescription', '(无描述)')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{t('plans.executionSteps', '执行步骤')}</CardTitle>
            <span className="text-xs text-muted-foreground">{getProgress()}% {t('plans.complete', '完成')}</span>
          </div>
          <Progress value={getProgress()} className="h-1.5" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {plan.steps.map((step, i) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 text-sm p-3 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-muted/30 transition-colors",
                  step.status === 'completed' && 'bg-muted/20'
                )}
                onClick={() => handleStepToggle(step.id)}
              >
                {step.status === 'completed'
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                <span className={cn(step.status === 'completed' && 'text-muted-foreground line-through')}>
                  {i + 1}. {step.description}
                </span>
                {step.result && (
                  <span className="text-xs text-muted-foreground ml-2">{step.result}</span>
                )}
                <Badge variant={step.status === 'completed' ? 'outline' : 'secondary'} className="ml-auto text-[10px]">
                  {step.status === 'completed' ? t('plans.completed', '已完成') : step.status === 'failed' ? t('plans.failed', '失败') : t('plans.pending', '待执行')}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('plans.editTitle', '编辑计划')}</DialogTitle>
            <DialogDescription>{t('plans.editDesc', '修改计划基本信息')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('plans.titleLabel', '标题')}</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label>{t('plans.descriptionLabel', '描述')}</Label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} />
            </div>
            <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PlanDetailPage
