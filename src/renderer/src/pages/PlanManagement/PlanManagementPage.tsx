import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SectionCard } from '@/components/ui/section-card'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Play, Loader2, Calendar, GripVertical, CheckCircle2, Circle, Info } from 'lucide-react'
import { ManagementToolbar } from '@/components/management'
import { ImportExportDialog } from '@/components/management/ImportExportDialog'

const plansApi = window.electronAPI.plans

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: '○ 待执行', variant: 'secondary' },
  running: { label: '● 执行中', variant: 'default' },
  completed: { label: '○ 已完成', variant: 'outline' },
  failed: { label: '✗ 失败', variant: 'destructive' },
}

export function PlanManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // ==================== Import/Export ====================

  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export' | 'backup' | 'restore'>('export')

  const handleExport = async () => {
    try {
      const res = await window.electronAPI.mgmt.export('plans', filtered)
      if (!res.success) {
        return ''
      }
      // 返回 JSON 字符串供 ImportExportDialog 统一下载
    } catch (e) {
      console.error('Export failed:', e)
      return ''
    }
    return JSON.stringify(filtered, null, 2)
  }

  const handleImport = async (jsonData: string) => {
    try {
      const res = await window.electronAPI.mgmt.import('plans', jsonData)
      if (res.success && res.data) {
        for (const item of res.data) {
          if (item?.title) {
            const steps = (item.steps || []).map((s: any, i: number) => ({ id: `step_${Date.now()}_${i}`, description: s.description || '', status: 'pending' }))
            await plansApi.create({ title: item.title, description: item.description || '', steps })
          }
        }
        loadPlans()
        return { success: true }
      }
      return { success: false, error: res.error }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  const handleBackup = async () => {
    try {
      const res = await window.electronAPI.mgmt.backup()
      if (!res.success) return { success: false, error: res.error }
      const blob = new Blob([JSON.stringify({ plans: filtered }, null, 2)], { type: 'application/json' })
      const file = new File([blob], `plans_backup_${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
      return { success: true, file }
    } catch (e) {
      console.error('Backup failed:', e)
      return { success: false, error: (e as Error).message }
    }
  }

  const handleRestore = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return { success: false, error: '数据格式错误' }
      for (const item of data) {
        if (item?.title) {
          const steps = (item.steps || []).map((s: any, i: number) => ({ id: `step_${Date.now()}_${i}`, description: s.description || '', status: 'pending' }))
          await plansApi.create({ title: item.title, description: item.description || '', steps })
        }
      }
      loadPlans()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // ==================== Load ====================

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
    navigate('/plans/' + id)
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
      <ManagementToolbar
        title={t('plans.title', '计划管理')}
        subtitle={t('plans.description', '管理和执行任务计划')}
        createLabel={<><Plus className="h-4 w-4 mr-1" />{t('plans.create', '新建计划')}</>}
        onCreate={openCreate}
        onRefresh={loadPlans}
        onExport={() => { setIoMode('export'); setIoOpen(true) }}
        onImport={() => { setIoMode('import'); setIoOpen(true) }}
        onBackup={() => { setIoMode('backup'); setIoOpen(true) }}
        onRestore={() => { setIoMode('restore'); setIoOpen(true) }}
        filters={{ search, status: filterStatus }}
        onFiltersChange={(f) => { setSearch(f.search || ''); setFilterStatus(f.status || 'all') }}
        filterOptions={[
          { key: 'status', label: '状态', options: [
            { value: 'all', label: '全部' },
            { value: 'pending', label: '待执行' },
            { value: 'running', label: '执行中' },
            { value: 'completed', label: '已完成' },
            { value: 'failed', label: '失败' },
          ]},
        ]}
        totalCount={plans.length}
        filteredCount={filtered.length}
        isLoading={loading}
      />

      <ImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        mode={ioMode}
        title="计划管理"
        description={ioMode === 'export' ? '导出计划配置为 JSON 文件' : ioMode === 'import' ? '导入计划配置' : ioMode === 'backup' ? '备份所有计划数据' : '从备份恢复计划数据'}
        data={filtered}
        onExport={handleExport}
        onImport={handleImport}
        onBackup={handleBackup}
        onRestore={handleRestore}
      />

      <SectionCard title={t('plans.pageHelpTitle', '关于计划')} icon={Info}>
        <p className="text-xs text-[var(--text-dim)] leading-relaxed">
          {t('plans.pageHelp', '创建计划并逐步骤执行。点击步骤可切换完成状态，全部完成后计划将标记为已完成。')}
        </p>
      </SectionCard>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? t('plans.edit', '编辑计划') : t('plans.create', '新建计划')}</DialogTitle>
            <DialogDescription>
              {editingPlan ? t('plans.editDesc', '编辑计划配置') : t('plans.createDesc', '创建一个新的计划，每行一个步骤')}
            </DialogDescription>
          </DialogHeader>
          <SectionCard contentClassName="space-y-4">
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
          </SectionCard>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <p className="py-6 text-center text-xs text-[var(--text-muted)]">{t('plans.empty', '暂无计划')}</p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {filtered.map(plan => {
            const progress = getProgress(plan)
            return (
              <div key={plan.id} className="group rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-primary/30 transition-colors">
                <div className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium">{plan.title}</h3>
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
                </div>
                <div className="px-4 pb-4 space-y-2">
                  {plan.steps.map((step, i) => (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-center gap-2 text-sm cursor-pointer group/step",
                        step.status === 'completed' && 'text-muted-foreground'
                      )}
                      onClick={() => handleStepToggle(plan.id, step.id)}
                    >
                      {step.status === 'completed'
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <Circle className="h-4 w-4 group-hover/step:text-primary" />}
                      <span className={cn(step.status === 'completed' && 'line-through')}>{i + 1}. {step.description}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>{t('common.edit', '编辑')}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleExecute(plan.id)} disabled={plan.status === 'running'}>
                      <Play className="h-3 w-3 mr-1" />{t('plans.execute', '执行')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(plan.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PlanManagement
