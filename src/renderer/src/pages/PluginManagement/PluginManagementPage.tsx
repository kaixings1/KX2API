import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Loader2, Puzzle, ArrowRight } from 'lucide-react'
import { ManagementToolbar } from '@/components/management'
import { ImportExportDialog } from '@/components/management/ImportExportDialog'

const pluginsApi = window.electronAPI.plugins

export function PluginManagement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [plugins, setPlugins] = useState<PluginRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')

  // ==================== Import/Export ====================

  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export' | 'backup' | 'restore'>('export')

  const handleExport = async () => {
    try {
      const res = await window.electronAPI.mgmt.export('plugins', plugins)
      if (res.success) {
        const blob = new Blob([JSON.stringify(plugins, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `plugins_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  const handleImport = async (jsonData: string) => {
    try {
      const res = await window.electronAPI.mgmt.import('plugins', jsonData)
      if (res.success && res.data) {
        for (const item of res.data) {
          if (item?.id) {
            await pluginsApi.install(item.id)
          }
        }
        loadPlugins()
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
      if (res.success) {
        const blob = new Blob([JSON.stringify({ plugins: plugins }, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `plugins_backup_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Backup failed:', e)
    }
  }

  const handleRestore = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return { success: false, error: '数据格式错误' }
      for (const item of data) {
        if (item?.id) {
          await pluginsApi.install(item.id)
        }
      }
      loadPlugins()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // ==================== Load ====================

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

  // ==================== Actions ====================

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

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      <ManagementToolbar
        title={t('plugins.title', '插件管理')}
        subtitle={t('plugins.description', '管理和安装插件')}
        createLabel={<><Plus className="h-4 w-4 mr-1" />{t('plugins.addPlugin', '添加插件')}</>}
        onCreate={openCreate}
        onRefresh={loadPlugins}
        onExport={() => { setIoMode('export'); setIoOpen(true) }}
        onImport={() => { setIoMode('import'); setIoOpen(true) }}
        onBackup={() => { setIoMode('backup'); setIoOpen(true) }}
        onRestore={() => { setIoMode('restore'); setIoOpen(true) }}
        filters={{ search }}
        onFiltersChange={(f) => setSearch(f.search || '')}
        totalCount={plugins.length}
        filteredCount={plugins.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).length}
        isLoading={loading}
      />

      <ImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        mode={ioMode}
        title="插件管理"
        description={ioMode === 'export' ? '导出插件配置为 JSON 文件' : ioMode === 'import' ? '导入插件配置' : ioMode === 'backup' ? '备份所有插件数据' : '从备份恢复插件数据'}
        data={plugins}
        onExport={handleExport}
        onImport={handleImport}
        onBackup={handleBackup}
        onRestore={handleRestore}
      />

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
                <Card key={plugin.id} className="cursor-pointer hover:border-[var(--accent-primary)] transition-colors" onClick={() => navigate(`/plugins/${plugin.id}`)}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Puzzle className="h-4 w-4" />
                          <span className="font-medium">{plugin.name}</span>
                          <Badge variant={plugin.enabled ? 'default' : 'secondary'}>{plugin.enabled ? t('plugins.enabled', '启用') : t('plugins.disabled', '禁用')}</Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">{plugin.description}</p>
                        <p className="text-xs text-muted-foreground">v{plugin.version} by {plugin.author}</p>
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
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
              <Card key={plugin.id} className={`${plugin.installed ? 'cursor-pointer hover:border-[var(--accent-primary)] transition-colors' : ''}`} onClick={() => plugin.installed && navigate(`/plugins/${plugin.id}`)}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Puzzle className="h-4 w-4" />
                        <span className="font-medium">{plugin.name}</span>
                        {plugin.installed ? (
                          <Badge variant="outline">{t('plugins.installed', '已安装')}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">未安装</Badge>
                        )}
                        {plugin.installed && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{plugin.description}</p>
                      <p className="text-xs text-muted-foreground">v{plugin.version} by {plugin.author}</p>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
  )
}

export default PluginManagement
