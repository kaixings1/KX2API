import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Play, Loader2, ListOrdered, ArrowRight } from 'lucide-react'
import { ManagementToolbar } from '@/components/management'
import { ImportExportDialog } from '@/components/management/ImportExportDialog'

const workflowsApi = window.electronAPI.workflows

export function WorkflowManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWf, setEditingWf] = useState<WorkflowRecord | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [execResult, setExecResult] = useState<WorkflowExecuteResult | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

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

  // ==================== Import/Export ====================

  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export' | 'backup' | 'restore'>('export')

  const handleExport = async () => {
    try {
      const res = await window.electronAPI.mgmt.export('workflows', filtered)
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
      const res = await window.electronAPI.mgmt.import('workflows', jsonData)
      if (res.success && res.data) {
        for (const item of res.data) {
          if (item?.name) {
            const steps = (item.steps || []).map((s: any, i: number) => ({ id: `step_${i}`, name: `Step ${i + 1}`, type: s.type || 'command', config: s.config || {} }))
            await workflowsApi.create({ name: item.name, description: item.description || '', steps, enabled: true })
          }
        }
        loadWorkflows()
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
      const blob = new Blob([JSON.stringify({ workflows: filtered }, null, 2)], { type: 'application/json' })
      const file = new File([blob], `workflows_backup_${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
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
        if (item?.name) {
          const steps = (item.steps || []).map((s: any, i: number) => ({ id: `step_${i}`, name: `Step ${i + 1}`, type: s.type || 'command', config: s.config || {} }))
          await workflowsApi.create({ name: item.name, description: item.description || '', steps, enabled: true })
        }
      }
      loadWorkflows()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  const filtered = workflows.filter(wf => {
    const matchSearch = !search || wf.name.toLowerCase().includes(search.toLowerCase()) || wf.description.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || (filterStatus === 'enabled' ? wf.enabled : !wf.enabled)
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <ManagementToolbar
        title={t('workflows.title', '工作流管理')}
        subtitle={t('workflows.description', '创建和管理自动化工作流')}
        createLabel={<><Plus className="h-4 w-4 mr-1" />{t('workflows.create', '新建工作流')}</>}
        onCreate={openCreate}
        onRefresh={loadWorkflows}
        onExport={() => { setIoMode('export'); setIoOpen(true) }}
        onImport={() => { setIoMode('import'); setIoOpen(true) }}
        onBackup={() => { setIoMode('backup'); setIoOpen(true) }}
        onRestore={() => { setIoMode('restore'); setIoOpen(true) }}
        filters={{ search, status: filterStatus }}
        onFiltersChange={(f) => { setSearch(f.search || ''); setFilterStatus(f.status || 'all') }}
        filterOptions={[
          { key: 'status', label: '状态', options: [
            { value: 'all', label: '全部' },
            { value: 'enabled', label: '启用' },
            { value: 'disabled', label: '禁用' },
          ]},
        ]}
        totalCount={workflows.length}
        filteredCount={filtered.length}
        isLoading={loading}
      />

      <ImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        mode={ioMode}
        title="工作流管理"
        description={ioMode === 'export' ? '导出工作流配置为 JSON 文件' : ioMode === 'import' ? '导入工作流配置' : ioMode === 'backup' ? '备份所有工作流数据' : '从备份恢复工作流数据'}
        data={filtered}
        onExport={handleExport}
        onImport={handleImport}
        onBackup={handleBackup}
        onRestore={handleRestore}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {search || filterStatus !== 'all'
              ? t('workflows.noMatch', '没有匹配的工作流')
              : t('workflows.empty', '暂无工作流，点击上方按钮创建')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(wf => (
            <Card key={wf.id} className="cursor-pointer hover:border-[var(--accent-primary)] transition-colors" onClick={() => navigate(`/workflows/${wf.id}`)}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{wf.name}</span>
                      <Badge variant={wf.enabled ? 'default' : 'secondary'}>{wf.enabled ? t('workflows.enabled', '启用') : t('workflows.disabled', '禁用')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{wf.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ListOrdered className="h-3 w-3" /> {wf.steps.length} {t('workflows.stepsCount', '个步骤')}</span>
                      <span>创建: {new Date(wf.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {wf.steps.slice(0, 6).map((step, i) => (
                        <Badge key={step.id} variant="outline" className="text-[10px]">
                          {i + 1}. {step.type}
                        </Badge>
                      ))}
                      {wf.steps.length > 6 && (
                        <Badge variant="outline" className="text-[10px]">+{wf.steps.length - 6}</Badge>
                      )}
                    </div>
                    {execResult && (
                      <div className={`p-2 rounded text-sm ${execResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        <p className="text-xs">{t('workflows.execResult', '执行结果')}: {execResult.totalDurationMs}ms | {execResult.stepResults.length} steps | {execResult.success ? '成功' : '失败'}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => handleExecute(wf)} title={t('workflows.execute', '执行')}><Play className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(wf)} title={t('common.edit', '编辑')}><span className="text-xs">编辑</span></Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(wf.id)} title={t('common.delete', '删除')}><Trash2 className="h-3 w-3" /></Button>
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
