import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Loader2, Puzzle } from 'lucide-react'

const pluginsApi = window.electronAPI.plugins

export function PluginManagement() {
  const { t } = useTranslation()
  const [plugins, setPlugins] = useState<PluginRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pluginId, setPluginId] = useState('')
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')

  const loadPlugins = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pluginsApi.getAll()
      setPlugins(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error('[PluginManagement] Failed to load plugins:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPlugins() }, [loadPlugins])

  const handleInstall = async (id: string) => {
    await pluginsApi.install(id)
    loadPlugins()
  }

  const handleUninstall = async (id: string) => {
    await pluginsApi.uninstall(id)
    loadPlugins()
  }

  const handleEnable = async (id: string) => {
    await pluginsApi.enable(id)
    loadPlugins()
  }

  const handleDisable = async (id: string) => {
    await pluginsApi.disable(id)
    loadPlugins()
  }

  const openCreate = () => {
    setPluginId('')
    setName('')
    setVersion('')
    setDescription('')
    setAuthor('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const id = `plugin_${Date.now()}`
    await pluginsApi.install(id)
    const res = await pluginsApi.getAll()
    if (Array.isArray(res)) {
      const newPlugin = res.find(p => p.id === id)
      if (newPlugin) {
        setPlugins(prev => prev.map(p => p.id === id ? { ...p, name, version, description, author } : p))
      }
    }
    setDialogOpen(false)
  }

  const builtin = plugins.filter(p => p.author === 'builtin')
  const thirdParty = plugins.filter(p => p.author !== 'builtin')
  const installed = plugins.filter(p => p.installed)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('plugins.title', '插件管理')}</h2>
          <p className="text-muted-foreground">{t('plugins.description', '管理和安装插件')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('plugins.addPlugin', '添加插件')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('plugins.addPlugin', '添加插件')}</DialogTitle>
              <DialogDescription>{t('plugins.addPluginDesc', '安装新的插件到系统中')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>{t('plugins.nameLabel', '名称')}</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>{t('plugins.versionLabel', '版本')}</Label><Input value={version} onChange={e => setVersion(e.target.value)} /></div>
              <div><Label>{t('plugins.descriptionLabel', '描述')}</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div><Label>{t('plugins.authorLabel', '作者')}</Label><Input value={author} onChange={e => setAuthor(e.target.value)} /></div>
              <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : plugins.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('plugins.empty', '暂无插件')}</CardContent></Card>
      ) : (
        <Tabs defaultValue="installed">
          <TabsList>
            <TabsTrigger value="installed">{t('plugins.installed', '已安装')} ({installed.length})</TabsTrigger>
            <TabsTrigger value="all">{t('plugins.all', '全部')} ({plugins.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="installed" className="space-y-4 mt-4">
            {installed.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t('plugins.noInstalled', '未安装任何插件')}</CardContent></Card>
            ) : (
              installed.map(plugin => (
                <Card key={plugin.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Puzzle className="h-4 w-4" />
                          <span className="font-medium">{plugin.name}</span>
                          <Badge variant={plugin.enabled ? 'default' : 'secondary'}>{plugin.enabled ? t('plugins.enabled', '启用') : t('plugins.disabled', '禁用')}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{plugin.description}</p>
                        <p className="text-xs text-muted-foreground">v{plugin.version} by {plugin.author}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => plugin.enabled ? handleDisable(plugin.id) : handleEnable(plugin.id)}>
                          {plugin.enabled ? t('plugins.disable', '禁用') : t('plugins.enable', '启用')}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleUninstall(plugin.id)}>{t('plugins.uninstall', '卸载')}</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          <TabsContent value="all" className="space-y-4 mt-4">
            {plugins.map(plugin => (
              <Card key={plugin.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Puzzle className="h-4 w-4" />
                        <span className="font-medium">{plugin.name}</span>
                        {plugin.installed && <Badge variant="outline">{t('plugins.installed', '已安装')}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{plugin.description}</p>
                      <p className="text-xs text-muted-foreground">v{plugin.version} by {plugin.author}</p>
                    </div>
                    <div>
                      {!plugin.installed ? (
                        <Button size="sm" variant="outline" onClick={() => handleInstall(plugin.id)}>{t('plugins.install', '安装')}</Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => handleUninstall(plugin.id)}>{t('plugins.uninstall', '卸载')}</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default PluginManagement
