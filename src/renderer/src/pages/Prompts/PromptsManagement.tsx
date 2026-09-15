import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from '@/components/ui/section-card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Edit3, Save, X, Sparkles, Code2, Bot, MessageSquare, Star, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const promptsApi = window.electronAPI.prompts

const PROMPT_TYPE_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  general:    { label: '通用', icon: Sparkles, variant: 'default' },
  'tool-use': { label: '工具', icon: Code2, variant: 'secondary' },
  agent:      { label: '代理', icon: Bot, variant: 'outline' },
  translation:{ label: '翻译', icon: MessageSquare, variant: 'secondary' },
  search:     { label: '搜索', icon: Star, variant: 'destructive' },
}

export function PromptsManagement() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [prompts, setPrompts] = useState<SystemPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [promptText, setPromptText] = useState('')
  const [type, setType] = useState<PromptType>('general')
  const [emoji, setEmoji] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'builtin' | 'custom'>('all')
  const [search, setSearch] = useState('')

  const loadPrompts = useCallback(async () => {
    setLoading(true)
    try {
      let data: SystemPrompt[] = []
      if (activeTab === 'all') {
        data = await promptsApi.getAll()
      } else if (activeTab === 'builtin') {
        data = await promptsApi.getBuiltin()
      } else {
        data = await promptsApi.getCustom()
      }
      setPrompts(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('[PromptsManagement] Failed to load prompts:', e)
      setPrompts([])
    }
    setLoading(false)
  }, [activeTab])

  useEffect(() => { loadPrompts() }, [loadPrompts])

  const openCreate = () => {
    setEditingPrompt(null)
    setName('')
    setDescription('')
    setPromptText('')
    setType('general')
    setEmoji('')
    setDialogOpen(true)
  }

  const openEdit = (p: SystemPrompt) => {
    setEditingPrompt(p)
    setName(p.name)
    setDescription(p.description)
    setPromptText(p.prompt)
    setType(p.type)
    setEmoji(p.emoji || '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editingPrompt) {
        await promptsApi.update(editingPrompt.id, { name, description, prompt: promptText, type, emoji: emoji || undefined })
      } else {
        await promptsApi.add({ name, description, prompt: promptText, type, isBuiltin: false, emoji: emoji || undefined })
      }
      setDialogOpen(false)
      loadPrompts()
      toast({ title: editingPrompt ? t('prompts.saved', '已保存') : t('prompts.created', '已创建') })
    } catch (e) {
      console.error('[PromptsManagement] Save failed:', e)
      toast({ title: t('prompts.saveFailed', '保存失败'), variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('prompts.confirmDelete', '确定删除此提示词？'))) return
    try {
      await promptsApi.delete(id)
      loadPrompts()
      toast({ title: t('prompts.deleted', '提示词已删除') })
    } catch (e) {
      console.error('[PromptsManagement] Delete failed:', e)
      toast({ title: t('prompts.deleteFailed', '删除失败'), variant: 'destructive' })
    }
  }

  const filteredPrompts = prompts
    .filter(p => {
      if (!search.trim()) return true
      const kw = search.toLowerCase().trim()
      return p.name.toLowerCase().includes(kw)
        || p.description.toLowerCase().includes(kw)
        || p.prompt.toLowerCase().includes(kw)
    })
    .filter(p => {
      if (activeTab === 'builtin') return p.isBuiltin
      if (activeTab === 'custom') return !p.isBuiltin
      return true
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">提示词管理</h2>
          <p className="text-muted-foreground">管理系统提示词（System Prompt），支持查看和编辑</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('prompts.searchPlaceholder', '搜索提示词...')}
            className="h-9 w-48"
          />
          <Button onClick={openCreate} disabled={loading} className="gap-2">
            <Plus className="h-4 w-4" /> 新建提示词
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredPrompts.length === 0 ? (
        <SectionCard><p className="py-6 text-center text-xs text-[var(--text-muted)]">暂无提示词数据</p></SectionCard>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'builtin' | 'custom')}>
          <TabsList>
            <TabsTrigger value="all">全部 ({filteredPrompts.length})</TabsTrigger>
            <TabsTrigger value="builtin">内置</TabsTrigger>
            <TabsTrigger value="custom">自定义</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {filteredPrompts.map((p) => {
              const typeInfo = PROMPT_TYPE_LABELS[p.type] || { label: p.type, icon: Sparkles, variant: 'secondary' as const }
              const TypeIcon = typeInfo.icon
              return (
                <div key={p.id} className="group rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-primary/30 transition-colors">
                  <div className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {p.emoji && <span className="text-lg">{p.emoji}</span>}
                          <h3 className="font-medium text-sm truncate">{p.name}</h3>
                          <Badge variant={typeInfo.variant} className="gap-1 text-xs">
                            <TypeIcon className="h-3 w-3" /> {typeInfo.label}
                          </Badge>
                          {p.isBuiltin && <Badge variant="outline" className="text-xs">内置</Badge>}
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{p.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground/80 line-clamp-2 font-mono bg-muted/50 rounded px-2 py-1">
                          {p.prompt}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(p.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        {!p.isBuiltin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? '编辑提示词' : '新建提示词'}</DialogTitle>
            <DialogDescription>
              定义系统提示词模板，用于 Agent 或对话的系统角色设定
            </DialogDescription>
          </DialogHeader>
          <SectionCard contentClassName="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>名称</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="提示词名称" />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <select value={type} onChange={e => setType(e.target.value as PromptType)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="general">通用</option>
                  <option value="tool-use">工具使用</option>
                  <option value="agent">代理</option>
                  <option value="translation">翻译</option>
                  <option value="search">搜索</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Emoji（可选）</Label>
                <Input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="如 🤖" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>分类标签</Label>
                <Input value={editingPrompt?.groups?.join(', ') || ''} disabled placeholder="内置提示词固定" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="简短描述提示词用途" />
            </div>
            <div className="space-y-2">
              <Label>提示词内容</Label>
              <Textarea
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                placeholder="输入系统提示词..."
                className="min-h-[180px] font-mono text-sm"
              />
            </div>
          </SectionCard>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4 mr-1" /> 取消
            </Button>
            <Button onClick={handleSave} disabled={!name || !promptText}>
              <Save className="h-4 w-4 mr-1" /> 保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PromptsManagement
