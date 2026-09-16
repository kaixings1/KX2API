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
import { ParameterEditor } from './ParameterEditor'
import { Trash2, Loader2, FolderOpen, FileText, RotateCcw } from 'lucide-react'

const api = window.electronAPI.tools

interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  required: boolean
  description: string
  defaultValue?: string
}

interface ToolDef {
  id: string
  name: string
  displayName: string
  description: string
  usage: string
  platform: string
  parameters?: ToolParameter[]
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
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tool, setTool] = useState<ToolDef | null>(null)
  const [groups, setGroups] = useState<ToolGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ name: '', displayName: '', description: '', usage: '', platform: 'all', tags: '', parameters: [] as ToolParameter[], template: '' })

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
            tags: (Array.isArray(found.tags) ? found.tags : []).join(', '),
            parameters: Array.isArray(found.parameters) ? [...found.parameters] : [],
            template: found.template || '',
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
      parameters: form.parameters,
      // 留空表示不使用模板，回落到代码内既有实现；有值则覆写该命令的执行行为
      template: form.template.trim(),
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
    if (!confirm(t('tools.confirmDelete', '确定删除此工具?'))) return
    await api.remove(id)
    navigate('/tools')
  }

  /** 打开该工具对应的 JSON/XML 文件（内置项首次会先物化一份再定位） */
  const handleOpenFile = async () => {
    if (!id) return
    const res = await api.ensureFile(id)
    if (!res.success || !res.data) {
      alert(res.error || t('tools.openFileFailed', '打开文件失败'))
      return
    }
    await api.revealFile(id)
    // 提示可编辑位置：改完文件后需重新加载才会反映到界面
    alert(t('tools.fileHint', '已为该命令生成可编辑文件：\n{path}\n\n修改后请重新打开本页查看效果。')
      .replace('{path}', res.data.path))
  }

  /** 把内置命令恢复成内置默认（清除用户覆盖） */
  const handleResetBuiltin = async () => {
    if (!id) return
    if (!confirm(t('tools.confirmResetBuiltin', '恢复为内置默认？你对该命令的自定义将被清除。'))) return
    const res = await api.resetBuiltin('tool', id)
    if (!res.success) {
      alert(res.error || t('tools.resetFailed', '恢复失败'))
      return
    }
    loadData()
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
        { label: t('tools.title', '工具管理'), href: '/tools' },
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
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>{t('common.edit', '编辑')}</Button>
          {/* 打开对应的 JSON/XML 文件：内置命令磁盘上本无文件，点开时先按当前值物化一份 */}
          <Button variant="outline" size="sm" onClick={handleOpenFile}>
            <FileText className="h-3 w-3 mr-1" />
            {t('tools.openFile', '打开文件')}
          </Button>
          {/* 只有内置项且被改过才需要「恢复默认」 */}
          {tool.builtin && (
            <Button variant="outline" size="sm" onClick={handleResetBuiltin}>
              <RotateCcw className="h-3 w-3 mr-1" />
              {t('tools.resetBuiltin', '恢复默认')}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{tool.enabled ? t('common.enabled', '启用') : t('common.disabled', '禁用')}</span>
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
            <CardTitle className="text-sm">{t('tools.basicInfo', '基本信息')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tools.nameLabel', '名称')}</span>
              <span>/{tool.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tools.displayNameLabel', '显示名称')}</span>
              <span>{tool.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tools.platformLabel', '平台')}</span>
              <Badge variant="outline">{tool.platform}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('tools.builtinLabel', '内置')}</span>
              <Badge variant={tool.builtin ? 'secondary' : 'outline'}>{tool.builtin ? t('common.yes', '是') : t('common.no', '否')}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('tools.groupsTitle', '所属分组')}</CardTitle>
          </CardHeader>
          <CardContent>
            {relatedGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('tools.noGroups', '未归属任何分组')}</p>
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
          <CardTitle className="text-sm">{t('tools.descriptionTitle', '描述')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{tool.description || t('tools.noDescription', '(无描述)')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('tools.usageTitle', '用法')}</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-sm bg-muted px-2 py-1 rounded">{tool.usage || t('tools.noUsage', '(无用法说明)')}</code>
        </CardContent>
      </Card>

      {Array.isArray(tool.tags) && tool.tags.length > 0 && (
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

      {Array.isArray(tool.parameters) && tool.parameters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('tools.parametersTitle', '参数')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tool.parameters.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] p-2 text-sm">
                  <code className="font-mono">{p.name}</code>
                  <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                  {p.required && <Badge variant="secondary" className="text-[10px]">必填</Badge>}
                  {p.defaultValue != null && p.defaultValue !== '' && (
                    <span className="text-xs text-[var(--text-muted)]">默认: {p.defaultValue}</span>
                  )}
                  {p.description != null && p.description !== '' && (
                    <span className="text-xs text-[var(--text-dim)]">{p.description}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tools.editTitle', '编辑工具')}</DialogTitle>
            <DialogDescription>{t('tools.editDesc', '修改工具配置')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('tools.nameLabel', '名称')} *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>{t('tools.displayNameLabel', '显示名称')} *</Label>
              <Input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <Label>{t('tools.descriptionLabel', '描述')}</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <Label>{t('tools.usageLabel', '用法')}</Label>
              <Input value={form.usage} onChange={e => setForm(p => ({ ...p, usage: e.target.value }))} />
            </div>
            <div>
              <Label>{t('tools.platformLabel', '平台')}</Label>
              <select className="w-full text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5" value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                <option value="all">{t('common.all', '全部')}</option>
                <option value="windows">Windows</option>
                <option value="unix">Unix</option>
              </select>
            </div>
            <div>
              <Label>{t('tools.tagsLabel', '标签 (逗号分隔)')}</Label>
              <Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
            </div>
            <div>
              <Label>{t('tools.parametersLabel', '参数 (JSON Schema)')}</Label>
              <ParameterEditor
                value={form.parameters}
                onChange={params => setForm(p => ({ ...p, parameters: params }))}
              />
            </div>
            <div>
              <Label>{t('tools.templateLabel', '执行模板 (可选)')}</Label>
              <textarea
                className="w-full min-h-[88px] font-mono text-xs bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5"
                placeholder={t('tools.templatePlaceholder', '留空则用内置实现。\n本地执行示例: git status --short {args}\n模型执行示例: 请分析 {input} 并给出结论')}
                value={form.template}
                onChange={e => setForm(p => ({ ...p, template: e.target.value }))}
              />
              <p className="text-xs text-[var(--text-dim)] mt-1">
                {t('tools.templateHint', '可用占位符：{args} 参数、{input} 输入、{name} 命令名、{cwd} 当前目录。含 ai/llm 标签的命令走模型执行，其余走本地 shell。')}
              </p>
            </div>
            <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ToolDetailPage
