import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, TestTube2, Loader2 } from 'lucide-react'

const mcpApi = window.electronAPI.mcp

const TRANSPORT_MAP: Record<string, string> = {
  stdio: 'stdio',
  sse: 'SSE',
  http: 'HTTP',
}

export function McpManagement() {
  const { t } = useTranslation()
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [config, setConfig] = useState<{ servers: McpServerConfig[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [transport, setTransport] = useState<'stdio' | 'sse' | 'http'>('stdio')
  const [testResult, setTestResult] = useState<{ success: boolean; connected: boolean; tools: any[] } | null>(null)
  const [tools, setTools] = useState<any[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
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
    setTransport('stdio')
    setDialogOpen(true)
  }

  const openEdit = (server: McpServerConfig) => {
    setEditingServer(server)
    setName(server.name)
    setUrl(server.url)
    setTransport(server.transport)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (editingServer) {
      const newServers = servers.map(s => s.id === editingServer.id ? { ...s, name, url, transport } : s)
      await mcpApi.updateConfig({ servers: newServers })
      setServers(newServers)
    } else {
      await mcpApi.addServer({ name, url, transport, enabled: true })
    }
    setDialogOpen(false)
    loadData()
  }

  const handleDelete = async (id: string) => {
    await mcpApi.removeServer(id)
    loadData()
  }

  const handleTest = async (server: McpServerConfig) => {
    setTestResult(null)
    const res = await mcpApi.testConnection(server)
    if (res.success) {
      setTestResult({ success: true, connected: res.connected, tools: res.tools })
      setTools(res.tools)
    }
  }

  const handleGetTools = async (server: McpServerConfig) => {
    const res = await mcpApi.getTools(server.id)
    if (res) setTools(Array.isArray(res) ? res : [])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('mcp.title', 'MCP 管理')}</h2>
          <p className="text-muted-foreground">{t('mcp.description', '管理 MCP 服务器配置')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('mcp.addServer', '添加服务器')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingServer ? t('mcp.editServer', '编辑服务器') : t('mcp.addServer', '添加服务器')}</DialogTitle>
              <DialogDescription>
                {editingServer ? t('mcp.editServerDesc', '编辑 MCP 服务器配置') : t('mcp.addServerDesc', '添加新的 MCP 服务器')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('mcp.nameLabel', '名称')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>{t('mcp.urlLabel', 'URL')}</Label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder={t('mcp.urlPlaceholder', 'http://localhost:3000')} />
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
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : servers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t('mcp.empty', '暂无 MCP 服务器')}</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {servers.map(server => (
            <Card key={server.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{server.name}</span>
                      <Badge variant={server.enabled ? 'default' : 'secondary'}>{TRANSPORT_MAP[server.transport]}</Badge>
                    </div>
                    <p className="text-sm font-mono text-muted-foreground">{server.url}</p>
                    {testResult && testResult.connected && (
                      <p className="text-xs text-green-600">{t('mcp.connected', '连接成功')} - {testResult.tools.length} {t('mcp.toolsAvailable', '个工具')}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
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
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('mcp.availableTools', '可用工具')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tools.map((tool: any, i: number) => (
                <div key={i} className="text-sm">
                  <strong>{tool.name}</strong>
                  {tool.description && <p className="text-muted-foreground text-xs">{tool.description}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default McpManagement
