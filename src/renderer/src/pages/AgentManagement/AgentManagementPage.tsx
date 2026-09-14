import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Play, Loader2, ArrowRight, Info } from 'lucide-react'
import { ManagementToolbar } from '@/components/management'
import { ImportExportDialog } from '@/components/management/ImportExportDialog'

const agentsApi = window.electronAPI.agents

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  idle: { label: '空闲', variant: 'secondary' },
  running: { label: '运行中', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
}

export function AgentManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [agents, setAgents] = useState<AgentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentRecord | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [executeInput, setExecuteInput] = useState('')
  const [executeId, setExecuteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await agentsApi.getAll()
      setAgents(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error('[AgentManagement] Failed to load agents:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAgents() }, [loadAgents])

  const openCreate = () => {
    setEditingAgent(null)
    setName('')
    setRole('')
    setSystemPrompt('')
    setModel('')
    setDialogOpen(true)
  }

  const openEdit = (agent: AgentRecord) => {
    setEditingAgent(agent)
    setName(agent.name)
    setRole(agent.role)
    setSystemPrompt(agent.systemPrompt)
    setModel(agent.model || '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (editingAgent) {
      await agentsApi.update(editingAgent.id, { name, role, systemPrompt, model: model || '' })
    } else {
      await agentsApi.create({ name, role, systemPrompt, model: model || '', status: 'idle' })
    }
    setDialogOpen(false)
    loadAgents()
  }

  const handleDelete = async (id: string) => {
    await agentsApi.delete(id)
    loadAgents()
  }

  const handleExecute = async (id: string) => {
    await agentsApi.execute(id, executeInput || '请执行任务')
    setExecuteId(null)
    loadAgents()
  }

  const filtered = agents.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.role.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  // ==================== Import/Export ====================

  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export' | 'backup' | 'restore'>('export')

  const handleExport = async () => {
    try {
      const res = await window.electronAPI.mgmt.export('agents', filtered)
      if (res.success) {
        const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `agents_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  const handleImport = async (jsonData: string) => {
    try {
      const res = await window.electronAPI.mgmt.import('agents', jsonData)
      if (res.success && res.data) {
        for (const item of res.data) {
          if (item?.id) {
            await agentsApi.create({ name: item.name, role: item.role, systemPrompt: item.systemPrompt, model: item.model || '', status: 'idle' })
          }
        }
        loadAgents()
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
      if (res.success) {
        const blob = new Blob([JSON.stringify({ agents: filtered }, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `agents_backup_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Backup failed:', e)
    }
  }

  const handleRestore = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return { success: false, error: '数据格式错误' }
      for (const item of data) {
        if (item?.id) {
          await agentsApi.create({ name: item.name, role: item.role, systemPrompt: item.systemPrompt, model: item.model || '', status: 'idle' })
        }
      }
      loadAgents()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      <ManagementToolbar
        title={t('agents.title', 'Agent 管理')}
        subtitle={t('agents.description', '创建和管理 AI Agent') + ' · 数据存储于 userData/data/agents/'}
        createLabel={<><Plus className="h-4 w-4 mr-1" />{t('agents.create', '新建 Agent')}</>}
        onCreate={openCreate}
        onRefresh={loadAgents}
        onExport={() => { setIoMode('export'); setIoOpen(true) }}
        onImport={() => { setIoMode('import'); setIoOpen(true) }}
        onBackup={() => { setIoMode('backup'); setIoOpen(true) }}
        onRestore={() => { setIoMode('restore'); setIoOpen(true) }}
        filters={{ search, status: filterStatus }}
        onFiltersChange={(f) => { setSearch(f.search || ''); setFilterStatus(f.status || 'all') }}
        filterOptions={[
          { key: 'status', label: '状态', options: [
            { value: 'all', label: '全部状态' },
            ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label })),
          ]},
        ]}
        totalCount={agents.length}
        filteredCount={filtered.length}
        isLoading={loading}
      />

      <ImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        mode={ioMode}
        title="Agent 管理"
        description={ioMode === 'export' ? '导出 Agent 配置为 JSON 文件' : ioMode === 'import' ? '导入 Agent 配置' : ioMode === 'backup' ? '备份所有 Agent 数据' : '从备份恢复 Agent 数据'}
        data={filtered}
        onExport={handleExport}
        onImport={handleImport}
        onBackup={handleBackup}
        onRestore={handleRestore}
      />

      {/* Help Card */}
      <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)]">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-[var(--text-dim)] leading-relaxed flex items-start gap-2">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
            {t('agents.pageHelp', '创建和管理 AI Agent。点击卡片进入详情页查看系统提示词、执行 Agent 或编辑配置。')}
          </p>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAgent ? t('agents.edit', '编辑 Agent') : t('agents.create', '新建 Agent')}</DialogTitle>
            <DialogDescription>
              {editingAgent ? t('agents.editDesc', '编辑 Agent 配置') : t('agents.createDesc', '创建一个新的 AI Agent')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('agents.nameLabel', '名称')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t('agents.roleLabel', '角色')}</Label>
              <Input value={role} onChange={e => setRole(e.target.value)} />
            </div>
            <div>
              <Label>{t('agents.systemPromptLabel', '系统提示词')}</Label>
              <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4} />
            </div>
            <div>
              <Label>{t('agents.modelLabel', '模型')}</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} placeholder={t('agents.modelPlaceholder', '留空使用默认')} />
            </div>
            <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : agents.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('agents.empty', '暂无 Agent')}</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('agents.noMatch', '没有匹配的 Agent')}</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(agent => (
            <Card key={agent.id} className="cursor-pointer hover:border-[var(--accent-primary)] transition-colors" onClick={() => navigate(`/agents/${agent.id}`)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    <span>{agent.name}</span>
                    <Badge variant={STATUS_MAP[agent.status]?.variant}>{STATUS_MAP[agent.status]?.label}</Badge>
                    <Badge variant="outline">{agent.role}</Badge>
                  </CardTitle>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-3">{agent.systemPrompt}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {agent.model && <span>Model: {agent.model}</span>}
                  <span>ID: {agent.id}</span>
                  <span>创建: {new Date(agent.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => setExecuteId(executeId === agent.id ? null : agent.id)} disabled={executeId === agent.id}>
                    <Play className="h-3 w-3 mr-1" />{t('agents.execute', '执行')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(agent)}>{t('common.edit', '编辑')}</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(agent.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                {executeId === agent.id && (
                  <div className="mt-3">
                    <Input value={executeInput} onChange={e => setExecuteInput(e.target.value)} placeholder={t('agents.executeInput', '输入执行指令...')} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentManagement
