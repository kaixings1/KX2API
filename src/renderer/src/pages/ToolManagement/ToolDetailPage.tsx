import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { BackButton } from '@/components/ui/back-button'
import { Trash2, Loader2, FolderOpen } from 'lucide-react'

const api = window.electronAPI.tools

interface ToolDef {
  id: string
  name: string
  displayName: string
  description: string
  usage: string
  platform: string
  tags: string[]
  enabled: boolean
  builtin: boolean
}

interface ToolGroup {
  id: string
  name: string
  description: string
  toolIds: string[]
  enabled: boolean
  builtin: boolean
}

export function ToolDetailPage() {
  useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tool, setTool] = useState<ToolDef | null>(null)
  const [groups, setGroups] = useState<ToolGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ name: '', displayName: '', description: '', usage: '', platform: 'all', tags: '' })

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await api.getAll()
      if (res.success && res.data) {
        const found = res.data.tools.find(t => t.id === id)
        if (found) {
          setTool(found)
          setForm({
            name: found.name,
            displayName: found.displayName,
            description: found.description,
            usage: found.usage,
            platform: found.platform,
            tags: found.tags.join(', '),
          })
        }
        setGroups(res.data.groups)
      }
    } catch (e) {
      console.error('[ToolDetail] Failed to load:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    if (!id) return
    await api.update(id, {
      name: form.name,
      displayName: form.displayName,
      description: form.description,
      usage: form.usage,
      platform: form.platform,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
    })
    setEditOpen(false)
    loadData()
  }

  const handleToggle = async () => {
    if (!id || !tool) return
    await api.toggle(id)
    loadData()
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('确定删除此工具?')) return
    await api.remove(id)
    navigate('/tools')
  }

  const relatedGroups = groups.filter(g => g.toolIds.includes(id || ''))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="space-y-4">
        <BackButton to="/tools" label="返回列表" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            工具不存在或已被删除
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: '工具管理', href: '/tools' },
        { label: tool.displayName || tool.name },
      ]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/tools" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">/{tool.name}</h2>
            <p className="text-muted-foreground text-sm">{tool.displayName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>编辑</Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{tool.enabled ? '启用' : '禁用'}</span>
            <Switch checked={tool.enabled} onCheckedChange={handleToggle} />
          </div>
          {!tool.builtin && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
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
              <span>/{tool.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">显示名称</span>
              <span>{tool.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">平台</span>
              <Badge variant="outline">{tool.platform}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">内置</span>
              <Badge variant={tool.builtin ? 'secondary' : 'outline'}>{tool.builtin ? '是' : '否'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">所属分组</CardTitle>
          </CardHeader>
          <CardContent>
            {relatedGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">未归属任何分组</p>
            ) : (
              <div className="space-y-2">
                {relatedGroups.map(g => (
                  <div key={g.id} className="flex items-center gap-2 text-sm">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{g.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">描述</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{tool.description || '(无描述)'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">用法</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-sm bg-muted px-2 py-1 rounded">{tool.usage || '(无用法说明)'}</code>
        </CardContent>
      </Card>

      {tool.tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">标签</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {tool.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑工具</DialogTitle>
            <DialogDescription>修改工具配置</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称 *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>显示名称 *</Label>
              <Input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <Label>描述</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <Label>用法</Label>
              <Input value={form.usage} onChange={e => setForm(p => ({ ...p, usage: e.target.value }))} />
            </div>
            <div>
              <Label>平台</Label>
              <select className="w-full text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5" value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                <option value="all">全部</option>
                <option value="windows">Windows</option>
                <option value="unix">Unix</option>
              </select>
            </div>
            <div>
              <Label>标签 (逗号分隔)</Label>
              <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
            </div>
            <Button onClick={handleSave} className="w-full">保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ToolDetailPage
