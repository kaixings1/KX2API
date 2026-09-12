import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Play, Loader2 } from 'lucide-react'

const workflowsApi = window.electronAPI.workflows

export function WorkflowManagement() {
  const { t } = useTranslation()
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWf, setEditingWf] = useState<WorkflowRecord | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [execResult, setExecResult] = useState<WorkflowExecuteResult | null>(null)

  const loadWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await workflowsApi.getAll()
      setWorkflows(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error('[WorkflowManagement] Failed to load workflows:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadWorkflows() }, [loadWorkflows])

  const openCreate = () => {
    setEditingWf(null)
    setName('')
    setDescription('')
    setStepsText('')
    setExecResult(null)
    setDialogOpen(true)
  }

  const openEdit = (wf: WorkflowRecord) => {
    setEditingWf(wf)
    setName(wf.name)
    setDescription(wf.description)
    setStepsText(wf.steps.map(s => `${s.type}:${JSON.stringify(s.config)}`).join('\n'))
    setExecResult(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const steps = stepsText.split('\n').filter(Boolean).map((line, i) => {
      const [type, configStr] = line.split(':')
      let config: Record<string, unknown> = {}
      try { config = JSON.parse(configStr || '{}') } catch {}
      return { id: `step_${i}`, name: `Step ${i + 1}`, type: type.trim(), config }
    })
    if (editingWf) {
      await workflowsApi.update(editingWf.id, { name, description, steps })
    } else {
      await workflowsApi.create({ name, description, steps, enabled: true })
    }
    setDialogOpen(false)
    loadWorkflows()
  }

  const handleDelete = async (id: string) => {
    await workflowsApi.delete(id)
    loadWorkflows()
  }

  const handleExecute = async (wf: WorkflowRecord) => {
    const res = await workflowsApi.execute(wf.id)
    if (res.success && res.result) {
      setExecResult(res.result)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('workflows.title', '工作流管理')}</h2>
          <p className="text-muted-foreground">{t('workflows.description', '创建和管理自动化工作流')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('workflows.create', '新建工作流')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingWf ? t('workflows.edit', '编辑工作流') : t('workflows.create', '新建工作流')}</DialogTitle>
              <DialogDescription>
                {editingWf ? t('workflows.editDesc', '编辑工作流配置') : t('workflows.createDesc', '创建一个新的自动化工作流')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('workflows.nameLabel', '名称')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>{t('workflows.descriptionLabel', '描述')}</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>{t('workflows.stepsLabel', '步骤（格式: 类型:JSON配置）')}</Label>
                <Textarea value={stepsText} onChange={e => setStepsText(e.target.value)} rows={6} placeholder="llm:{&quot;prompt&quot;:&quot;...&quot;}\ncode:{&quot;language&quot;:&quot;python&quot;}" />
              </div>
              <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : workflows.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('workflows.empty', '暂无工作流')}</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map(wf => (
            <Card key={wf.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{wf.name}</span>
                      <Badge variant={wf.enabled ? 'default' : 'secondary'}>{wf.enabled ? t('workflows.enabled', '启用') : t('workflows.disabled', '禁用')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{wf.description}</p>
                    <p className="text-xs text-muted-foreground">{wf.steps.length} {t('workflows.stepsCount', '个步骤')}</p>
                    {execResult && (
                      <div className={`mt-2 p-2 rounded text-sm ${execResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        <p className="text-xs">{t('workflows.execResult', '执行结果')}: {execResult.totalDurationMs}ms | {execResult.stepResults.length} steps</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleExecute(wf)}><Play className="h-3 w-3 mr-1" />{t('workflows.execute', '执行')}</Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(wf)}>{t('common.edit', '编辑')}</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(wf.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default WorkflowManagement
