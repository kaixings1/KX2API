import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { BackButton } from '@/components/ui/back-button'
import { Trash2, Play, Loader2, XCircle } from 'lucide-react'

const workflowsApi = window.electronAPI.workflows

interface WorkflowStep {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
}

interface WorkflowDetail {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  enabled: boolean
  status: string
  createdAt: number
  updatedAt: number
}

export function WorkflowDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStepsText, setEditStepsText] = useState('')
  const [execResult, setExecResult] = useState<{ success: boolean; stepResults: any[]; totalDurationMs: number } | null>(null)
  const [wfExecuting, setWfExecuting] = useState(false)
  const [wfStepStatuses, setWfStepStatuses] = useState<Record<string, { status: string; output: string }>>({})
  const [wfExecError, setWfExecError] = useState<string | null>(null)

  const loadWorkflow = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await workflowsApi.getById(id)
      if (res.success && res.workflow) {
        const wf = res.workflow as WorkflowDetail
        setWorkflow(wf)
        setEditName(wf.name)
        setEditDescription(wf.description)
        setEditStepsText(wf.steps.map(s => `${s.type}:${JSON.stringify(s.config)}`).join('\n'))
      }
    } catch (e) {
      console.error('[WorkflowDetail] Failed to load:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadWorkflow() }, [loadWorkflow])

  const handleSave = async () => {
    if (!id) return
    const steps = editStepsText.split('\n').filter(Boolean).map((line, i) => {
      const [type, configStr] = line.split(':')
      let config: Record<string, unknown> = {}
      try { config = JSON.parse(configStr || '{}') } catch {}
      return { id: workflow?.steps[i]?.id || `step_${i}`, name: `Step ${i + 1}`, type: type.trim(), config }
    })
    await workflowsApi.update(id, { name: editName, description: editDescription, steps })
    setEditOpen(false)
    loadWorkflow()
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm(t('workflows.confirmDelete', '确定删除此工作流?'))) return
    await workflowsApi.delete(id)
    navigate('/workflows')
  }

  const handleExecute = async () => {
    if (!id) return
    setWfExecuting(true)
    setWfStepStatuses({})
    setWfExecError(null)
    setExecResult(null)
    const unsubStep = workflowsApi.onStepChange((e) => {
      if (e.stepId.startsWith(id + '_') || workflow?.steps.some(s => s.id === e.stepId)) {
        setWfStepStatuses((prev) => ({ ...prev, [e.stepId]: { status: e.status, output: e.output } }))
      }
    })
    const unsubDone = workflowsApi.onDone((e) => {
      if (e.success && e.result) {
        setExecResult(e.result)
      }
      setWfExecuting(false)
      if (unsubStep) unsubStep()
      if (unsubDone) unsubDone()
      if (unsubErrorSub) unsubErrorSub()
    })
    let unsubErrorSub: (() => void) | null = null
    unsubErrorSub = workflowsApi.onError((e) => {
      setWfExecError(e.error)
      setWfExecuting(false)
      if (unsubStep) unsubStep()
      if (unsubDone) unsubDone()
      if (unsubErrorSub) unsubErrorSub()
    })
    const res = await workflowsApi.execute(id, {})
    if (!res.success) {
      setWfExecError(res.error || '执行失败')
      setWfExecuting(false)
      if (unsubStep) unsubStep()
      if (unsubDone) unsubDone()
      if (unsubErrorSub) unsubErrorSub()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="space-y-4">
        <BackButton to="/workflows" label="返回列表" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            工作流不存在或已被删除
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: t('workflows.title', '工作流管理'), href: '/workflows' },
        { label: workflow.name },
      ]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/workflows" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{workflow.name}</h2>
            <p className="text-muted-foreground text-sm">{t('workflows.idLabel', 'ID')}: {workflow.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>{t('common.edit', '编辑')}</Button>
          <Button variant="outline" size="sm" onClick={handleExecute}>
            <Play className="h-3 w-3 mr-1" /> {t('common.execute', '执行')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('workflows.basicInfo', '基本信息')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('workflows.nameLabel', '名称')}</span>
              <span>{workflow.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('workflows.statusLabel', '状态')}</span>
              <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
                {workflow.enabled ? t('common.enabled', '启用') : t('common.disabled', '禁用')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('workflows.stepsCount', '步骤数')}</span>
              <span>{workflow.steps.length} {t('workflows.countSuffix', '个')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('workflows.timeInfo', '时间信息')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('workflows.createdAt', '创建时间')}</span>
              <span>{new Date(workflow.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('workflows.updatedAt', '更新时间')}</span>
              <span>{new Date(workflow.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('workflows.descriptionLabel', '描述')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{workflow.description || t('workflows.noDescription', '(无描述)')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('workflows.executionSteps', '执行步骤')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {workflow.steps.map((step, i) => {
              const live = wfStepStatuses[step.id]
              const isRunning = wfExecuting && !live && i === Math.min(
                Object.keys(wfStepStatuses).filter(k => workflow.steps.some(s => s.id === k)).length,
                workflow.steps.length - 1
              )
              return (
                <div key={step.id} className={`flex items-center gap-3 text-sm p-2 rounded bg-muted/30 ${live ? 'border border-primary/30' : ''} ${isRunning ? 'border border-primary/30 animate-pulse' : ''}`}>
                  <Badge variant={live ? 'default' : isRunning ? 'secondary' : 'outline'} className="text-[10px]">
                    {i + 1}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{step.type}</Badge>
                  <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
                    {JSON.stringify(step.config)}
                  </span>
                  {live && (
                    <span className="text-[10px] text-primary whitespace-nowrap">{live.status}</span>
                  )}
                  {isRunning && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {wfExecError && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive text-sm">执行失败</p>
              <p className="text-sm text-muted-foreground mt-1">{wfExecError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {execResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('workflows.execResultTitle', '执行结果')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              {t('workflows.execSummary', '耗时')} {execResult.totalDurationMs}ms | {execResult.stepResults.length} {t('workflows.stepsCount', '个步骤')}
            </p>
            <div className="space-y-1">
              {execResult.stepResults.map((r: any, i: number) => (
                <div key={i} className={`p-2 rounded text-xs ${r.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  Step {i + 1}: {r.success ? t('common.success', '成功') : t('common.failed', '失败')} {r.error ? `- ${r.error}` : ''}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workflows.editTitle', '编辑工作流')}</DialogTitle>
            <DialogDescription>{t('workflows.editDesc', '修改工作流配置')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('workflows.nameLabel', '名称')}</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>{t('workflows.descriptionLabel', '描述')}</Label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} />
            </div>
            <div>
              <Label>{t('workflows.stepsLabel', '步骤（格式: 类型:JSON配置，每行一个）')}</Label>
              <Textarea value={editStepsText} onChange={e => setEditStepsText(e.target.value)} rows={8} placeholder="llm:{&quot;prompt&quot;:&quot;...&quot;}" />
            </div>
            <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WorkflowDetailPage
