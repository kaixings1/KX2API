import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { BackButton } from '@/components/ui/back-button'
import { Trash2, Loader2, Play } from 'lucide-react'

const agentsApi = window.electronAPI.agents

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  idle: { label: '空闲', variant: 'secondary' },
  running: { label: '运行中', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
}

interface AgentDetail {
  id: string
  name: string
  role: string
  systemPrompt: string
  model: string
  status: string
  createdAt: number
  updatedAt: number
}

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [editModel, setEditModel] = useState('')
  const [executeInput, setExecuteInput] = useState('')
  const [executeOpen, setExecuteOpen] = useState(false)

  const loadAgent = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await agentsApi.getById(id)
      if (res.success && res.data) {
        setAgent(res.data as AgentDetail)
        setEditName(res.agent.name)
        setEditRole(res.agent.role)
        setEditPrompt(res.agent.systemPrompt || '')
        setEditModel(res.agent.model || '')
      }
    } catch (e) {
      console.error('[AgentDetail] Failed to load:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadAgent() }, [loadAgent])

  const handleSave = async () => {
    if (!id) return
    await agentsApi.update(id, { name: editName, role: editRole, systemPrompt: editPrompt, model: editModel })
    setEditOpen(false)
    loadAgent()
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('确定删除此 Agent?')) return
    await agentsApi.delete(id)
    navigate('/agents')
  }

  const handleExecute = async () => {
    if (!id) return
    await agentsApi.execute(id, executeInput || '请执行任务')
    setExecuteOpen(false)
    setExecuteInput('')
    loadAgent()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="space-y-4">
        <BackButton to="/agents" label="返�列表" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Agent 不存在或已被删除
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Agent 管理', href: '/agents' },
        { label: agent.name },
      ]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/agents" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{agent.name}</h2>
            <p className="text-muted-foreground text-sm">ID: {agent.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>编辑</Button>
          <Button variant="outline" size="sm" onClick={() => setExecuteOpen(true)}>
            <Play className="h-3 w-3 mr-1" /> 执行
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">名称</span>
              <span>{agent.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">角色</span>
              <Badge variant="outline">{agent.role}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">状态</span>
              <Badge variant={STATUS_MAP[agent.status]?.variant || 'secondary'}>
                {STATUS_MAP[agent.status]?.label || agent.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">模型</span>
              <span>{agent.model || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">时间信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">创建时间</span>
              <span>{new Date(agent.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">更新时间</span>
              <span>{new Date(agent.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">系统提示词 (System Prompt)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded">
            {agent.systemPrompt || '(空)'}
          </p>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 Agent</DialogTitle>
            <DialogDescription>修改 Agent 配置</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>角色</Label>
              <Input value={editRole} onChange={e => setEditRole(e.target.value)} />
            </div>
            <div>
              <Label>模型</Label>
              <Input value={editModel} onChange={e => setEditModel(e.target.value)} />
            </div>
            <div>
              <Label>系统提示词</Label>
              <Textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={6} />
            </div>
            <Button onClick={handleSave} className="w-full">保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execute Dialog */}
      <Dialog open={executeOpen} onOpenChange={setExecuteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>执行 Agent</DialogTitle>
            <DialogDescription>向 {agent.name} 发送指令</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>指令</Label>
              <Textarea value={executeInput} onChange={e => setExecuteInput(e.target.value)} rows={4} placeholder="输入执行指令..." />
            </div>
            <Button onClick={handleExecute} className="w-full">执行</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AgentDetailPage
