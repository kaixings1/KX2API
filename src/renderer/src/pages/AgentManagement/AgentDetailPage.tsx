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
import { Trash2, Play, Loader2, XCircle, CheckCircle2 } from 'lucide-react'

const agentsApi = window.electronAPI.agents

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  idle: { label: '空闲', variant: 'secondary' },
  running: { label: '运行中', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
}

// 直接用后端返回的 AgentRecord，不再本地重复定义。
//
// 原来的本地 AgentDetail 与 AgentRecord 字段几乎一致，但有细微差异
// （后端 `model` 可为 null、后端多一个 `lastActiveAt`），
// 两套定义并存会让「接口返回的对象」无法直接赋给「页面期望的类型」——
// 这正是之前那处 TS2345 的根因。
//
// 注意：AgentRecord.model 是 `string | null`，用到时需空值兜底。
type AgentDetail = AgentRecord

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [editModel, setEditModel] = useState('')
  const [executeInput, setExecuteInput] = useState('')
  const [executeOpen, setExecuteOpen] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [execOutput, setExecOutput] = useState<string[]>([])
  const [execError, setExecError] = useState<string | null>(null)

  const loadAgent = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await agentsApi.getById(id)
      if (res) {
        setAgent(res)
        setEditName(res.name)
        setEditRole(res.role)
        setEditPrompt(res.systemPrompt || '')
        setEditModel(res.model || '')
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
    if (!confirm(t('agents.confirmDelete', '确定删除此 Agent?'))) return
    await agentsApi.delete(id)
    navigate('/agents')
  }

  const handleExecute = async () => {
    if (!id) return
    setExecuting(true)
    setExecOutput([])
    setExecError(null)
    const unsubOutput = agentsApi.onOutput((e) => {
      if (e.agentId === id) {
        setExecOutput((prev) => [...prev, e.content])
      }
    })
    const unsubDone = agentsApi.onDone((e) => {
      if (e.agentId === id) {
        setExecuting(false)
        unsubOutput()
        unsubDone()
        unsubError()
        if (e.success) {
          setExecuteOpen(false)
          setExecuteInput('')
          loadAgent()
        } else if (e.error) {
          setExecError(e.error)
        }
      }
    })
    const unsubError = agentsApi.onError((e) => {
      if (e.agentId === id) {
        setExecError(e.error)
        setExecuting(false)
      }
    })
    await agentsApi.execute(id, executeInput || '请执行任务')
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
        { label: t('agents.title', 'Agent 管理'), href: '/agents' },
        { label: agent.name },
      ]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/agents" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{agent.name}</h2>
            <p className="text-muted-foreground text-sm">{t('agents.idLabel', 'ID')}: {agent.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>{t('common.edit', '编辑')}</Button>
          <Button variant="outline" size="sm" onClick={() => setExecuteOpen(true)}>
            <Play className="h-3 w-3 mr-1" /> {t('agents.execute', '执行')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('agents.basicInfo', '基本信息')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('agents.nameLabel', '名称')}</span>
              <span>{agent.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('agents.roleLabel', '角色')}</span>
              <Badge variant="outline">{agent.role}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('agents.statusLabel', '状态')}</span>
              <Badge variant={STATUS_MAP[agent.status]?.variant || 'secondary'}>
                {STATUS_MAP[agent.status]?.label || agent.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('agents.modelLabel', '模型')}</span>
              <span>{agent.model || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('agents.timeInfo', '时间信息')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('agents.createdAt', '创建时间')}</span>
              <span>{new Date(agent.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('agents.updatedAt', '更新时间')}</span>
              <span>{agent.updatedAt ? new Date(agent.updatedAt).toLocaleString() : '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('agents.systemPrompt', '系统提示词 (System Prompt)')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded">
            {agent.systemPrompt || t('agents.emptyPrompt', '(空)')}
          </p>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('agents.editTitle', '编辑 Agent')}</DialogTitle>
            <DialogDescription>{t('agents.editDesc', '修改 Agent 配置')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('agents.nameLabel', '名称')}</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>{t('agents.roleLabel', '角色')}</Label>
              <Input value={editRole} onChange={e => setEditRole(e.target.value)} />
            </div>
            <div>
              <Label>{t('agents.modelLabel', '模型')}</Label>
              <Input value={editModel} onChange={e => setEditModel(e.target.value)} />
            </div>
            <div>
              <Label>{t('agents.systemPromptLabel', '系统提示词')}</Label>
              <Textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={6} />
            </div>
            <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execute Dialog */}
      <Dialog open={executeOpen} onOpenChange={(open) => {
        setExecuteOpen(open)
        if (open) {
          setExecOutput([])
          setExecError(null)
          setExecuting(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('agents.executeTitle', '执行 Agent')}</DialogTitle>
            <DialogDescription>{t('agents.executeDesc', '向')} {agent.name} {t('agents.executeDescSuffix', '发送指令')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('agents.executeLabel', '指令')}</Label>
              <Textarea value={executeInput} onChange={e => setExecuteInput(e.target.value)} rows={4} placeholder={t('agents.executePlaceholder', '输入执行指令...')} disabled={executing} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExecute} className="flex-1" disabled={executing || !executeInput.trim()}>
                {executing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />执行中...</> : t('common.execute', '执行')}
              </Button>
              {executing && (
                <Button variant="outline" onClick={() => {
                  setExecuting(false)
                  setExecError(null)
                }}>取消</Button>
              )}
            </div>
            {execOutput.length > 0 && (
              <div className="space-y-1">
                <Label>实时输出</Label>
                <div className="max-h-48 overflow-auto rounded border bg-muted/50 p-2 text-xs whitespace-pre-wrap">
                  {execOutput.map((chunk, i) => (
                    <div key={i}>{chunk}</div>
                  ))}
                </div>
              </div>
            )}
            {execError && (
              <div className="flex items-start gap-2 rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{execError}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AgentDetailPage
