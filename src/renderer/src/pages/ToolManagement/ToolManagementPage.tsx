import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { SectionCard } from '@/components/ui/section-card'
import { Card, CardContent } from '@/components/ui/card'
import {
  Plus, Trash2, Edit3, Save, X, RotateCcw,
  Wrench, FolderOpen, Lightbulb, Check, Search, RefreshCw, Download, Upload, ArrowRight, Info,
} from 'lucide-react'
import { ImportExportDialog, ManagementToolbar } from '@/components/management'
import { ToolGroupsPanel } from './ToolGroupsPanel'
import { ParameterEditor, type ToolParameter } from './ParameterEditor'
import { ToolDef, ToolGroup, HintRule } from '@/types/tools'
import { useToast } from '@/hooks/use-toast'

// ==================== Component ====================

export function ToolManagementPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [tools, setTools] = useState<ToolDef[]>([])
  const [groups, setGroups] = useState<ToolGroup[]>([])
  const [hintRules, setHintRules] = useState<HintRule[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [activeIds, setActiveIds] = useState<string[]>([])

  // Tool form
  const [editingTool, setEditingTool] = useState<string | null>(null)
  const [toolForm, setToolForm] = useState<{ name: string; displayName: string; description: string; usage: string; platform: string; tags: string; parameters: ToolParameter[] }>({ name: '', displayName: '', description: '', usage: '', platform: 'all', tags: '', parameters: [] })

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

  // ==================== Helpers ====================

  const isPlatformMatch = (platform: string): boolean => {
    const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')
    if (!platform || platform === 'all') return true
    if (platform === 'windows') return isWindows
    if (platform === 'unix') return !isWindows
    return true
  }

  const showMsg = (text: string) => {
    setMessage(text)
    toast({ title: text })
    setTimeout(() => setMessage(''), 3000)
  }
  const showError = (text: string) => {
    toast({ title: text, variant: 'destructive' })
  }

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

  // 读取当前生效组
  useEffect(() => {
    (async () => {
      try {
        const cfg = await window.electronAPI.config.get()
        setActiveIds((cfg as { enabledToolGroups?: string[] }).enabledToolGroups || [])
      } catch { /* ignore */ }
    })()
  }, [loading])

  // ==================== Tool CRUD ====================

  const handleAddTool = async () => {
    if (!toolForm.name || !toolForm.displayName) return
    try {
      const res = await api.add({
        name: toolForm.name,
        displayName: toolForm.displayName,
        description: toolForm.description,
        usage: toolForm.usage,
        platform: toolForm.platform,
        parameters: toolForm.parameters.filter(p => p.name.trim().length > 0),
        tags: toolForm.tags.split(',').map(s => s.trim()).filter(Boolean),
        enabled: true,
      })
      if (res.success) {
        showMsg(t('tools.toolAdded', '工具已添加'))
        setToolForm({ name: '', displayName: '', description: '', usage: '', platform: 'all', tags: '', parameters: [] })
        // 乐观添加
        if (res.data) setTools(prev => [...prev, res.data!])
      } else {
        showError(t('tools.addFailed', '添加失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Add tool failed:', e)
      showError(t('tools.addFailed', '添加失败'))
    }
  }

  const handleUpdateTool = async (id: string) => {
    try {
      const res = await api.update(id, toolForm)
      if (res.success) {
        showMsg(t('tools.toolUpdated', '工具已更新'))
        setEditingTool(null)
        // 乐观更新
        if (res.data) setTools(prev => prev.map(t => t.id === id ? res.data! : t))
      } else {
        showError(t('tools.updateFailed', '更新失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Update tool failed:', e)
      showError(t('tools.updateFailed', '更新失败'))
    }
  }

  const handleRemoveTool = async (id: string) => {
    if (!confirm(t('tools.confirmDelete', '确定删除此工具?'))) return
    try {
      const res = await api.remove(id)
      if (res.success) {
        showMsg(t('tools.toolDeleted', '工具已删除'))
        setTools(prev => prev.filter(t => t.id !== id))
      } else {
        showError(t('tools.deleteFailed', '删除失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Remove tool failed:', e)
      showError(t('tools.deleteFailed', '删除失败'))
    }
  }

  const handleToggleTool = async (id: string) => {
    try {
      const res = await api.toggle(id)
      if (res.success) {
        // 乐观更新：直接在本地切换状态，不刷新全页面
        setTools(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t))
      } else {
        showError(t('tools.toggleFailed', '切换状态失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Toggle tool failed:', e)
      showError(t('tools.toggleFailed', '切换状态失败'))
    }
  }

  // ==================== Group CRUD ====================

  const handleAddGroup = async () => {
    if (!groupForm.name) return
    try {
      const res = await api.addGroup({
        name: groupForm.name,
        description: groupForm.description,
        toolIds: groupForm.toolIds.split(',').map(s => s.trim()).filter(Boolean),
        enabled: true,
      })
      if (res.success) {
        showMsg(t('tools.groupAdded', '分组已添加'))
        setGroupForm({ name: '', description: '', toolIds: '' })
        if (res.data) setGroups(prev => [...prev, res.data!])
      } else {
        showError(t('tools.addGroupFailed', '添加分组失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Add group failed:', e)
      showError(t('tools.addGroupFailed', '添加分组失败'))
    }
  }

  const handleUpdateGroup = async (id: string) => {
    try {
      const res = await api.updateGroup(id, groupForm)
      if (res.success) {
        showMsg(t('tools.groupUpdated', '分组已更新'))
        setEditingGroup(null)
        if (res.data) setGroups(prev => prev.map(g => g.id === id ? res.data! : g))
      } else {
        showError(t('tools.updateGroupFailed', '更新分组失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Update group failed:', e)
      showError(t('tools.updateGroupFailed', '更新分组失败'))
    }
  }

  const handleRemoveGroup = async (id: string) => {
    if (!confirm(t('tools.confirmDeleteGroup', '确定删除此分组?'))) return
    try {
      const res = await api.removeGroup(id)
      if (res.success) {
        showMsg(t('tools.groupDeleted', '分组已删除'))
        setGroups(prev => prev.filter(g => g.id !== id))
      } else {
        showError(t('tools.deleteGroupFailed', '删除分组失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Remove group failed:', e)
      showError(t('tools.deleteGroupFailed', '删除分组失败'))
    }
  }

  // ==================== Hint Rule CRUD ====================

  const handleAddRule = async () => {
    if (!ruleForm.name || !ruleForm.patterns) return
    try {
      const res = await api.addHintRule({
        name: ruleForm.name,
        description: ruleForm.description,
        patterns: ruleForm.patterns.split('\n').map(s => s.trim()).filter(Boolean),
        groupIds: ruleForm.groupIds.split(',').map(s => s.trim()).filter(Boolean),
        priority: ruleForm.priority,
        enabled: true,
      })
      if (res.success) {
        showMsg(t('tools.ruleAdded', '规则已添加'))
        setRuleForm({ name: '', description: '', patterns: '', groupIds: '', priority: 10 })
        if (res.data) setHintRules(prev => [...prev, res.data!])
      } else {
        showError(t('tools.addRuleFailed', '添加规则失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Add rule failed:', e)
      showError(t('tools.addRuleFailed', '添加规则失败'))
    }
  }

  const handleUpdateRule = async (id: string) => {
    try {
      const res = await api.updateHintRule(id, ruleForm)
      if (res.success) {
        showMsg(t('tools.ruleUpdated', '规则已更新'))
        setEditingRule(null)
        if (res.data) setHintRules(prev => prev.map(r => r.id === id ? res.data! : r))
      } else {
        showError(t('tools.updateRuleFailed', '更新规则失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Update rule failed:', e)
      showError(t('tools.updateRuleFailed', '更新规则失败'))
    }
  }

  const handleRemoveRule = async (id: string) => {
    if (!confirm(t('tools.confirmDeleteRule', '确定删除此规则?'))) return
    try {
      const res = await api.removeHintRule(id)
      if (res.success) {
        showMsg(t('tools.ruleDeleted', '规则已删除'))
        setHintRules(prev => prev.filter(r => r.id !== id))
      } else {
        showError(t('tools.deleteRuleFailed', '删除规则失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Remove rule failed:', e)
      showError(t('tools.deleteRuleFailed', '删除规则失败'))
    }
  }

  // ==================== Hint Match ====================

  const handleMatchHints = async () => {
    try {
      const res = await api.matchHints(hintInput)
      if (res.success && res.data) {
        const matchedGroups = res.data.groups.map((g: any) => groups.find((g2: ToolGroup) => g2.id === g.id)!).filter(Boolean)
        const matchedTools = res.data.tools
        setHintResult({ groups: matchedGroups, tools: matchedTools })
      } else {
        showError(t('tools.matchFailed', '匹配失败'))
      }
    } catch (e) {
      console.error('[ToolManagement] Match hints failed:', e)
      showError(t('tools.matchFailed', '匹配失败'))
    }
  }

  // ==================== Reset ====================

  const handleReset = async () => {
    if (!confirm(t('tools.confirmReset', '确定重置为默认工具配置? 自定义工具和规则将被删除。'))) return
    try {
      const res = await api.reset()
      if (res.success) { showMsg(t('tools.resetDone', '已重置为默认')); loadAll() }
      else { showError(t('tools.resetFailed', '重置失败')) }
    } catch (e) {
      console.error('[ToolManagement] Reset failed:', e)
      showError(t('tools.resetFailed', '重置失败'))
    }
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
      } else {
        showError(t('tools.exportFailed', '导出失败'))
      }
    } catch (e) {
      console.error('Export failed:', e)
      showError(t('tools.exportFailed', '导出失败'))
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
            <RotateCcw className="w-4 h-4 mr-1" /> {t('tools.resetDefault', '重置默认')}
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

      {/* Help Card */}
      <SectionCard title={t('tools.pageHelpTitle', '关于工具')} icon={Info}>
        <p className="text-xs text-[var(--text-dim)] leading-relaxed">
          {t('tools.pageHelp', '管理工具列表、分组和提示规则。工具决定 Agent 可以调用哪些能力，分组用于组织相关工具，提示规则根据用户输入自动匹配工具组。')}
        </p>
      </SectionCard>

      {/* 生效组：决定实际发给模型的工具有哪些（改完下一条消息立即生效） */}
      {!loading && (
        <ToolGroupsPanel tools={tools} groups={groups} onChanged={loadAll} />
      )}

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
            <TabsTrigger value="tools"><Wrench className="w-4 h-4 mr-1" /> {t('tools.toolList', '工具列表')} ({filteredTools.length})</TabsTrigger>
            <TabsTrigger value="groups"><FolderOpen className="w-4 h-4 mr-1" /> {t('tools.groupManagement', '分组管理')} ({filteredGroups.length})</TabsTrigger>
            <TabsTrigger value="hints"><Lightbulb className="w-4 h-4 mr-1" /> {t('tools.hintRules', '提示规则')} ({filteredRules.length})</TabsTrigger>
            <TabsTrigger value="test"><Search className="w-4 h-4 mr-1" /> {t('tools.ruleTest', '规则测试')}</TabsTrigger>
          </TabsList>

          {/* ========== Tools Tab ========== */}
          <TabsContent value="tools" className="space-y-4">
            {/* Add form */}
            <SectionCard title={t('tools.addTool', '添加自定义工具')}>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('tools.nameLabel', '名称')} *</Label><Input value={toolForm.name} onChange={e => setToolForm(p => ({ ...p, name: e.target.value }))} placeholder="my-tool" /></div>
                <div><Label>{t('tools.displayNameLabel', '显示名称')} *</Label><Input value={toolForm.displayName} onChange={e => setToolForm(p => ({ ...p, displayName: e.target.value }))} placeholder={t('tools.displayNamePlaceholder', '我的工具')} /></div>
                <div className="col-span-2"><Label>{t('tools.descriptionLabel', '描述')}</Label><Input value={toolForm.description} onChange={e => setToolForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div><Label>{t('tools.usageLabel', '用法')}</Label><Input value={toolForm.usage} onChange={e => setToolForm(p => ({ ...p, usage: e.target.value }))} placeholder="/my-tool" /></div>
                <div><Label>{t('tools.platformLabel', '平台')}</Label>
                  <select className="w-full text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5" value={toolForm.platform} onChange={e => setToolForm(p => ({ ...p, platform: e.target.value }))}>
                    <option value="all">全部</option><option value="windows">Windows</option><option value="unix">Unix</option>
                  </select>
                </div>
                <div className="col-span-2"><Label>{t('tools.tagsLabel', '标签 (逗号分隔)')}</Label><Input value={toolForm.tags} onChange={e => setToolForm(p => ({ ...p, tags: e.target.value }))} placeholder="file, search" /></div>
                <div className="col-span-2">
                  <Label>{t('tools.parametersLabel', '参数 (JSON Schema)')}</Label>
                  <ParameterEditor value={toolForm.parameters} onChange={params => setToolForm(p => ({ ...p, parameters: params }))} />
                </div>
                <div className="col-span-2"><Button onClick={handleAddTool} size="sm"><Plus className="w-4 h-4 mr-1" /> {t('tools.addToolBtn', '添加工具')}</Button></div>
              </div>
            </SectionCard>

            {/* Tool list */}
            <div className="space-y-2">
              {filteredTools.length === 0 ? (
                <SectionCard>
                  <p className="py-6 text-center text-xs text-[var(--text-muted)]">{t('tools.noMatch', '没有匹配的工具')}</p>
                </SectionCard>
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
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingTool(tool.id); setToolForm({ name: tool.name, displayName: tool.displayName, description: tool.description, usage: tool.usage, platform: tool.platform, tags: tool.tags.join(', '), parameters: tool.parameters || [] }) }}><Edit3 className="w-3 h-3" /></Button>
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
            <SectionCard title={t('tools.addGroup', '添加分组')}>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('tools.groupNameLabel', '组名称')} *</Label><Input value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} placeholder={t('tools.groupNamePlaceholder', '文件操作')} /></div>
                <div><Label>{t('tools.toolIdsLabel', '工具 ID (逗号分隔)')}</Label><Input value={groupForm.toolIds} onChange={e => setGroupForm(p => ({ ...p, toolIds: e.target.value }))} placeholder="ls, dir, cat" /></div>
                <div className="col-span-2"><Label>{t('tools.descriptionLabel', '描述')}</Label><Input value={groupForm.description} onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div className="col-span-2"><Button onClick={handleAddGroup} size="sm"><Plus className="w-4 h-4 mr-1" /> {t('tools.addGroupBtn', '添加分组')}</Button></div>
              </div>
            </SectionCard>

            {/* Group list */}
            <div className="grid gap-3">
              {filteredGroups.map(group => {
                const isActive = activeIds.includes(group.id)
                const groupTools = group.toolIds.map(tid => tools.find(t => t.id === tid || t.name === tid)).filter(Boolean) as ToolDef[]
                const enabledCount = groupTools.filter(t => t.enabled && isPlatformMatch(t.platform)).length
                return (
                <Card key={group.id} className={isActive ? 'border-[var(--accent-primary)]' : ''}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{group.name}</span>
                        {group.builtin && <Badge variant="secondary" className="text-[10px]">内置</Badge>}
                        {isActive && <Badge className="text-[10px] bg-[var(--accent-primary)]">{t('tools.activeGroup', '生效中')}</Badge>}
                        <span className="text-[10px] text-[var(--text-muted)]">{enabledCount}/{group.toolIds.length} 可用</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{group.description}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {groupTools.slice(0, 20).map(t => (
                          <Badge key={t.id} variant={t.enabled ? 'outline' : 'secondary'} className="text-[10px]">
                            /{t.name} {t.enabled ? '' : '🔴'}
                          </Badge>
                        ))}
                        {groupTools.length > 20 && <span className="text-[10px] text-[var(--text-muted)]">+{groupTools.length - 20}</span>}
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
                )
              })}
            </div>
          </TabsContent>

          {/* ========== Hint Rules Tab ========== */}
          <TabsContent value="hints" className="space-y-4">
            {/* Add form */}
            <SectionCard title={t('tools.addHintRule', '添加提示规则')}>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('tools.ruleNameLabel', '规则名称')} *</Label><Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>{t('tools.priorityLabel', '优先级')}</Label><Input type="number" value={ruleForm.priority} onChange={e => setRuleForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} /></div>
                <div className="col-span-2"><Label>{t('tools.descriptionLabel', '描述')}</Label><Input value={ruleForm.description} onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))} /></div>
                <div className="col-span-2"><Label>{t('tools.patternsLabel', '匹配模式 (正则表达式，每行一个)')}</Label><Textarea value={ruleForm.patterns} onChange={e => setRuleForm(p => ({ ...p, patterns: e.target.value }))} rows={2} placeholder="查看.*文件\n搜索.*内容" /></div>
                <div className="col-span-2"><Label>{t('tools.recommendGroupLabel', '推荐组 ID (逗号分隔)')}</Label><Input value={ruleForm.groupIds} onChange={e => setRuleForm(p => ({ ...p, groupIds: e.target.value }))} placeholder="file-system, text-search" /></div>
                <div className="col-span-2"><Button onClick={handleAddRule} size="sm"><Plus className="w-4 h-4 mr-1" /> {t('tools.addRuleBtn', '添加规则')}</Button></div>
              </div>
            </SectionCard>

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
            <SectionCard title={t('tools.ruleTestTitle', '提示规则测试')}>
              <p className="text-xs text-[var(--text-dim)] leading-relaxed mb-3">
                {t('tools.ruleTestDesc', '输入一段文本，查看匹配到的工具组和工具')}
              </p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input value={hintInput} onChange={e => setHintInput(e.target.value)} placeholder="输入测试文本，例如：查看文件夹下的文件" className="flex-1" />
                  <Button onClick={handleMatchHints}><Search className="w-4 h-4 mr-1" /> {t('tools.match', '匹配')}</Button>
                </div>
                {hintResult && (
                  <div className="space-y-3">
                    {hintResult.groups.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1">{t('tools.matchedGroups', '匹配的分组：')}</p>
                        <div className="flex gap-2 flex-wrap">
                          {hintResult.groups.map(g => (
                            <Badge key={g.id} className="bg-[var(--accent-primary)]">{g.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {hintResult.tools.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1">{t('tools.recommendedTools', '推荐的工具：')}</p>
                        <div className="flex gap-2 flex-wrap">
                          {hintResult.tools.map(t => (
                            <Badge key={t.id} variant="outline">/{t.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {hintResult.groups.length === 0 && hintResult.tools.length === 0 && (
                      <p className="text-sm text-[var(--text-muted)]">{t('tools.noMatchHint', '未匹配到任何工具组')}</p>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default ToolManagementPage
