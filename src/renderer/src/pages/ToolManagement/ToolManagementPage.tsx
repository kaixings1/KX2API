import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Trash2, Edit3, Save, X, RotateCcw,
  Wrench, FolderOpen, Lightbulb, Check, Search, RefreshCw, Download, Upload, ArrowRight,
} from 'lucide-react'
import { ImportExportDialog, ManagementToolbar } from '@/components/management'

// ==================== Types ====================

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

interface HintRule {
  id: string
  name: string
  description: string
  patterns: string[]
  groupIds: string[]
  priority: number
  enabled: boolean
  builtin: boolean
}

// ==================== Component ====================

export function ToolManagementPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tools, setTools] = useState<ToolDef[]>([])
  const [groups, setGroups] = useState<ToolGroup[]>([])
  const [hintRules, setHintRules] = useState<HintRule[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  // Tool form
  const [editingTool, setEditingTool] = useState<string | null>(null)
  const [toolForm, setToolForm] = useState({ name: '', displayName: '', description: '', usage: '', platform: 'all' as string, tags: '' })

  // Group form
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '', description: '', toolIds: '' })

  // Hint rule form
  const [editingRule, setEditingRule] = useState<string | null>(null)
  const [ruleForm, setRuleForm] = useState({ name: '', description: '', patterns: '', groupIds: '', priority: 10 })

  // Hint match test
  const [hintInput, setHintInput] = useState('')
  const [hintResult, setHintResult] = useState<{ groups: ToolGroup[]; tools: ToolDef[] } | null>(null)

  const api = window.electronAPI.tools

  // ==================== Load ====================

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getAll()
      if (res.success && res.data) {
        setTools(res.data.tools)
        setGroups(res.data.groups)
        setHintRules(res.data.hintRules)
      }
    } catch (e) {
      console.error('[ToolManagement] Failed to load:', e)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { loadAll() }, [loadAll])

  // ==================== Helpers ====================

  const showMsg = (text: string) => { setMessage(text); setTimeout(() => setMessage(''), 3000) }

  // ==================== Tool CRUD ====================

  const handleAddTool = async () => {
    if (!toolForm.name || !toolForm.displayName) return
    const res = await api.add({
      name: toolForm.name,
      displayName: toolForm.displayName,
      description: toolForm.description,
      usage: toolForm.usage,
      platform: toolForm.platform,
      tags: toolForm.tags.split(',').map(s => s.trim()).filter(Boolean),
      enabled: true,
    })
    if (res.success) { showMsg('工具已添加'); setToolForm({ name: '', displayName: '', description: '', usage: '', platform: 'all', tags: '' }); loadAll() }
  }

  const handleUpdateTool = async (id: string) => {
    const res = await api.update(id, toolForm)
    if (res.success) { showMsg('工具已更新'); setEditingTool(null); loadAll() }
  }

  const handleRemoveTool = async (id: string) => {
    if (!confirm('确定删除此工具?')) return
    const res = await api.remove(id)
    if (res.success) { showMsg('工具已删除'); loadAll() }
  }

  const handleToggleTool = async (id: string) => {
    const res = await api.toggle(id)
    if (res.success) loadAll()
  }

  // ==================== Group CRUD ====================

  const handleAddGroup = async () => {
    if (!groupForm.name) return
    const res = await api.addGroup({
      name: groupForm.name,
      description: groupForm.description,
      toolIds: groupForm.toolIds.split(',').map(s => s.trim()).filter(Boolean),
      enabled: true,
    })
    if (res.success) { showMsg('分组已添加'); setGroupForm({ name: '', description: '', toolIds: '' }); loadAll() }
  }

  const handleUpdateGroup = async (id: string) => {
    const res = await api.updateGroup(id, groupForm)
    if (res.success) { showMsg('分组已更新'); setEditingGroup(null); loadAll() }
  }

  const handleRemoveGroup = async (id: string) => {
    if (!confirm('确定删除此分组?')) return
    const res = await api.removeGroup(id)
    if (res.success) { showMsg('分组已删除'); loadAll() }
  }

  // ==================== Hint Rule CRUD ====================

  const handleAddRule = async () => {
    if (!ruleForm.name || !ruleForm.patterns) return
    const res = await api.addHintRule({
      name: ruleForm.name,
      description: ruleForm.description,
      patterns: ruleForm.patterns.split('\n').map(s => s.trim()).filter(Boolean),
      groupIds: ruleForm.groupIds.split(',').map(s => s.trim()).filter(Boolean),
      priority: ruleForm.priority,
      enabled: true,
    })
    if (res.success) { showMsg('规则已添加'); setRuleForm({ name: '', description: '', patterns: '', groupIds: '', priority: 10 }); loadAll() }
  }

  const handleUpdateRule = async (id: string) => {
    const res = await api.updateHintRule(id, ruleForm)
    if (res.success) { showMsg('规则已更新'); setEditingRule(null); loadAll() }
  }

  const handleRemoveRule = async (id: string) => {
    if (!confirm('确定删除此规则?')) return
    const res = await api.removeHintRule(id)
    if (res.success) { showMsg('规则已删除'); loadAll() }
  }

  // ==================== Hint Match ====================

  const handleMatchHints = async () => {
    const res = await api.matchHints(hintInput)
    if (res.success && res.data) {
      const matchedGroups = res.data.groups.map((g: any) => groups.find((g2: ToolGroup) => g2.id === g.id)!).filter(Boolean)
      const matchedTools = res.data.tools
      setHintResult({ groups: matchedGroups, tools: matchedTools })
    }
  }

  // ==================== Reset ====================

  const handleReset = async () => {
    if (!confirm('确定重置为默认工具配置? 自定义工具和规则将被删除。')) return
    const res = await api.reset()
    if (res.success) { showMsg('已重置为默认'); loadAll() }
  }

  // ==================== Import/Export ====================

  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export' | 'backup' | 'restore'>('export')

  const handleExport = async () => {
    try {
      const res = await window.electronAPI.mgmt.export('tools', { tools: filteredTools, groups, hintRules: filteredRules })
      if (res.success) {
        const blob = new Blob([JSON.stringify({ tools: filteredTools, groups, hintRules: filteredRules }, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tools_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  const handleImport = async (jsonData: string) => {
    try {
      const res = await window.electronAPI.mgmt.import('tools', jsonData)
      if (res.success && res.data) {
        const data = Array.isArray(res.data) ? res.data : []
        for (const item of data) {
          if (item?.name) {
            await api.add({ name: item.name, displayName: item.displayName || item.name, description: item.description || '', usage: item.usage || '', platform: item.platform || 'all', tags: item.tags || [], enabled: true })
          }
        }
        loadAll()
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
        const blob = new Blob([JSON.stringify({ tools: { tools: filteredTools, groups, hintRules: filteredRules } }, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tools_backup_${new Date().toISOString().slice(0, 10)}.json`
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
      const items = Array.isArray(data) ? data : (data.tools?.tools || data['tools'] || [])
      if (!Array.isArray(items)) return { success: false, error: '数据格式错误' }
      for (const item of items) {
        if (item?.name) {
          await api.add({ name: item.name, displayName: item.displayName || item.name, description: item.description || '', usage: item.usage || '', platform: item.platform || 'all', tags: item.tags || [], enabled: true })
        }
      }
      loadAll()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  // ==================== Render ====================

  const filteredTools = tools.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.displayName.toLowerCase().includes(search.toLowerCase()))
  const filteredGroups = groups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.description.toLowerCase().includes(search.toLowerCase()))
  const filteredRules = hintRules.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <ManagementToolbar
        title={t('tools.title', '工具管理')}
        subtitle={t('tools.description', '管理内置工具、分组和提示规则')}
        onRefresh={loadAll}
        onExport={() => { setIoMode('export'); setIoOpen(true) }}
        onImport={() => { setIoMode('import'); setIoOpen(true) }}
        onBackup={() => { setIoMode('backup'); setIoOpen(true) }}
        onRestore={() => { setIoMode('restore'); setIoOpen(true) }}
        filters={{ search }}
        onFiltersChange={(f) => setSearch(f.search || '')}
        totalCount={tools.length}
        filteredCount={filteredTools.length}
        isLoading={loading}
        extraActions={
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" /> 重置默认
          </Button>
        }
      />

      <ImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        mode={ioMode}
        title="工具管理"
        description={ioMode === 'export' ? '导出工具、分组和规则配置' : ioMode === 'import' ? '导入工具配置' : ioMode === 'backup' ? '备份所有工具数据' : '从备份恢复工具数据'}
        data={{ tools: filteredTools, groups, hintRules: filteredRules }}
        onExport={handleExport}
        onImport={handleImport}
        onBackup={handleBackup}
        onRestore={handleRestore}
      />

      {message && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 px-3 py-2 rounded">
          <Check className="w-4 h-4" /> {message}
        </div>
      )}

      {loading ? (
        <div className="text-center text-[var(--text-muted)] py-12">加载中...</div>
      ) : (
        <Tabs defaultValue="tools" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tools"><Wrench className="w-4 h-4 mr-1" /> 工具列表 ({filteredTools.length})</TabsTrigger>
            <TabsTrigger value="groups"><FolderOpen className="w-4 h-4 mr-1" /> 分组管理 ({filteredGroups.length})</TabsTrigger>
            <TabsTrigger value="hints"><Lightbulb className="w-4 h-4 mr-1" /> 提示规则 ({filteredRules.length})</TabsTrigger>
            <TabsTrigger value="test"><Search className="w-4 h-4 mr-1" /> 规则测试</TabsTrigger>
          </TabsList>

          {/* ========== Tools Tab ========== */}
          <TabsContent value="tools" className="space-y-4">
            {/* Add form */}
            <Card>
              <CardHeader><CardTitle className="text-sm">添加自定义工具</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>名称 *</Label><Input value={toolForm.name} onChange={e => setToolForm(p => ({ ...p, name: e.target.value }))} placeholder="my-tool" /></div>
                  <div><Label>显示名称 *</Label><Input value={toolForm.displayName} onChange={e => setToolForm(p => ({ ...p, displayName: e.target.value }))} placeholder="我的工具" /></div>
                  <div className="col-span-2"><Label>描述</Label><Input value={toolForm.description} onChange={e => setToolForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <div><Label>用法</Label><Input value={toolForm.usage} onChange={e => setToolForm(p => ({ ...p, usage: e.target.value }))} placeholder="/my-tool" /></div>
                  <div><Label>平台</Label>
                    <select className="w-full text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5" value={toolForm.platform} onChange={e => setToolForm(p => ({ ...p, platform: e.target.value }))}>
                      <option value="all">全部</option><option value="windows">Windows</option><option value="unix">Unix</option>
                    </select>
                  </div>
                  <div className="col-span-2"><Label>标签 (逗号分隔)</Label><Input value={toolForm.tags} onChange={e => setToolForm(p => ({ ...p, tags: e.target.value }))} placeholder="file, search" /></div>
                  <div className="col-span-2"><Button onClick={handleAddTool} size="sm"><Plus className="w-4 h-4 mr-1" /> 添加工具</Button></div>
                </div>
              </CardContent>
            </Card>

            {/* Tool list */}
            <div className="space-y-2">
              {filteredTools.length === 0 ? (
                <Card><CardContent className="py-6 text-center text-xs text-[var(--text-muted)]">没有匹配的工具</CardContent></Card>
              ) : filteredTools.map(tool => (
                <Card key={tool.id} className="cursor-pointer hover:border-[var(--accent-primary)] transition-colors" onClick={() => navigate(`/tools/${tool.id}`)}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <Switch checked={tool.enabled} onCheckedChange={() => handleToggleTool(tool.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">/{tool.name}</span>
                        <span className="text-xs text-[var(--text-muted)]">{tool.displayName}</span>
                        {tool.builtin && <Badge variant="secondary" className="text-[10px]">内置</Badge>}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">{tool.description}</p>
                      <div className="flex gap-1 mt-1">
                        {tool.tags.map(tag => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {editingTool === tool.id ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateTool(tool.id)}><Save className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTool(null)}><X className="w-3 h-3" /></Button>
                        </>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingTool(tool.id); setToolForm({ name: tool.name, displayName: tool.displayName, description: tool.description, usage: tool.usage, platform: tool.platform, tags: tool.tags.join(', ') }) }}><Edit3 className="w-3 h-3" /></Button>
                      )}
                      {!tool.builtin && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => handleRemoveTool(tool.id)}><Trash2 className="w-3 h-3" /></Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ========== Groups Tab ========== */}
          <TabsContent value="groups" className="space-y-4">
            {/* Add form */}
            <Card>
              <CardHeader><CardTitle className="text-sm">添加分组</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>组名称 *</Label><Input value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} placeholder="文件操作" /></div>
                  <div><Label>工具 ID (逗号分隔)</Label><Input value={groupForm.toolIds} onChange={e => setGroupForm(p => ({ ...p, toolIds: e.target.value }))} placeholder="ls, dir, cat" /></div>
                  <div className="col-span-2"><Label>描述</Label><Input value={groupForm.description} onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <div className="col-span-2"><Button onClick={handleAddGroup} size="sm"><Plus className="w-4 h-4 mr-1" /> 添加分组</Button></div>
                </div>
              </CardContent>
            </Card>

            {/* Group list */}
            <div className="grid gap-3">
              {filteredGroups.map(group => (
                <Card key={group.id}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{group.name}</span>
                        {group.builtin && <Badge variant="secondary" className="text-[10px]">内置</Badge>}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{group.description}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {group.toolIds.map(tid => (
                          <Badge key={tid} variant="outline" className="text-[10px]">/{tid}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {editingGroup === group.id ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateGroup(group.id)}><Save className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingGroup(null)}><X className="w-3 h-3" /></Button>
                        </>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingGroup(group.id); setGroupForm({ name: group.name, description: group.description, toolIds: group.toolIds.join(', ') }) }}><Edit3 className="w-3 h-3" /></Button>
                      )}
                      {!group.builtin && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => handleRemoveGroup(group.id)}><Trash2 className="w-3 h-3" /></Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ========== Hint Rules Tab ========== */}
          <TabsContent value="hints" className="space-y-4">
            {/* Add form */}
            <Card>
              <CardHeader><CardTitle className="text-sm">添加提示规则</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>规则名称 *</Label><Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div><Label>优先级</Label><Input type="number" value={ruleForm.priority} onChange={e => setRuleForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} /></div>
                  <div className="col-span-2"><Label>描述</Label><Input value={ruleForm.description} onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <div className="col-span-2"><Label>匹配模式 (正则表达式，每行一个)</Label><Textarea value={ruleForm.patterns} onChange={e => setRuleForm(p => ({ ...p, patterns: e.target.value }))} rows={2} placeholder="查看.*文件\n搜索.*内容" /></div>
                  <div className="col-span-2"><Label>推荐组 ID (逗号分隔)</Label><Input value={ruleForm.groupIds} onChange={e => setRuleForm(p => ({ ...p, groupIds: e.target.value }))} placeholder="file-system, text-search" /></div>
                  <div className="col-span-2"><Button onClick={handleAddRule} size="sm"><Plus className="w-4 h-4 mr-1" /> 添加规则</Button></div>
                </div>
              </CardContent>
            </Card>

            {/* Rule list */}
            <div className="space-y-2">
              {filteredRules.map(rule => (
                <Card key={rule.id}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rule.name}</span>
                        <Badge variant="secondary" className="text-[10px]">P:{rule.priority}</Badge>
                        {rule.builtin && <Badge variant="secondary" className="text-[10px]">内置</Badge>}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{rule.description}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {rule.patterns.map(p => <code key={p} className="text-[10px] text-[var(--text-primary)] bg-[var(--bg-tertiary)] px-1 rounded">{p}</code>)}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {rule.groupIds.map(gid => <Badge key={gid} variant="outline" className="text-[10px]">{gid}</Badge>)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {editingRule === rule.id ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateRule(rule.id)}><Save className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingRule(null)}><X className="w-3 h-3" /></Button>
                        </>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingRule(rule.id); setRuleForm({ name: rule.name, description: rule.description, patterns: rule.patterns.join('\n'), groupIds: rule.groupIds.join(','), priority: rule.priority }) }}><Edit3 className="w-3 h-3" /></Button>
                      )}
                      {!rule.builtin && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => handleRemoveRule(rule.id)}><Trash2 className="w-3 h-3" /></Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ========== Test Tab ========== */}
          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">提示规则测试</CardTitle>
                <CardDescription className="text-xs">输入一段文本，查看匹配到的工具组和工具</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={hintInput} onChange={e => setHintInput(e.target.value)} placeholder="输入测试文本，例如：查看文件夹下的文件" className="flex-1" />
                  <Button onClick={handleMatchHints}><Search className="w-4 h-4 mr-1" /> 匹配</Button>
                </div>
                {hintResult && (
                  <div className="space-y-3">
                    {hintResult.groups.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1">匹配的分组：</p>
                        <div className="flex gap-2 flex-wrap">
                          {hintResult.groups.map(g => (
                            <Badge key={g.id} className="bg-[var(--accent-primary)]">{g.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {hintResult.tools.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1">推荐的工具：</p>
                        <div className="flex gap-2 flex-wrap">
                          {hintResult.tools.map(t => (
                            <Badge key={t.id} variant="outline">/{t.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {hintResult.groups.length === 0 && hintResult.tools.length === 0 && (
                      <p className="text-sm text-[var(--text-muted)]">未匹配到任何工具组</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default ToolManagementPage
