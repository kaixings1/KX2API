import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Info, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ManagementToolbar } from '@/components/management'
import { ImportExportDialog } from '@/components/management/ImportExportDialog'
import { SectionCard } from '@/components/ui/section-card'
import { useAgents } from '@/hooks/useAgents'
import { useAgentExecution } from '@/hooks/useAgentExecution'
import { AgentCard } from '@/components/AgentCard/AgentCard'
// 不要 import `main/agents/types` 的 AgentRecord：渲染进程另有一份全局声明
// （electron.d.ts），而 useAgents 返回的是后者。
// 两套同名类型并存会让「hook 返回的值」赋不进「页面声明的类型」（TS2345）。

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  idle: { label: '空闲', variant: 'secondary' },
  running: { label: '运行中', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
}

export function AgentManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { agents, loading, load, create, update, remove } = useAgents()
  const { executingId, outputs, execute, abort } = useAgentExecution()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentRecord | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [executeInput, setExecuteInput] = useState('')
  const [showExecuteId, setShowExecuteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Import/Export
  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export' | 'backup' | 'restore'>('export')

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
      await update(editingAgent.id, { name, role, systemPrompt, model: model || '' })
    } else {
      await create({ name, role, systemPrompt, model: model || '', status: 'idle' })
    }
    setDialogOpen(false)
  }

  const handleDelete = async (id: string) => {
    await remove(id)
  }

  const handleExecute = async (id: string) => {
    const agent = agents.find(a => a.id === id)
    if (!agent) return
    await execute(agent, executeInput || '请执行任务')
  }

  const handleAbort = async (id: string) => {
    await abort(id)
  }

  const toggleExecute = (id: string) => {
    setShowExecuteId(showExecuteId === id ? null : id)
    setExecuteInput('')
  }

  const filtered = agents.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.role.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  const handleExport = async () => {
    try {
      const res = await window.electronAPI.mgmt.export('agents', filtered)
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
      const res = await window.electronAPI.mgmt.import('agents', jsonData)
      if (res.success && res.data) {
        for (const item of res.data) {
          if (item?.id) {
            await create({ name: item.name, role: item.role, systemPrompt: item.systemPrompt, model: item.model || '', status: 'idle' })
          }
        }
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
      const blob = new Blob([JSON.stringify({ agents: filtered }, null, 2)], { type: 'application/json' })
      const file = new File([blob], `agents_backup_${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
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
      const items = Array.isArray(data) ? data : (data.agents || [])
      if (!Array.isArray(items)) return { success: false, error: '数据格式错误' }
      for (const item of items) {
        if (item?.id) {
          await create({ name: item.name, role: item.role, systemPrompt: item.systemPrompt, model: item.model || '', status: 'idle' })
        }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // ==================== Render ====================

  return (
    <div className="space-y-4">
      <ManagementToolbar
        title={t('agents.title', 'Agent 管理')}
        subtitle={t('agents.description', '创建和管理 AI Agent') + ' · 数据存储于 userData/data/agents/'}
        createLabel={<><Plus className="h-4 w-4 mr-1" />{t('agents.create', '新建 Agent')}</>}
        onCreate={openCreate}
        onRefresh={load}
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

      <SectionCard
        title={t('agents.pageHelpTitle', '关于 Agent')}
        icon={Info}
      >
        <p className="text-xs text-[var(--text-dim)] leading-relaxed">
          {t('agents.pageHelp', '创建和管理 AI Agent。点击卡片进入详情页查看系统提示词、执行 Agent 或编辑配置。')}
        </p>
      </SectionCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAgent ? t('agents.edit', '编辑 Agent') : t('agents.create', '新建 Agent')}</DialogTitle>
            <DialogDescription>
              {editingAgent ? t('agents.editDesc', '编辑 Agent 配置') : t('agents.createDesc', '创建一个新的 AI Agent')}
            </DialogDescription>
          </DialogHeader>
          <SectionCard>
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
          </SectionCard>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <SectionCard>
          <p className="py-8 text-center text-muted-foreground">{t('agents.empty', '暂无 Agent')}</p>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <p className="py-8 text-center text-muted-foreground">{t('agents.noMatch', '没有匹配的 Agent')}</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4">
          {filtered.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isExecuting={executingId === agent.id}
              output={outputs[agent.id] || ''}
              executeInput={executeInput}
              showExecute={showExecuteId === agent.id}
              onExecute={handleExecute}
              onAbort={handleAbort}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggleExecute={toggleExecute}
              onExecuteInputChange={setExecuteInput}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentManagement
