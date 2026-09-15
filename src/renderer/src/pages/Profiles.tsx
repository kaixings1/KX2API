/**
 * Profiles Management Page
 * 管理多组 API 配置（provider / baseUrl / apiKey / model）
 * 配置文件存放于 ~/.doge/kx2code/profiles.json
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { SectionCard } from '@/components/ui/section-card'
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ExternalLink,
  KeyRound,
  FileJson,
  RefreshCw,
} from 'lucide-react'

interface Profile {
  name: string
  provider: 'openai' | 'anthropic' | 'custom'
  baseUrl: string
  apiKey: string
  model: string
  _active?: boolean
  maxToolRounds?: number
  maxRepeat?: number
}

const PROVIDER_PRESETS: Record<string, { label: string; baseUrl: string; defaultModel: string }> = {
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com', defaultModel: 'gpt-4o' },
  anthropic: { label: 'Anthropic', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514' },
  custom: { label: 'Custom', baseUrl: 'http://127.0.0.1:8080', defaultModel: 'gpt-4o' },
}

export function Profiles() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeName, setActiveName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 添加对话框
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newProvider, setNewProvider] = useState<'openai' | 'anthropic' | 'custom'>('openai')
  const [newBaseUrl, setNewBaseUrl] = useState('https://api.openai.com')
  const [newApiKey, setNewApiKey] = useState('')
  const [newModel, setNewModel] = useState('gpt-4o')
  const [newMaxToolRounds, setNewMaxToolRounds] = useState(5)
  const [newMaxRepeat, setNewMaxRepeat] = useState(3)

  // 编辑
  const [editing, setEditing] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [editProvider, setEditProvider] = useState<'openai' | 'anthropic' | 'custom'>('openai')
  const [editBaseUrl, setEditBaseUrl] = useState('')
  const [editApiKey, setEditApiKey] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editMaxToolRounds, setEditMaxToolRounds] = useState(5)
  const [editMaxRepeat, setEditMaxRepeat] = useState(3)

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // .doge 配置文件管理
  const [dogeFiles, setDogeFiles] = useState<Array<{ name: string; size: number; modified: number }>>([])
  const [dogeLoading, setDogeLoading] = useState(false)
  const [viewingFile, setViewingFile] = useState<{ name: string; content: string } | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.profiles.getAll()
      if (result.success) {
        setProfiles(result.profiles ?? [])
        setActiveName(result.activeProfile ?? null)
      }
    } catch (e) {
      toast({ title: t('profiles.loadFailed', '加载失败'), description: (e as Error).message, variant: 'destructive' })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSwitch = async (name: string) => {
    try {
      const result = await window.electronAPI.profiles.setActive(name)
      if (result.success) {
        setActiveName(name)
        toast({ title: t('profiles.switched', '已切换到') + ` ${name}`, description: result.profile?.baseUrl })
        await load()
      } else {
        toast({ title: t('profiles.switchFailed', '切换失败'), description: result.error, variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: t('profiles.switchFailed', '切换失败'), description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast({ title: t('profiles.nameRequired', '名称不能为空'), variant: 'destructive' })
      return
    }
    if (!newApiKey.trim()) {
      toast({ title: t('profiles.apiKeyRequired', 'API Key 不能为空'), variant: 'destructive' })
      return
    }
    try {
      const result = await window.electronAPI.profiles.upsert({
        name: newName.trim(),
        provider: newProvider,
        baseUrl: newBaseUrl.trim() || PROVIDER_PRESETS[newProvider].baseUrl,
        apiKey: newApiKey.trim(),
        model: newModel.trim() || PROVIDER_PRESETS[newProvider].defaultModel,
        maxToolRounds: newMaxToolRounds,
        maxRepeat: newMaxRepeat,
      })
      if (result.success) {
        setShowAdd(false)
        resetAddForm()
        await load()
        toast({ title: `${t('profiles.profileAdded', '配置组')} "${newName.trim()}" ${t('profiles.added', '已添加')}` })
      } else {
        // 后端返回失败时明确提示，并带出具体原因，避免静默失败
        toast({
          title: t('profiles.addFailed', '添加失败'),
          description: (result as { error?: string }).error || t('profiles.unknownError', '未知错误'),
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({ title: t('profiles.addFailed', '添加失败'), description: (e as Error).message, variant: 'destructive' })
    }
  }

  const resetAddForm = () => {
    setNewName('')
    setNewProvider('openai')
    setNewBaseUrl('https://api.openai.com')
    setNewApiKey('')
    setNewModel('gpt-4o')
    setNewMaxToolRounds(5)
    setNewMaxRepeat(3)
  }

  const handleEditSave = async () => {
    if (!editing) return
    if (!editName.trim()) {
      toast({ title: t('profiles.nameRequired', '名称不能为空'), variant: 'destructive' })
      return
    }
    try {
      const result = await window.electronAPI.profiles.upsert({
        name: editName.trim(),
        provider: editProvider,
        baseUrl: editBaseUrl.trim() || PROVIDER_PRESETS[editProvider].baseUrl,
        apiKey: editApiKey.trim(),
        model: editModel.trim() || PROVIDER_PRESETS[editProvider].defaultModel,
        maxToolRounds: editMaxToolRounds,
        maxRepeat: editMaxRepeat,
      })
      if (result.success) {
        setEditing(null)
        await load()
        toast({ title: `${t('profiles.profileUpdated', '配置组')} "${editName.trim()}" ${t('profiles.updated', '已更新')}` })
      } else {
        // 后端返回失败时也要明确提示，并带上具体原因
        toast({
          title: t('profiles.updateFailed', '更新失败'),
          description: (result as { error?: string }).error || t('profiles.unknownError', '未知错误'),
          variant: 'destructive',
        })
      }
    } catch (e) {
      toast({ title: t('profiles.updateFailed', '更新失败'), description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleDelete = async (name: string) => {
    try {
      const result = await window.electronAPI.profiles.remove(name)
      if (result.success) {
        setDeleteTarget(null)
        await load()
        toast({ title: `${t('profiles.profileDeleted', '配置组')} "${name}" ${t('profiles.deleted', '已删除')}` })
      } else {
        toast({ title: t('profiles.deleteFailed', '删除失败'), description: result.error, variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: t('profiles.deleteFailed', '删除失败'), description: (e as Error).message, variant: 'destructive' })
    }
  }

  const openEdit = (p: Profile) => {
    setEditing(p)
    setEditName(p.name)
    setEditProvider(p.provider)
    setEditBaseUrl(p.baseUrl)
    setEditApiKey(p.apiKey)
    setEditModel(p.model)
    setEditMaxToolRounds(p.maxToolRounds || 5)
    setEditMaxRepeat(p.maxRepeat || 3)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div>
          <h1 className="text-sm font-medium">{t('profiles.title', 'API 配置组')}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t('profiles.subtitle', '管理多组 API 接入点，切换后即时生效')}
          </p>
        </div>
        <Button size="sm" onClick={() => { resetAddForm(); setShowAdd(true) }}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('profiles.add', '添加')}
        </Button>
      </div>

      {/* 配置组列表 */}
      <ScrollArea className="flex-1 px-4 py-3">
        {loading ? (
          <div className="text-xs text-[var(--text-muted)]">加载中...</div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <KeyRound className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">{t('profiles.noProfiles', '暂无配置组')}</p>
            <p className="text-xs mt-1">{t('profiles.noProfilesHint', '点击右上角"添加"创建第一个')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map(p => (
              <div
                key={p.name}
                className={`rounded-lg border p-3 transition-colors ${
                  p._active
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => handleSwitch(p.name)}
                      className="mt-0.5 flex-shrink-0"
                      title={p._active ? t('profiles.active', '当前激活') : t('profiles.clickToSwitch', '点击切换')}
                    >
                      {p._active ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-[var(--accent)]" />
                      ) : (
                        <Circle className="w-4.5 h-4.5 text-[var(--text-muted)]" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                          {p.provider}
                        </span>
                        {p._active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)]">
                            {t('profiles.current', '当前')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--text-muted)]">
                        <span className="truncate max-w-[200px]">{p.baseUrl}</span>
                        <span className="text-[var(--text-faint)]">|</span>
                        <span>模型: {p.model}</span>
                        <span className="text-[var(--text-faint)]">|</span>
                        <span>轮次: {p.maxToolRounds || 5}</span>
                        <span className="text-[var(--text-faint)]">|</span>
                        <span>重复检测: {p.maxRepeat || 3}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-[var(--text-muted)]">
                        <KeyRound className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">
                          {p.apiKey.slice(0, 8)}...{p.apiKey.slice(-4)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(p)}
                      title={t('profiles.edit', '编辑')}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-500"
                      onClick={() => setDeleteTarget(p.name)}
                      title={t('profiles.delete', '删除')}
                      disabled={profiles.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* .doge 配置文件管理 */}
      <div className="border-t border-[var(--border)] mt-4">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h3 className="text-sm font-medium">{t('profiles.dogeConfigTitle', '.doge 配置文件')}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('profiles.dogeConfigDesc', '项目目录下的 JSON 配置文件')}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={async () => {
            setDogeLoading(true)
            try {
              const result = await window.electronAPI.dogeConfig.listFiles()
              if (result.success) {
                setDogeFiles(result.files ?? [])
              }
            } catch (e) {
              toast({ title: t('profiles.loadDogeFailed', '加载配置失败'), description: (e as Error).message, variant: 'destructive' })
            }
            setDogeLoading(false)
          }}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${dogeLoading ? 'animate-spin' : ''}`} />
            {t('profiles.refresh', '刷新')}
          </Button>
        </div>
        <ScrollArea className="px-4 pb-3 h-[200px]">
          {dogeFiles.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] py-4 text-center">
              {t('profiles.noConfigFiles', '暂无配置文件')}
            </div>
          ) : (
            <div className="space-y-1">
              {dogeFiles.map(file => (
                <div
                  key={file.name}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileJson className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-muted)]" />
                    <span className="text-xs font-medium truncate">{file.name}</span>
                    <span className="text-[10px] text-[var(--text-faint)]">
                      {(file.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={async () => {
                        try {
                          const result = await window.electronAPI.dogeConfig.readFile(file.name)
                          if (result.success) {
                            setViewingFile({ name: file.name, content: result.content ?? '' })
                            setShowRaw(false)
                          } else {
                            toast({ title: t('profiles.readFailed', '读取失败'), description: result.error, variant: 'destructive' })
                          }
                        } catch (e) {
                          toast({ title: t('profiles.readFailed', '读取失败'), description: (e as Error).message, variant: 'destructive' })
                        }
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 添加对话框 */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('profiles.addTitle', '添加配置组')}</DialogTitle>
            <DialogDescription className="text-xs">
              {t('profiles.addDesc', '创建新的 API 接入点配置')}
            </DialogDescription>
          </DialogHeader>
          <SectionCard contentClassName="space-y-3 py-2">
            <div>
              <Label className="text-xs">{t('profiles.nameLabel', '名称')}</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="my-proxy"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.providerLabel', '服务商')}</Label>
              <Select value={newProvider} onValueChange={v => {
                const provider = v as 'openai' | 'anthropic' | 'custom'
                setNewProvider(provider)
                setNewBaseUrl(PROVIDER_PRESETS[provider].baseUrl)
                setNewModel(PROVIDER_PRESETS[provider].defaultModel)
              }}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('profiles.baseUrlLabel', 'Base URL')}</Label>
              <Input
                value={newBaseUrl}
                onChange={e => setNewBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080"
                className="mt-1 h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.apiKeyLabel', 'API Key')}</Label>
              <Input
                type="password"
                value={newApiKey}
                onChange={e => setNewApiKey(e.target.value)}
                placeholder="sk-..."
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.defaultModelLabel', '默认模型')}</Label>
              <Input
                value={newModel}
                onChange={e => setNewModel(e.target.value)}
                placeholder="gpt-4o"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.maxToolRoundsLabel', '工具调用最大轮次')}</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={newMaxToolRounds}
                onChange={e => setNewMaxToolRounds(Number(e.target.value))}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.maxRepeatLabel', '重复循环检测次数')}</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={newMaxRepeat}
                onChange={e => setNewMaxRepeat(Number(e.target.value))}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </SectionCard>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>{t('profiles.cancel', '取消')}</Button>
            <Button size="sm" onClick={handleAdd}>{t('profiles.add', '添加')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('profiles.editTitle', '编辑配置组')}</DialogTitle>
            <DialogDescription className="text-xs">
              {t('profiles.editDesc', '修改')} {editing?.name} {t('profiles.editDescSuffix', '的配置')}
            </DialogDescription>
          </DialogHeader>
          <SectionCard contentClassName="space-y-3 py-2">
            <div>
              <Label className="text-xs">{t('profiles.nameLabel', '名称')}</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.providerLabel', '服务商')}</Label>
              <Select value={editProvider} onValueChange={v => {
                const provider = v as 'openai' | 'anthropic' | 'custom'
                setEditProvider(provider)
                setEditBaseUrl(PROVIDER_PRESETS[provider].baseUrl)
                setEditModel(PROVIDER_PRESETS[provider].defaultModel)
              }}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('profiles.baseUrlLabel', 'Base URL')}</Label>
              <Input
                value={editBaseUrl}
                onChange={e => setEditBaseUrl(e.target.value)}
                className="mt-1 h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.apiKeyLabel', 'API Key')}</Label>
              <Input
                type="password"
                value={editApiKey}
                onChange={e => setEditApiKey(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.defaultModelLabel', '默认模型')}</Label>
              <Input
                value={editModel}
                onChange={e => setEditModel(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.maxToolRoundsLabel', '工具调用最大轮次')}</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={editMaxToolRounds}
                onChange={e => setEditMaxToolRounds(Number(e.target.value))}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{t('profiles.maxRepeatLabel', '重复循环检测次数')}</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={editMaxRepeat}
                onChange={e => setEditMaxRepeat(Number(e.target.value))}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </SectionCard>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>{t('profiles.cancel', '取消')}</Button>
            <Button size="sm" onClick={handleEditSave}>{t('profiles.save', '保存')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('profiles.deleteTitle', '删除配置组')}</DialogTitle>
            <DialogDescription className="text-xs">
              {t('profiles.deleteDesc', '确定删除')} "{deleteTarget}" {t('profiles.deleteDescSuffix', '吗？此操作不可撤销。')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>{t('profiles.cancel', '取消')}</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {t('profiles.delete', '删除')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON 查看对话框 */}
      <Dialog open={!!viewingFile} onOpenChange={(open) => { if (!open) { setViewingFile(null); setShowRaw(false) } }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileJson className="w-4 h-4" />
              {viewingFile?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('profiles.jsonViewDesc', '.doge 目录下的 JSON 配置文件')}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ScrollArea className="h-[400px] w-full rounded-md border border-[var(--border)] p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {viewingFile?.content}
              </pre>
            </ScrollArea>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? t('profiles.formatted', '格式化') : t('profiles.raw', '原始')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setViewingFile(null); setShowRaw(false) }}>
              {t('profiles.close', '关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
