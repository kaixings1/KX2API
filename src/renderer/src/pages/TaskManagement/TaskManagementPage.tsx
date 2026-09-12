import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Play, CheckCircle2, Loader2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const tasksApi = window.electronAPI.tasks

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  todo: { label: '待办', variant: 'secondary' },
  in_progress: { label: '进行中', variant: 'default' },
  done: { label: '完成', variant: 'outline' },
  cancelled: { label: '取消', variant: 'destructive' },
}

const PRIORITY_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  low: { label: '低', variant: 'secondary' },
  medium: { label: '中', variant: 'outline' },
  high: { label: '高', variant: 'destructive' },
}

export function TaskManagement() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [tagsText, setTagsText] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [search, setSearch] = useState('')

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tasksApi.getAll()
      setTasks(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error('[TaskManagement] Failed to load tasks:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const openCreate = () => {
    setEditingTask(null)
    setTitle('')
    setDescription('')
    setPriority('medium')
    setTagsText('')
    setAssignee('')
    setDueDate('')
    setDialogOpen(true)
  }

  const openEdit = (task: TaskRecord) => {
    setEditingTask(task)
    setTitle(task.title)
    setDescription(task.description)
    setPriority(task.priority)
    setTagsText(task.tags.join(', '))
    setAssignee(task.assignee || '')
    setDueDate(task.dueAt ? new Date(task.dueAt).toISOString().split('T')[0] : '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean)
    const data: any = { title, description, priority, tags, assignee: assignee || null, dueAt: dueDate ? new Date(dueDate).getTime() : null }
    if (editingTask) {
      await tasksApi.update(editingTask.id, data)
    } else {
      await tasksApi.create({ ...data, status: 'todo' })
    }
    setDialogOpen(false)
    loadTasks()
  }

  const handleDelete = async (id: string) => {
    await tasksApi.delete(id)
    loadTasks()
  }

  const handleSetStatus = async (id: string, status: TaskRecord['status']) => {
    await tasksApi.setStatus(id, status)
    loadTasks()
  }

  const isOverdue = (task: TaskRecord) => {
    if (!task.dueAt || task.status === 'done' || task.status === 'cancelled') return false
    return Date.now() > task.dueAt
  }

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority
    return matchSearch && matchStatus && matchPriority
  })

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(isOverdue).length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('tasks.title', '任务管理')}</h2>
          <p className="text-muted-foreground">{t('tasks.description', '跟踪和管理任务')} · 数据存储于 userData/data/tasks/</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('tasks.create', '新建任务')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTask ? t('tasks.edit', '编辑任务') : t('tasks.create', '新建任务')}</DialogTitle>
              <DialogDescription>
                {editingTask ? t('tasks.editDesc', '编辑任务配置') : t('tasks.createDesc', '创建一个新的任务')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('tasks.titleLabel', '标题')}</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>{t('tasks.descriptionLabel', '描述')}</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('tasks.priorityLabel', '优先级')}</Label>
                  <Select value={priority} onValueChange={v => setPriority(v as 'low' | 'medium' | 'high')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('tasks.priorityLow', '低')}</SelectItem>
                      <SelectItem value="medium">{t('tasks.priorityMedium', '中')}</SelectItem>
                      <SelectItem value="high">{t('tasks.priorityHigh', '高')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>负责人</Label>
                  <Input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="可选" />
                </div>
              </div>
              <div>
                <Label>截止日期</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>{t('tasks.tagsLabel', '标签（逗号分隔）')}</Label>
                <Input value={tagsText} onChange={e => setTagsText(e.target.value)} />
              </div>
              <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '全部', value: stats.total, key: 'all' },
          { label: '待办', value: stats.todo, key: 'todo' },
          { label: '进行中', value: stats.inProgress, key: 'in_progress' },
          { label: '完成', value: stats.done, key: 'done' },
          { label: '已逾期', value: stats.overdue, key: 'overdue', danger: true },
        ].map(s => (
          <Card key={s.key} className={cn(s.danger && 'border-red-300 dark:border-red-700')}>
            <CardContent className="py-3 text-center">
              <div className={cn('text-2xl font-bold', s.danger && 'text-red-500')}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索任务..." className="max-w-xs" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部优先级</SelectItem>
            {Object.entries(PRIORITY_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('tasks.empty', '暂无任务')}</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(task => (
            <Card key={task.id} className={cn(isOverdue(task) && 'border-red-300 dark:border-red-700')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  <span>{task.title}</span>
                  <Badge variant={STATUS_MAP[task.status]?.variant}>{STATUS_MAP[task.status]?.label}</Badge>
                  <Badge variant={PRIORITY_MAP[task.priority]?.variant}>{PRIORITY_MAP[task.priority]?.label}</Badge>
                  {isOverdue(task) && <Badge variant="destructive">已逾期</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{task.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {task.assignee && <span>负责人: {task.assignee}</span>}
                  {task.dueAt && (
                    <span className={cn('flex items-center gap-1', isOverdue(task) && 'text-red-500')}>
                      <Calendar className="h-3 w-3" />
                      截止: {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {task.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {task.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                  </div>
                )}
                <div className="flex gap-1 mt-3">
                  {task.status === 'todo' && <Button size="sm" variant="outline" onClick={() => handleSetStatus(task.id, 'in_progress')}><Play className="h-3 w-3" /></Button>}
                  {task.status === 'in_progress' && <Button size="sm" variant="outline" onClick={() => handleSetStatus(task.id, 'done')}><CheckCircle2 className="h-3 w-3" /></Button>}
                  {task.status !== 'done' && task.status !== 'cancelled' && (
                    <Button size="sm" variant="outline" onClick={() => handleSetStatus(task.id, 'cancelled')}>取消</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(task)}>{t('common.edit', '编辑')}</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(task.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default TaskManagement
