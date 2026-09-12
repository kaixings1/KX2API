import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Play, Loader2, Search, Filter } from 'lucide-react'

const agentsApi = window.electronAPI.agents

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  idle: { label: '空闲', variant: 'secondary' },
  running: { label: '运行中', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
}

export function AgentManagement() {
  const { t } = useTranslation()
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('agents.title', 'Agent 管理')}</h2>
          <p className="text-muted-foreground">{t('agents.description', '创建和管理 AI Agent')} · 数据存储于 userData/data/agents/</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('agents.create', '新建 Agent')}</Button>
          </DialogTrigger>
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
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索 Agent..." className="pl-8" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : agents.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('agents.empty', '暂无 Agent')}</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">没有匹配的 Agent</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(agent => (
            <Card key={agent.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  <span>{agent.name}</span>
                  <Badge variant={STATUS_MAP[agent.status]?.variant}>{STATUS_MAP[agent.status]?.label}</Badge>
                  <Badge variant="outline">{agent.role}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <p className="text-sm text-muted-foreground line-clamp-2">{agent.systemPrompt}</p>
                {agent.model && <p className="text-xs text-muted-foreground mt-1">Model: {agent.model}</p>}
                <div className="flex gap-1 mt-3">
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
