import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Play, Loader2, Calendar, GripVertical, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const plansApi = window.electronAPI.plans

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: '待执行', variant: 'secondary' },
  running: { label: '执行中', variant: 'default' },
  completed: { label: '已完成', variant: 'outline' },
  failed: { label: '失败', variant: 'destructive' },
}

export function PlanManagement() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const loadPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await plansApi.getAll()
      setPlans(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error('[PlanManagement] Failed to load plans:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadPlans() }, [loadPlans])

  const openCreate = () => {
    setEditingPlan(null)
    setTitle('')
    setDescription('')
    setStepsText('')
    setDialogOpen(true)
  }

  const openEdit = (plan: PlanRecord) => {
    setEditingPlan(plan)
    setTitle(plan.title)
    setDescription(plan.description)
    setStepsText(plan.steps.map(s => s.description).join('\n'))
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (editingPlan) {
      await plansApi.update(editingPlan.id, { title, description })
    } else {
      const steps = stepsText.split('\n').filter(Boolean).map((desc, i) => ({
        id: `step_${Date.now()}_${i}`,
        description: desc.trim(),
        status: 'pending',
      }))
      await plansApi.create({ title, description, steps })
    }
    setDialogOpen(false)
    loadPlans()
  }

  const handleDelete = async (id: string) => {
    await plansApi.delete(id)
    loadPlans()
  }

  const handleExecute = async (id: string) => {
    await plansApi.execute(id)
    loadPlans()
  }

  const handleStepToggle = async (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return
    const updatedSteps = plan.steps.map(s =>
      s.id === stepId ? { ...s, status: s.status === 'completed' ? 'pending' : 'completed' as string } : s
    )
    const allDone = updatedSteps.every(s => s.status === 'completed')
    const anyDone = updatedSteps.some(s => s.status === 'completed')
    const status = allDone ? 'completed' : anyDone ? 'running' : 'pending'
    await plansApi.update(planId, { steps: updatedSteps, status })
    loadPlans()
  }

  const getProgress = (plan: PlanRecord) => {
    if (plan.steps.length === 0) return 0
    return Math.round(plan.steps.filter(s => s.status === 'completed').length / plan.steps.length * 100)
  }

  const filtered = plans.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('plans.title', '计划管理')}</h2>
          <p className="text-muted-foreground">{t('plans.description', '管理和执行任务计划')} · 数据存储于 userData/data/plans/</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('plans.create', '新建计划')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlan ? t('plans.edit', '编辑计划') : t('plans.create', '新建计划')}</DialogTitle>
              <DialogDescription>
                {editingPlan ? t('plans.editDesc', '编辑计划配置') : t('plans.createDesc', '创建一个新的计划，每行一个步骤')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('plans.titleLabel', '标题')}</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('plans.titlePlaceholder', '输入计划标题')} />
              </div>
              <div>
                <Label>{t('plans.descriptionLabel', '描述')}</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('plans.descriptionPlaceholder', '输入计划描述')} />
              </div>
              {!editingPlan && (
                <div>
                  <Label>{t('plans.stepsLabel', '步骤（每行一个）')}</Label>
                  <Textarea value={stepsText} onChange={e => setStepsText(e.target.value)} rows={5} placeholder={t('plans.stepsPlaceholder', '每行输入一个步骤')} />
                </div>
              )}
              <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索计划..." className="max-w-xs" />
        {['all', 'pending', 'running', 'completed', 'failed'].map(status => (
          <Button key={status} size="sm" variant={filterStatus === status ? 'default' : 'outline'} onClick={() => setFilterStatus(status)}>
            {status === 'all' ? '全部' : STATUS_MAP[status]?.label || status}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('plans.empty', '暂无计划')}</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(plan => {
            const progress = getProgress(plan)
            return (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-lg">{plan.title}</CardTitle>
                      <Badge variant={STATUS_MAP[plan.status]?.variant || 'secondary'}>{STATUS_MAP[plan.status]?.label || plan.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(plan.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  {plan.steps.length > 0 && (
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    {plan.steps.map((step, i) => (
                      <div
                        key={step.id}
                        className={cn(
                          "flex items-center gap-2 text-sm cursor-pointer group",
                          step.status === 'completed' && 'text-muted-foreground'
                        )}
                        onClick={() => handleStepToggle(plan.id, step.id)}
                      >
                        {step.status === 'completed'
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <Circle className="h-4 w-4 group-hover:text-primary" />}
                        <span className={cn(step.status === 'completed' && 'line-through')}>{i + 1}. {step.description}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>{t('common.edit', '编辑')}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleExecute(plan.id)} disabled={plan.status === 'running'}>
                      <Play className="h-3 w-3 mr-1" />{t('plans.execute', '执行')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(plan.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PlanManagement
