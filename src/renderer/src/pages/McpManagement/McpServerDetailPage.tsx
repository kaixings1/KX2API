import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { BackButton } from '@/components/ui/back-button'
import { Trash2, Loader2, TestTube2 } from 'lucide-react'

const mcpApi = window.electronAPI.mcp

const TRANSPORT_MAP: Record<string, string> = {
  stdio: 'stdio',
  sse: 'SSE',
  http: 'HTTP',
}

interface McpServerDetail {
  id: string
  name: string
  url: string
  command: string
  args: string[]
  env: Record<string, string>
  transport: 'stdio' | 'sse' | 'http'
  enabled: boolean
}

export function McpServerDetailPage() {
  useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [server, setServer] = useState<McpServerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editCommand, setEditCommand] = useState('')
  const [editArgsText, setEditArgsText] = useState('')
  const [editEnvText, setEditEnvText] = useState('')
  const [editTransport, setEditTransport] = useState<'stdio' | 'sse' | 'http'>('stdio')
  const [testResult, setTestResult] = useState<{ success: boolean; connected: boolean; tools: any[] } | null>(null)

  const loadServer = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setTestResult(null)
    try {
      const res = await mcpApi.getServerById(id)
      if (res) {
        setServer(res)
        setEditName(res.name)
        setEditUrl(res.url || '')
        setEditCommand(res.command || '')
        setEditArgsText((res.args || []).join(' '))
        setEditEnvText(res.env ? JSON.stringify(res.env) : '')
        setEditTransport(res.transport)
      }
    } catch (e) {
      console.error('[McpServerDetail] Failed to load:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadServer() }, [loadServer])

  const handleSave = async () => {
    if (!id || !server) return
    const args = editArgsText.split(' ').filter(Boolean)
    let env: Record<string, string> = {}
    try { env = JSON.parse(editEnvText || '{}') } catch { env = {} }
    const serverData: any = { name: editName, url: editUrl, transport: editTransport, enabled: server.enabled }
    if (editCommand) serverData.command = editCommand
    if (args.length > 0) serverData.args = args
    if (Object.keys(env).length > 0) serverData.env = env

    const configRes = await mcpApi.getConfig()
    const config = configRes?.config || { servers: [] }
    const newServers = config.servers.map((s: McpServerDetail) => s.id === id ? { ...s, ...serverData } : s)
    await mcpApi.updateConfig({ servers: newServers })
    setEditOpen(false)
    loadServer()
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('确定删除此 MCP 服务器?')) return
    await mcpApi.removeServer(id)
    navigate('/mcp')
  }

  const handleTest = async () => {
    if (!server) return
    setTestResult(null)
    const res = await mcpApi.testConnection(server)
    if (res.success) {
      setTestResult({ success: true, connected: res.connected, tools: res.tools })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!server) {
    return (
      <div className="space-y-4">
        <BackButton to="/mcp" label="返回列表" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            MCP 服务器不存在或已被删除
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'MCP 管理', href: '/mcp' },
        { label: server.name },
      ]} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/mcp" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{server.name}</h2>
            <p className="text-muted-foreground text-sm">ID: {server.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>编辑</Button>
          <Button variant="outline" size="sm" onClick={handleTest}>
            <TestTube2 className="h-3 w-3 mr-1" /> 测试连接
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">连接信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">名称</span>
              <span>{server.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">传输方式</span>
              <Badge variant="outline">{TRANSPORT_MAP[server.transport] || server.transport}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">状态</span>
              <Badge variant={server.enabled ? 'default' : 'secondary'}>
                {server.enabled ? '启用' : '禁用'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">端点信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {server.url && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">URL</span>
                <span className="font-mono text-xs">{server.url}</span>
              </div>
            )}
            {server.command && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Command</span>
                <span className="font-mono text-xs">{server.command} {server.args?.join(' ')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {server.env && Object.keys(server.env).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">环境变量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(server.env).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm font-mono">
                  <span className="text-muted-foreground">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">连接测试</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-sm ${testResult.connected ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.connected ? '连接成功' : '连接失败'} - {testResult.tools.length} 个可用工具
            </p>
            {testResult.tools.length > 0 && (
              <div className="mt-2 space-y-1">
                {testResult.tools.map((tool: any, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">{tool.name}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 MCP 服务器</DialogTitle>
            <DialogDescription>修改服务器配置</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} />
            </div>
            <div>
              <Label>Command</Label>
              <Input value={editCommand} onChange={e => setEditCommand(e.target.value)} />
            </div>
            <div>
              <Label>Args (空格分隔)</Label>
              <Input value={editArgsText} onChange={e => setEditArgsText(e.target.value)} />
            </div>
            <div>
              <Label>Env (JSON)</Label>
              <Input value={editEnvText} onChange={e => setEditEnvText(e.target.value)} />
            </div>
            <div>
              <Label>传输方式</Label>
              <Select value={editTransport} onValueChange={v => setEditTransport(v as 'stdio' | 'sse' | 'http')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">stdio</SelectItem>
                  <SelectItem value="sse">SSE</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="w-full">保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default McpServerDetailPage
