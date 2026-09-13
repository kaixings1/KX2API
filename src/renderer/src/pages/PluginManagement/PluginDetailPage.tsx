import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { BackButton } from '@/components/ui/back-button'
import { Trash2, Loader2 } from 'lucide-react'

const pluginsApi = window.electronAPI.plugins

interface PluginDetail {
  id: string
  name: string
  version: string
  description: string
  author: string
  installed: boolean
  enabled: boolean
}

export function PluginDetailPage() {
  useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plugin, setPlugin] = useState<PluginDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editVersion, setEditVersion] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAuthor, setEditAuthor] = useState('')

  const loadPlugin = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await pluginsApi.getById(id)
      if (res.plugin) {
        const p = res.plugin as PluginDetail
        setPlugin(p)
        setEditName(p.name)
        setEditVersion(p.version)
        setEditDescription(p.description)
        setEditAuthor(p.author)
      }
    } catch (e) {
      console.error('[PluginDetail] Failed to load:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadPlugin() }, [loadPlugin])

  const handleSave = async () => {
    if (!id) return
    await pluginsApi.update(id, { name: editName, version: editVersion, description: editDescription, author: editAuthor })
    setEditOpen(false)
    loadPlugin()
  }

  const handleToggle = async () => {
    if (!id || !plugin) return
    if (plugin.enabled) {
      await pluginsApi.disable(id)
    } else {
      await pluginsApi.enable(id)
    }
    loadPlugin()
  }

  const handleUninstall = async () => {
    if (!id) return
    if (!confirm('确定卸载此插件?')) return
    await pluginsApi.uninstall(id)
    navigate('/plugins')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!plugin) {
    return (
      <div className="space-y-4">
        <BackButton to="/plugins" label="返回列表" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            插件不存在或已被卸载
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: '插件管理', href: '/plugins' },
        { label: plugin.name },
      ]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/plugins" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{plugin.name}</h2>
            <p className="text-muted-foreground text-sm">ID: {plugin.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>编辑</Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{plugin.enabled ? '启用' : '禁用'}</span>
            <Button variant="outline" size="sm" onClick={handleToggle}>
              {plugin.enabled ? '禁用' : '启用'}
            </Button>
          </div>
          <Button variant="destructive" size="sm" onClick={handleUninstall}>
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
              <span>{plugin.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">版本</span>
              <span>v{plugin.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">作者</span>
              <span>{plugin.author}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">状态</span>
              <div className="flex gap-1">
                <Badge variant={plugin.installed ? 'default' : 'outline'}>
                  {plugin.installed ? '已安装' : '未安装'}
                </Badge>
                <Badge variant={plugin.enabled ? 'default' : 'secondary'}>
                  {plugin.enabled ? '启用' : '禁用'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">描述</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{plugin.description || '(无描述)'}</p>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑插件</DialogTitle>
            <DialogDescription>修改插件信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>版本</Label>
              <Input value={editVersion} onChange={e => setEditVersion(e.target.value)} />
            </div>
            <div>
              <Label>描述</Label>
              <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
            </div>
            <div>
              <Label>作者</Label>
              <Input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} />
            </div>
            <Button onClick={handleSave} className="w-full">保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PluginDetailPage
