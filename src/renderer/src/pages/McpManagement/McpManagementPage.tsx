import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionCard } from '@/components/ui/section-card'
import { Plus, Trash2, TestTube2, Loader2, ArrowRight, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ManagementToolbar } from '@/components/management'
import { ImportExportDialog } from '@/components/management/ImportExportDialog'
import { useToast } from '@/hooks/use-toast'

const mcpApi = window.electronAPI.mcp

const TRANSPORT_MAP: Record<string, string> = {
  stdio: 'stdio',
  sse: 'SSE',
  http: 'HTTP',
}

export function McpManagement() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [config, setConfig] = useState<{ servers: McpServerConfig[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [command, setCommand] = useState('')
  const [argsText, setArgsText] = useState('')
  const [envText, setEnvText] = useState('')
  const [transport, setTransport] = useState<'stdio' | 'sse' | 'http'>('stdio')
  const [testResult, setTestResult] = useState<{ success: boolean; connected: boolean; tools: any[] } | null>(null)
  const [tools, setTools] = useState<any[]>([])
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setTestResult(null)
    try {
      const [configRes, serversRes] = await Promise.all([mcpApi.getConfig(), mcpApi.getServers()])
      if (configRes?.servers) setConfig(configRes)
      if (Array.isArray(serversRes)) setServers(serversRes)
    } catch (e) {
      console.error('[McpManagement] Failed to load data:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const openCreate = () => {
    setEditingServer(null)
    setName('')
    setUrl('')
    setCommand('')
    setArgsText('')
    setEnvText('')
    setTransport('stdio')
    setDialogOpen(true)
  }

  const openEdit = (server: McpServerConfig) => {
    setEditingServer(server)
    setName(server.name)
    setUrl(server.url || '')
    setCommand(server.command || '')
    setArgsText((server.args || []).join(' '))
    setEnvText(server.env ? JSON.stringify(server.env) : '')
    setTransport(server.transport)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: t('mcp.nameRequired', '请输入服务器名称'), variant: 'destructive' })
      return
    }
    try {
      const args = argsText.split(' ').filter(Boolean)
      let env: Record<string, string> = {}
      try { env = JSON.parse(envText || '{}') } catch { env = {} }
      // 直接构造正确类型，不要先用 Record<string, unknown> 再断言 ——
      // 那样两边类型不重叠，TS2352 会报"可能是误用"，且断言会掩盖字段拼错。
      const serverData: McpServerConfig & { enabled: boolean } = {
        id: editingServer?.id ?? `mcp_${Date.now()}`,
        name,
        transport,
        enabled: true,
      }
      if (url) serverData.url = url
      if (command) serverData.command = command
      if (args.length > 0) serverData.args = args
      if (Object.keys(env).length > 0) serverData.env = env
      if (editingServer) {
        const newServers = servers.map(s => s.id === editingServer.id ? { ...s, ...serverData } : s)
        await mcpApi.updateConfig({ servers: newServers })
        setServers(newServers)
      } else {
        await mcpApi.addServer(serverData)
      }
      setDialogOpen(false)
      loadData()
      toast({ title: editingServer ? t('mcp.saved', '配置已保存') : t('mcp.created', '服务器已添加') })
    } catch (e) {
      console.error('[McpManagement] Save failed:', e)
      toast({ title: t('mcp.saveFailed', '保存失败'), variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('mcp.confirmDelete', '确定删除此服务器？'))) return
    try {
      await mcpApi.removeServer(id)
      setTestResult(null)
      setTools([])
      loadData()
      toast({ title: t('mcp.deleted', '服务器已删除') })
    } catch (e) {
      console.error('[McpManagement] Delete failed:', e)
      toast({ title: t('mcp.deleteFailed', '删除失败'), variant: 'destructive' })
    }
  }

  const handleTest = async (server: McpServerConfig) => {
    setTestResult(null)
    try {
      const res = await mcpApi.testConnection(server)
      if (res.success) {
        setTestResult({ success: true, connected: res.connected, tools: res.tools })
        setTools(res.tools)
        if (res.connected) {
          toast({ title: t('mcp.connected', '连接成功'), description: `${res.tools.length} 个工具可用` })
        } else {
          toast({ title: t('mcp.connectionFailed', '连接失败'), variant: 'destructive' })
        }
      } else {
        toast({ title: res.error || t('mcp.testFailed', '测试失败'), variant: 'destructive' })
      }
    } catch (e) {
      console.error('[McpManagement] Test failed:', e)
      toast({ title: t('mcp.testError', '测试出错'), variant: 'destructive' })
    }
  }

  const handleGetTools = async (server: McpServerConfig) => {
    try {
      const res = await mcpApi.getTools(server.id)
      if (res) setTools(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error('[McpManagement] GetTools failed:', e)
      toast({ title: t('mcp.getToolsFailed', '获取工具列表失败'), variant: 'destructive' })
    }
  }

  const filtered = servers.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.url || '').toLowerCase().includes(search.toLowerCase()) || (s.command || '').toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  // ==================== Import/Export ====================

  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export' | 'backup' | 'restore'>('export')

  const handleExport = async () => {
    try {
      const res = await window.electronAPI.mgmt.export('mcp-servers', filtered)
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
      const res = await window.electronAPI.mgmt.import('mcp-servers', jsonData)
      if (res.success && res.data) {
        for (const item of res.data) {
          if (item?.name) {
            await mcpApi.addServer({ name: item.name, url: item.url || '', transport: item.transport || 'stdio', enabled: true })
          }
        }
        loadData()
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
      const blob = new Blob([JSON.stringify({ 'mcp-servers': filtered }, null, 2)], { type: 'application/json' })
      const file = new File([blob], `mcp_servers_backup_${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
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
      const items = Array.isArray(data) ? data : (data['mcp-servers'] || [])
      if (!Array.isArray(items)) return { success: false, error: '数据格式错误' }
      for (const item of items) {
        if (item?.name) {
          await mcpApi.addServer({ name: item.name, url: item.url || '', transport: item.transport || 'stdio', enabled: true })
        }
      }
      loadData()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      <ManagementToolbar
        title={t('mcp.title', 'MCP 管理')}
        subtitle={t('mcp.description', '管理 MCP 服务器配置')}
        createLabel={<><Plus className="h-4 w-4 mr-1" />{t('mcp.addServer', '添加服务器')}</>}
        onCreate={openCreate}
        onRefresh={loadData}
        onExport={() => { setIoMode('export'); setIoOpen(true) }}
        onImport={() => { setIoMode('import'); setIoOpen(true) }}
        onBackup={() => { setIoMode('backup'); setIoOpen(true) }}
        onRestore={() => { setIoMode('restore'); setIoOpen(true) }}
        filters={{ search }}
        onFiltersChange={(f) => setSearch(f.search || '')}
        totalCount={servers.length}
        filteredCount={filtered.length}
        isLoading={loading}
      />

      <ImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        mode={ioMode}
        title="MCP 管理"
        description={ioMode === 'export' ? '导出 MCP 服务器配置为 JSON 文件' : ioMode === 'import' ? '导入 MCP 服务器配置' : ioMode === 'backup' ? '备份所有 MCP 服务器数据' : '从备份恢复 MCP 服务器数据'}
        data={filtered}
        onExport={handleExport}
        onImport={handleImport}
        onBackup={handleBackup}
        onRestore={handleRestore}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <p className="py-6 text-center text-xs text-[var(--text-muted)]">{t('mcp.noMatch', '没有匹配的服务器')}</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4">
          {filtered.map(server => (
            <Card key={server.id} className="cursor-pointer hover:border-[var(--accent-primary)] transition-colors" onClick={() => navigate(`/mcp/${server.id}`)}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{server.name}</span>
                      <Badge variant={server.enabled ? 'default' : 'secondary'}>{TRANSPORT_MAP[server.transport] || server.transport}</Badge>
                      <Badge variant="outline" className="text-[10px]">ID: {server.id}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      {server.command && <p className="text-sm font-mono text-muted-foreground">{t('mcp.commandLabel', 'Command')}: {server.command} {server.args?.join(' ')}</p>}
                      {server.url && <p className="text-sm font-mono text-muted-foreground">URL: {server.url}</p>}
                      {server.headers && Object.keys(server.headers).length > 0 && (
                        <p className="text-xs text-muted-foreground">Headers: {Object.keys(server.headers).length} configured</p>
                      )}
                    </div>
                    {testResult && testResult.connected && (
                      <p className="text-xs text-green-600">{t('mcp.connected', '连接成功')} - {testResult.tools.length} {t('mcp.toolsAvailable', '个工具')}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-3" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => handleTest(server)}><TestTube2 className="h-3 w-3 mr-1" />{t('mcp.test', '测试')}</Button>
                    <Button size="sm" variant="outline" onClick={() => handleGetTools(server)}>{t('mcp.getTools', '工具')}</Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(server)}>{t('common.edit', '编辑')}</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(server.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tools.length > 0 && (
        <SectionCard title={t('mcp.availableTools', '可用工具')}>
          <div className="space-y-2">
            {tools.map((tool: any, i: number) => (
              <div key={i} className="text-sm">
                <strong>{tool.name}</strong>
                {tool.description && <p className="text-muted-foreground text-xs">{tool.description}</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Help Card */}
      <SectionCard title={t('mcp.pageHelpTitle', '关于 MCP')} icon={Info}>
        <p className="text-xs text-[var(--text-dim)] leading-relaxed">
          {t('mcp.pageHelp', '配置和管理 MCP 服务器。支持 stdio、SSE 和 HTTP 传输方式。点击测试按钮验证连接，点击卡片进入详情页查看可用工具。')}
        </p>
      </SectionCard>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingServer ? t('mcp.editServer', '编辑服务器') : t('mcp.addServer', '添加服务器')}</DialogTitle>
            <DialogDescription>
              {editingServer ? t('mcp.editServerDesc', '编辑 MCP 服务器配置') : t('mcp.addServerDesc', '添加新的 MCP 服务器')}
            </DialogDescription>
          </DialogHeader>
          <SectionCard contentClassName="space-y-4">
            <div>
              <Label>{t('mcp.nameLabel', '名称')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t('mcp.urlLabel', 'URL')}</Label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder={t('mcp.urlPlaceholder', 'http://localhost:3000')} />
            </div>
            <div>
              <Label>{t('mcp.commandLabel', 'Command')}</Label>
              <Input value={command} onChange={e => setCommand(e.target.value)} placeholder="node" />
            </div>
            <div>
              <Label>{t('mcp.argsLabel', 'Args (空格分隔)')}</Label>
              <Input value={argsText} onChange={e => setArgsText(e.target.value)} placeholder="server.js --port 3000" />
            </div>
            <div>
              <Label>{t('mcp.envLabel', 'Env (JSON)')}</Label>
              <Input value={envText} onChange={e => setEnvText(e.target.value)} placeholder='{"KEY": "value"}' />
            </div>
            <div>
              <Label>{t('mcp.transportLabel', '传输方式')}</Label>
              <Select value={transport} onValueChange={v => setTransport(v as 'stdio' | 'sse' | 'http')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">stdio</SelectItem>
                  <SelectItem value="sse">SSE</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
          </SectionCard>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default McpManagement
