import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ManagementToolbar, ImportExportDialog } from '@/components/management'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { SectionCard } from '@/components/ui/section-card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Play, Trash2, Edit3, Save, X, RotateCcw, Terminal, Search,
  ChevronDown, ChevronUp, Copy, Check, Info, Tag,
} from 'lucide-react'

// ==================== Types ====================

interface CommandRecord {
  id: string
  name: string
  description: string
  command?: string
  args?: string[]
  type: 'builtin' | 'custom'
  enabled: boolean
  aliases?: string[]
  source?: string
}

interface CommandExecuteResult {
  success: boolean
  output?: string
  error?: string
  durationMs?: number
}

interface CommandCategory {
  key: string
  label: string
  icon: string
  patterns: string[]
}

const COMMAND_CATEGORIES: CommandCategory[] = [
  { key: 'file', label: '文件', icon: '📁', patterns: ['ls', 'dir', 'cat', 'tree', 'find', 'grep', 'findstr', 'copy', 'move', 'rm', 'mkdir', 'touch', 'echo', 'pwd', 'file', 'files', 'cd', 'add-dir'] },
  { key: 'search', label: '搜索', icon: '🔍', patterns: ['search', 'grep', 'findstr', 'code-search', 'symbol', 'imports', 'deps', 'vector-search', 'memory-search', 'context-collapse'] },
  { key: 'git', label: 'Git', icon: '🔀', patterns: ['git-', 'branch', 'commit', 'diff', 'merge', 'rebase', 'stash', 'status', 'clone', 'push', 'pull', 'log', 'review', 'pr-', 'auto-commit'] },
  { key: 'system', label: '系统', icon: '⚙️', patterns: ['config', 'env', 'ps', 'memory', 'monitor', 'stats', 'health', 'doctor', 'perf', 'heapdump', 'performance', 'version', 'upgrade', 'theme', 'color', 'effort'] },
  { key: 'ai', label: 'AI', icon: '🤖', patterns: ['model', 'prompt', 'agent', 'plan', 'task', 'team', 'workflow', 'assistant', 'brain', 'think', 'insights', 'summary', 'compact', 'cost', 'usage', 'benchmark'] },
  { key: 'network', label: '网络', icon: '🌐', patterns: ['http', 'web', 'proxy', 'socket', 'websocket', 'mcp', 'browser', 'chrome', 'remote', 'oauth', 'api-debug', 'nginx'] },
  { key: 'database', label: '数据库', icon: '🗄️', patterns: ['database', 'db', 'sql', 'redis', 'mongo', 'query'] },
  { key: 'document', label: '文档', icon: '📄', patterns: ['doc', 'pdf', 'excel', 'diagram', 'wiki', 'readme', 'changelog', 'release', 'markdown', 'translate', 'snippet', 'notebook', 'rag'] },
  { key: 'test', label: '测试', icon: '🧪', patterns: ['test', 'lint', 'fmt', 'build', 'compile', 'run-', 'mock', 'tui', 'scaffold'] },
]

function categorizeCommand(name: string): string {
  const lower = name.toLowerCase()
  for (const cat of COMMAND_CATEGORIES) {
    if (cat.patterns.some(p => lower.includes(p))) return cat.key
  }
  return 'other'
}

function getCategoryLabel(key: string): string {
  return COMMAND_CATEGORIES.find(c => c.key === key)?.label || '其他'
}

function getCategoryIcon(key: string): string {
  return COMMAND_CATEGORIES.find(c => c.key === key)?.icon || '📌'
}

// ==================== Component ====================

export function CommandManagement() {
  const { t } = useTranslation()
  const [commands, setCommands] = useState<CommandRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [results, setResults] = useState<Record<string, CommandExecuteResult>>({})
  const [message, setMessage] = useState('')
  const [ioOpen, setIoOpen] = useState(false)
  const [ioMode, setIoMode] = useState<'import' | 'export'>('export')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Inline form for custom commands
  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none')
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCmd, setFormCmd] = useState('')
  const [formArgs, setFormArgs] = useState('')
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const commandsApi = window.electronAPI.commands

  // ==================== Load ====================

  const loadCommands = useCallback(async () => {
    setLoading(true)
    try {
      const res = await commandsApi.getAll()
      setCommands(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error('[CommandManagement] Failed to load commands:', e)
      setMessage('加载失败: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }, [commandsApi])

  useEffect(() => { loadCommands() }, [loadCommands])

  // ==================== Helpers ====================

  const showMsg = (text: string) => { setMessage(text); setTimeout(() => setMessage(''), 3000) }

  const resetForm = () => {
    setFormMode('none'); setEditingId(null); setFormName(''); setFormDesc(''); setFormCmd(''); setFormArgs(''); setFormError('')
  }

  const openCreate = () => {
    resetForm(); setFormMode('create')
  }

  const openEdit = (cmd: CommandRecord) => {
    setEditingId(cmd.id); setFormName(cmd.name); setFormDesc(cmd.description)
    setFormCmd(cmd.command || ''); setFormArgs((cmd.args || []).join(' '))
    setFormMode('edit'); setFormError('')
  }

  const cancelForm = () => { resetForm() }

  // ==================== CRUD ====================

  const handleSave = async () => {
    setFormError('')
    if (!formName.trim()) { setFormError('名称不能为空'); return }
    if (!formCmd.trim()) { setFormError('命令不能为空'); return }
    try {
      const argsArr = formArgs.split(' ').filter(Boolean)
      if (formMode === 'edit' && editingId) {
        await commandsApi.update(editingId, {
          name: formName.trim(),
          description: formDesc.trim(),
          command: formCmd.trim(),
          args: argsArr.length > 0 ? argsArr : undefined,
        })
        showMsg('命令已更新')
      } else {
        await commandsApi.add({
          name: formName.trim(),
          description: formDesc.trim(),
          command: formCmd.trim(),
          args: argsArr.length > 0 ? argsArr : undefined,
          type: 'custom',
          enabled: true,
        })
        showMsg('命令已创建')
      }
      resetForm()
      loadCommands()
    } catch (e) {
      setFormError((e instanceof Error ? e.message : String(e)))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此命令?')) return
    try {
      await commandsApi.delete(id)
      showMsg('命令已删除')
      loadCommands()
    } catch (e) {
      showMsg('删除失败: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleToggle = async (cmd: CommandRecord) => {
    try {
      await commandsApi.update(cmd.id, { enabled: !cmd.enabled })
      loadCommands()
    } catch (e) {
      showMsg('操作失败: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const handleExecute = async (cmd: CommandRecord) => {
    try {
      const start = performance.now()
      const res = await commandsApi.execute(cmd.id, cmd.args)
      const duration = Math.round(performance.now() - start)
      setResults(prev => ({ ...prev, [cmd.id]: { ...res, durationMs: res.durationMs ?? duration } }))
    } catch (e) {
      setResults(prev => ({ ...prev, [cmd.id]: { success: false, error: (e instanceof Error ? e.message : String(e)) } }))
    }
  }

  const handleExport = () => {
    const data = JSON.stringify(customCommands, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commands_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (jsonData: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const items = JSON.parse(jsonData)
      const arr = Array.isArray(items) ? items : (items.commands || items)
      if (!Array.isArray(arr)) return { success: false, error: '数据格式错误' }
      for (const item of arr) {
        if (item?.name && item?.command) {
          await commandsApi.add({
            name: item.name,
            description: item.description || '',
            command: item.command,
            args: item.args,
            type: 'custom',
            enabled: item.enabled ?? true,
          })
        }
      }
      loadCommands()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e instanceof Error ? e.message : String(e)) }
    }
  }

  // ==================== Filter ====================

  const builtin = commands.filter(c => c.type === 'builtin')
  const custom = commands.filter(c => c.type === 'custom')

  const filteredBuiltin = builtin.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  }).filter(c => {
    if (categoryFilter === 'all') return true
    return categorizeCommand(c.name) === categoryFilter
  })

  const filteredCustom = custom.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || (c.command || '').toLowerCase().includes(q)
  }).filter(c => {
    if (categoryFilter === 'all') return true
    return categorizeCommand(c.name) === categoryFilter
  })

  const categoryCounts: Record<string, number> = {}
  commands.forEach(c => {
    const cat = c.type === 'builtin' ? categorizeCommand(c.name) : 'custom'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  })

  const isFormOpen = formMode === 'create' || formMode === 'edit'

  // ==================== Render ====================

  return (
    <div className="space-y-4">
      <ManagementToolbar
        title={t('commands.title', '命令管理')}
        subtitle={t('commands.description', '管理和执行命令')}
        onRefresh={loadCommands}
        onExport={() => { setIoMode('export'); setIoOpen(true) }}
        onImport={() => { setIoMode('import'); setIoOpen(true) }}
        filters={{ search }}
        onFiltersChange={(f) => { setSearch(f.search || ''); setCategoryFilter('all') }}
        totalCount={commands.length}
        filteredCount={filteredCustom.length + filteredBuiltin.length}
        isLoading={loading}
        extraActions={
          <div className="flex items-center gap-1">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-9 text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-2 pr-7 appearance-none cursor-pointer"
            >
              <option value="all">全部分类</option>
              {COMMAND_CATEGORIES.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.icon} {cat.label}</option>
              ))}
              <option value="custom">自定义</option>
              <option value="builtin">内置</option>
            </select>
            <Button onClick={openCreate} size="sm">
              <Play className="h-4 w-4 mr-1" />{t('commands.create', '新建命令')}
            </Button>
          </div>
        }
      />

      <ImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        mode={ioMode}
        title="命令管理"
        description={ioMode === 'export' ? '导出自定义命令配置' : '导入自定义命令（合并，不覆盖）'}
        data={customCommands(commands)}
        onExport={handleExport}
        onImport={handleImport}
      />

      {/* Help Card */}
      <SectionCard
        title={t('commands.pageHelpTitle', '关于命令')}
        icon={Info}
      >
        <p className="text-xs text-[var(--text-dim)] leading-relaxed">
          {t('commands.pageHelp', '内置命令由系统预设，不可修改。自定义命令可新建、编辑、删除和执行。点击播放按钮直接运行命令查看输出。')}
        </p>
      </SectionCard>

      {/* Inline Create/Edit Form */}
      {isFormOpen && (
        <Card className="border-[var(--accent-primary)]/30 bg-[var(--glass-bg)]">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{formMode === 'edit' ? '编辑命令' : '新建自定义命令'}</p>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelForm}><X className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">名称 *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="my-command" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">执行程序</Label>
                <Input value={formCmd} onChange={e => setFormCmd(e.target.value)} placeholder="npm, node, python, cmd" className="h-9 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">描述</Label>
                <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="命令用途说明" className="h-9 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">参数（空格分隔）</Label>
                <Input value={formArgs} onChange={e => setFormArgs(e.target.value)} placeholder="arg1 arg2 --flag" className="h-9 text-sm" />
              </div>
            </div>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={cancelForm}>取消</Button>
              <Button size="sm" onClick={handleSave}><Save className="h-3.5 w-3.5 mr-1" />保存</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {message && (
        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 px-3 py-2 rounded">
          <Check className="w-4 h-4" /> {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Tabs defaultValue="custom" className="space-y-4">
          <TabsList>
            <TabsTrigger value="custom">
              <Tag className="w-4 h-4 mr-1" /> 自定义 ({filteredCustom.length})
            </TabsTrigger>
            <TabsTrigger value="builtin">
              <Terminal className="w-4 h-4 mr-1" /> 内置 ({filteredBuiltin.length})
            </TabsTrigger>
          </TabsList>

          {/* ========== Custom Commands ========== */}
          <TabsContent value="custom" className="space-y-2">
            {filteredCustom.length === 0 ? (
              <SectionCard>
                <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                  {custom.length === 0 ? '暂无自定义命令，点击右上角创建' : '没有匹配的命令'}
                </p>
              </SectionCard>
            ) : (
              filteredCustom.map(cmd => (
                <CustomCommandRow
                  key={cmd.id}
                  cmd={cmd}
                  result={results[cmd.id]}
                  expanded={expandedId === cmd.id}
                  editing={editingId === cmd.id}
                  onToggle={() => setExpandedId(expandedId === cmd.id ? null : cmd.id)}
                  onExecute={() => handleExecute(cmd)}
                  onToggleEnable={() => handleToggle(cmd)}
                  onEdit={() => openEdit(cmd)}
                  onDelete={() => handleDelete(cmd.id)}
                  onSave={handleSave}
                  onCancelEdit={resetForm}
                  formError={formError}
                />
              ))
            )}
          </TabsContent>

          {/* ========== Builtin Commands ========== */}
          <TabsContent value="builtin" className="space-y-2">
            {filteredBuiltin.length === 0 ? (
              <SectionCard>
                <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                  {builtin.length === 0 ? '无内置命令' : '没有匹配的内置命令'}
                </p>
              </SectionCard>
            ) : (
              (() => {
                // Group builtin by category
                const grouped: Record<string, CommandRecord[]> = {}
                filteredBuiltin.forEach(cmd => {
                  const cat = categorizeCommand(cmd.name)
                  if (!grouped[cat]) grouped[cat] = []
                  grouped[cat].push(cmd)
                })
                return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, cmds]) => (
                  <Card key={cat}>
                    <CardContent className="py-3">
                      <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                        <span>{getCategoryIcon(cat)}</span> {getCategoryLabel(cat)} <span className="text-[var(--text-dim)]">({cmds.length})</span>
                      </p>
                      <div className="space-y-1.5">
                        {cmds.map(cmd => (
                          <BuiltinCommandRow key={cmd.id} cmd={cmd} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              })()
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// ==================== Sub-components ====================

function CustomCommandRow({
  cmd, result, expanded, editing, onToggle, onExecute, onToggleEnable, onEdit, onDelete, onSave, onCancelEdit, formError,
}: {
  cmd: CommandRecord
  result?: CommandExecuteResult
  expanded: boolean
  editing: boolean
  onToggle: () => void
  onExecute: () => void
  onToggleEnable: () => void
  onEdit: () => void
  onDelete: () => void
  onSave: () => void
  onCancelEdit: () => void
  formError: string
}) {
  const [localName, setLocalName] = useState(cmd.name)
  const [localDesc, setLocalDesc] = useState(cmd.description)
  const [localCmd, setLocalCmd] = useState(cmd.command || '')
  const [localArgs, setLocalArgs] = useState((cmd.args || []).join(' '))
  const [localError, setLocalError] = useState('')

  useEffect(() => { if (editing) { setLocalName(cmd.name); setLocalDesc(cmd.description); setLocalCmd(cmd.command || ''); setLocalArgs((cmd.args || []).join(' ')) } }, [editing, cmd])

  const handleLocalSave = async () => {
    setLocalError('')
    if (!localName.trim()) { setLocalError('名称不能为空'); return }
    if (!localCmd.trim()) { setLocalError('命令不能为空'); return }
    try {
      const argsArr = localArgs.split(' ').filter(Boolean)
      await window.electronAPI.commands.update(cmd.id, {
        name: localName.trim(), description: localDesc.trim(), command: localCmd.trim(),
        args: argsArr.length > 0 ? argsArr : undefined,
      })
      onSave()
    } catch (e) {
      setLocalError((e instanceof Error ? e.message : String(e)))
    }
  }

  const handleLocalExecute = async () => {
    onExecute()
  }

  if (editing) {
    return (
      <Card className="border-[var(--accent-primary)]/30">
        <CardContent className="pt-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div><Label className="text-xs">名称 *</Label><Input value={localName} onChange={e => setLocalName(e.target.value)} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">执行程序</Label><Input value={localCmd} onChange={e => setLocalCmd(e.target.value)} className="h-8 text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs">描述</Label><Input value={localDesc} onChange={e => setLocalDesc(e.target.value)} className="h-8 text-sm" /></div>
            <div className="col-span-2"><Label className="text-xs">参数</Label><Input value={localArgs} onChange={e => setLocalArgs(e.target.value)} className="h-8 text-sm" /></div>
          </div>
          {localError && <p className="text-xs text-red-400">{localError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>取消</Button>
            <Button size="sm" onClick={handleLocalSave}><Save className="h-3.5 w-3.5 mr-1" />保存</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={expanded ? 'border-[var(--accent-primary)]/30' : ''}>
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="font-medium text-sm">{cmd.name}</span>
              <Badge variant={cmd.enabled ? 'default' : 'secondary'} className="text-[10px]">{cmd.enabled ? '启用' : '禁用'}</Badge>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{cmd.description}</p>
            {expanded && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-mono text-[var(--text-dim)] bg-[var(--bg-tertiary)] px-2 py-1 rounded">
                  {cmd.command} {(cmd.args || []).join(' ')}
                </p>
                {result && (
                  <div className={`p-2 rounded text-xs ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-400'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <strong>{result.success ? 'Output:' : 'Error:'}</strong>
                      {result.durationMs && <span className="text-[var(--text-dim)]">{result.durationMs}ms</span>}
                    </div>
                    <pre className="whitespace-pre-wrap break-all">{result.output || result.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 ml-2">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggle} title={cmd.enabled ? '禁用' : '启用'}>
              <Switch checked={cmd.enabled} className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onExecute} title="执行">
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggle} title={expanded ? '收起' : '展开'}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="编辑"><Edit3 className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={onDelete} title="删除"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BuiltinCommandRow({ cmd }: { cmd: CommandRecord }) {
  const [copied, setCopied] = useState(false)

  const fullCommand = `${cmd.command || cmd.name}${(cmd.args || []).length > 0 ? ' ' + (cmd.args || []).join(' ') : ''}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">/{cmd.name}</span>
          {cmd.aliases && cmd.aliases.length > 0 && (
            <div className="flex gap-1">
              {cmd.aliases.map(a => <Badge key={a} variant="outline" className="text-[9px] h-4 px-1">{a}</Badge>)}
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] truncate">{cmd.description}</p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={handleCopy}
        title="复制命令"
      >
        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}

// ==================== Helper: filtered commands for export ====================

function customCommands(state: CommandRecord[]): CommandRecord[] {
  return state.filter(c => c.type === 'custom')
}

export default CommandManagement
