import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from '@/components/ui/section-card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Play, Square, CheckCircle2, Loader2, Calendar, Info, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ManagementToolbar } from '@/components/management'
import { ImportExportDialog } from '@/components/management/ImportExportDialog'

const tasksApi = window.electronAPI.tasks

type StreamEvent = { type: string; taskId?: string; detail?: string; logEntry?: { time: number; event: string; detail?: string }; task?: any }

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  todo: { label: '○ 待办', variant: 'secondary' },
  in_progress: { label: '● 进行中', variant: 'default' },
  done: { label: '○ 完成', variant: 'outline' },
  cancelled: { label: '○ 取消', variant: 'destructive' },
}

const PRIORITY_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  low: { label: '低', variant: 'secondary' },
  medium: { label: '中', variant: 'outline' },
  high: { label: '高', variant: 'destructive' },
}

export function TaskManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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

  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set())
  const [logMap, setLogMap] = useState<Record<string, Array<{ time: number; event: string; detail?: string }>>>({})
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [runningTasks, setRunningTasks] = useState<Array<{ taskId: string; aborted: boolean }>>([])

  // ==================== Stream Event Listener ====================
  useEffect(() => {
    const unsubscribe = tasksApi.onStreamEvent((event: StreamEvent) => {
      if (!event.taskId) return
      const taskId = event.taskId

      setLogMap(prev => {
        const logs = [...(prev[taskId] || [])]
        if (event.logEntry) {
          logs.push(event.logEntry)
        } else if (event.type === 'done' || event.type === 'error' || event.type === 'aborted') {
          logs.push({ time: Date.now(), event: event.type, detail: event.detail || '' })
        } else {
          logs.push({ time: Date.now(), event: event.type, detail: event.detail || '' })
        }
        return { ...prev, [taskId]: logs }
      })

      if (event.task) {
        setTasks(prev => prev.map(t => t.id === taskId ? event.task : t))
      }

      if (event.type === 'done' || event.type === 'error' || event.type === 'aborted') {
        setExecutingIds(prev => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
        loadTasks()
      }
    })

    const pollRunning = async () => {
      try {
        const running = await tasksApi.getRunning()
        setRunningTasks(running)
        setExecutingIds(new Set(running.map(r => r.taskId)))
      } catch (e) {
        // ignore
      }
    }

    pollRunning()
    const timer = setInterval(pollRunning, 3000)

    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [])

  const toggleLog = (taskId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const handleExecute = async (taskId: string) => {
    setExecutingIds(prev => new Set(prev).add(taskId))
    setLogMap(prev => ({ ...prev, [taskId]: [] }))
    setExpandedLogs(prev => {
      const next = new Set(prev)
      next.add(taskId)
      return next
    })
    try {
      await tasksApi.execute(taskId)
    } catch (e) {
      console.error('Execute task failed:', e)
      setExecutingIds(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  const handleAbort = async (taskId: string) => {
    try {
      await tasksApi.abort(taskId)
    } catch (e) {
      console.error('Abort task failed:', e)
    }
  }

  const isExecuting = (taskId: string) => executingIds.has(taskId)

  // ==================== Import/Export ====================

  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export' | 'backup' | 'restore'>('export')

  const handleExport = async () => {
    try {
      const res = await window.electronAPI.mgmt.export('tasks', filtered)
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
      const res = await window.electronAPI.mgmt.import('tasks', jsonData)
      if (res.success && res.data) {
        for (const item of res.data) {
          if (item?.title) {
            await tasksApi.create({ ...item, status: item.status || 'todo' })
          }
        }
        loadTasks()
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
      const blob = new Blob([JSON.stringify({ tasks: filtered }, null, 2)], { type: 'application/json' })
      const file = new File([blob], `tasks_backup_${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
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
          await tasksApi.create({ ...item, status: item.status || 'todo' })
        }
      }
      loadTasks()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // ==================== Load ====================

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
    setTagsText(Array.isArray(task.tags) ? task.tags.join(', ') : '')
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
      <ManagementToolbar
        title={t('tasks.title', '任务管理')}
        subtitle={t('tasks.description', '跟踪和管理任务')}
        createLabel={<><Plus className="h-4 w-4 mr-1" />{t('tasks.create', '新建任务')}</>}
        onCreate={openCreate}
        onRefresh={loadTasks}
        onExport={() => { setIoMode('export'); setIoOpen(true) }}
        onImport={() => { setIoMode('import'); setIoOpen(true) }}
        onBackup={() => { setIoMode('backup'); setIoOpen(true) }}
        onRestore={() => { setIoMode('restore'); setIoOpen(true) }}
        filters={{ search, status: filterStatus }}
        onFiltersChange={(f) => { setSearch(f.search || ''); setFilterStatus(f.status || 'all') }}
        filterOptions={[
          { key: 'status', label: '状态', options: [
            { value: 'all', label: '全部状态' },
            { value: 'todo', label: '待办' },
            { value: 'in_progress', label: '进行中' },
            { value: 'done', label: '完成' },
            { value: 'cancelled', label: '取消' },
          ]},
        ]}
        totalCount={tasks.length}
        filteredCount={filtered.length}
        isLoading={loading}
      />

      <ImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        mode={ioMode}
        title="任务管理"
        description={ioMode === 'export' ? '导出任务配置为 JSON 文件' : ioMode === 'import' ? '导入任务配置' : ioMode === 'backup' ? '备份所有任务数据' : '从备份恢复任务数据'}
        data={filtered}
        onExport={handleExport}
        onImport={handleImport}
        onBackup={handleBackup}
        onRestore={handleRestore}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '全部', value: stats.total, key: 'all' },
          { label: '待办', value: stats.todo, key: 'todo' },
          { label: '进行中', value: stats.inProgress, key: 'in_progress' },
          { label: '完成', value: stats.done, key: 'done' },
          { label: '已逾期', value: stats.overdue, key: 'overdue', danger: true },
        ].map(s => (
          <SectionCard key={s.key} className={cn(s.danger && 'border-red-300 dark:border-red-700')}>
            <div className="text-center py-3">
              <div className={cn('text-2xl font-bold', s.danger && 'text-red-500')}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </SectionCard>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-2">
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? t('tasks.edit', '编辑任务') : t('tasks.create', '新建任务')}</DialogTitle>
            <DialogDescription>
              {editingTask ? t('tasks.editDesc', '编辑任务配置') : t('tasks.createDesc', '创建一个新的任务')}
            </DialogDescription>
          </DialogHeader>
          <SectionCard contentClassName="space-y-4">
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
          </SectionCard>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <SectionCard><p className="py-6 text-center text-xs text-[var(--text-muted)]">{t('tasks.empty', '暂无任务')}</p></SectionCard>
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
                {Array.isArray(task.tags) && task.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {task.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                  </div>
                )}
                <div className="flex gap-1 mt-3">
                  {!isExecuting(task.id) && task.status === 'todo' && (
                    <Button size="sm" variant="default" onClick={() => handleExecute(task.id)}><Play className="h-3 w-3 mr-1" />执行</Button>
                  )}
                  {isExecuting(task.id) && (
                    <Button size="sm" variant="destructive" onClick={() => handleAbort(task.id)}><Square className="h-3 w-3 mr-1" />中止</Button>
                  )}
                  {!isExecuting(task.id) && task.status === 'in_progress' && (
                    <Button size="sm" variant="default" onClick={() => handleExecute(task.id)}><Play className="h-3 w-3 mr-1" />继续执行</Button>
                  )}
                  {(logMap[task.id] || []).length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => toggleLog(task.id)}>
                      {expandedLogs.has(task.id) ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                      日志
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(task)}>{t('common.edit', '编辑')}</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(task.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>

                {expandedLogs.has(task.id) && (logMap[task.id] || []).length > 0 && (
                  <div className="mt-3 p-2 rounded border bg-black/5 dark:bg-white/5 text-xs max-h-60 overflow-y-auto">
                    {logMap[task.id].map((entry, idx) => (
                      <div key={idx} className="flex gap-2 py-1 border-b border-black/5 dark:border-white/5 last:border-0">
                        <span className="text-muted-foreground shrink-0">{new Date(entry.time).toLocaleTimeString()}</span>
                        <span className="font-mono">{entry.event}</span>
                        {entry.detail && <span className="text-muted-foreground truncate">{entry.detail}</span>}
                      </div>
                    ))}
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

export default TaskManagement
