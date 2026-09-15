/**
 * ToolGroupsPanel — 「哪个组的工具现在生效」面板
 *
 * 背景：工具管理页以前只能编辑分组数据，但那份数据跟请求链路是断开的：
 * 切组、改工具集合对实际发给模型的工具有没有任何影响。这个面板把它接上：
 *
 * - 选生效组（全局组 = 所有启用的工具）→ 写入 config.enabledToolGroups
 * - 勾选工具加入/移出某个组 → toolManager 的组数据
 * - 把当前生效集合另存为命名组
 * - 展示每个工具的环境变量开关（KX2_TOOL_DEF_<NAME>）与本次会发送的工具清单
 *
 * 主进程在「每次请求」时重新解析，所以这里改完不用重启，下一条消息就生效。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Layers, Zap, Save, RefreshCw, Info, AlertTriangle } from 'lucide-react'

interface ToolDef {
  id: string
  name: string
  displayName: string
  description: string
  platform: string
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

const GLOBAL_ID = '__global__'

/** 工具名 → 环境变量名（与主进程 toolRuntime.toolEnvKey 保持一致） */
function toolEnvKey(name: string): string {
  return 'KX2_TOOL_DEF_' + String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

function isPlatformMatch(platform: string): boolean {
  const isWindows = navigator.userAgent.includes('Windows')
  if (!platform || platform === 'all') return true
  if (platform === 'windows') return isWindows
  if (platform === 'unix') return !isWindows
  return true
}

export function ToolGroupsPanel({
  tools,
  groups,
  onChanged,
}: {
  tools: ToolDef[]
  groups: ToolGroup[]
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const [activeIds, setActiveIds] = useState<string[]>([])
  const [editingGroupId, setEditingGroupId] = useState<string>(GLOBAL_ID)
  const [saving, setSaving] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [message, setMessage] = useState('')

  const api = window.electronAPI.tools

  // 读取当前生效组（存在 config.enabledToolGroups，空数组 = 全局组）
  const loadActive = useCallback(async () => {
    try {
      const cfg = await window.electronAPI.config.get()
      setActiveIds((cfg as { enabledToolGroups?: string[] })?.enabledToolGroups || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadActive() }, [loadActive])

  // 当前编辑对象（全局组或某个命名组）对应的工具集合
  const editing = editingGroupId === GLOBAL_ID
    ? { id: GLOBAL_ID, name: t('tools.globalGroup', '全局组'), toolIds: tools.map(x => x.id) }
    : groups.find(g => g.id === editingGroupId) || { id: GLOBAL_ID, name: t('tools.globalGroup', '全局组'), toolIds: tools.map(x => x.id) }

  // 真正会发给模型的工具：全局组=所有 enabled；命名组=组内 ∩ enabled ∩ 平台匹配
  const effective = useMemo(() => {
    if (activeIds.length === 0) {
      return {
        isGlobal: true,
        label: t('tools.globalGroup', '全局组'),
        tools: tools.filter(x => x.enabled && isPlatformMatch(x.platform)),
        skipped: tools.filter(x => !x.enabled || !isPlatformMatch(x.platform)).map(x => x.name),
      }
    }
    const picked: ToolDef[] = []
    const seen = new Set<string>()
    for (const gid of activeIds) {
      const g = groups.find(x => x.id === gid)
      if (!g) continue
      for (const tid of g.toolIds) {
        if (seen.has(tid)) continue
        seen.add(tid)
        const tool = tools.find(x => x.id === tid || x.name === tid)
        if (tool) picked.push(tool)
      }
    }
    const usable = picked.filter(x => x.enabled && isPlatformMatch(x.platform))
    return {
      isGlobal: false,
      label: activeIds.map(id => groups.find(g => g.id === id)?.name || id).join(' + '),
      tools: usable.length > 0 ? usable : tools.filter(x => x.enabled && isPlatformMatch(x.platform)),
      skipped: picked.filter(x => !x.enabled || !isPlatformMatch(x.platform)).map(x => x.name),
    }
  }, [activeIds, groups, tools, t])

  const applyActive = useCallback(async (ids: string[]) => {
    setSaving(true)
    try {
      await window.electronAPI.config.update({ enabledToolGroups: ids })
      setActiveIds(ids)
      setMessage(ids.length === 0
        ? t('tools.switchedGlobal', '已切换到全局组，下一条消息立即生效')
        : t('tools.switchedGroup', '已切换工具组，下一条消息立即生效'))
    } catch (e) {
      setMessage(`${t('tools.switchFailed', '切换失败')}: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }, [t])

  const toggleToolInGroup = useCallback(async (tool: ToolDef, checked: boolean) => {
    try {
      if (editingGroupId === GLOBAL_ID) {
        // 全局组：勾选 = 启用/关闭该工具本身
        if (tool.enabled !== checked) await api.toggle(tool.id)
      } else if (checked) {
        await api.addToGroup(tool.id, editingGroupId)
      } else {
        await api.removeFromGroup(tool.id, editingGroupId)
      }
      onChanged()
    } catch (e) {
      setMessage(`${t('tools.updateFailed', '更新失败')}: ${(e as Error).message}`)
    }
  }, [api, editingGroupId, onChanged, t])

  const handleSaveAs = useCallback(async () => {
    const name = saveAsName.trim()
    if (!name) return
    try {
      const toolIds = effective.tools.map(x => x.id)
      await api.addGroup({
        name,
        description: t('tools.savedFromCurrent', '由当前生效工具另存'),
        toolIds,
        enabled: true,
      })
      setShowSaveAs(false)
      setSaveAsName('')
      setMessage(t('tools.savedAsGroup', '已另存为新组：{{name}}').replace('{{name}}', name))
      onChanged()
    } catch (e) {
      setMessage(`${t('tools.saveFailed', '另存失败')}: ${(e as Error).message}`)
    }
  }, [api, effective.tools, onChanged, saveAsName, t])

  const inEditingGroup = (tool: ToolDef): boolean => {
    if (editingGroupId === GLOBAL_ID) return tool.enabled
    const g = groups.find(x => x.id === editingGroupId)
    return !!g && g.toolIds.some(id => id === tool.id || id === tool.name)
  }

  return (
    <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          {t('tools.effectiveTitle', '当前生效工具组')}
        </CardTitle>
        <CardDescription>
          {t('tools.effectiveDesc', '选中某个组后，只有组内（且已启用、平台匹配）的工具会随请求发送给模型；选全局组则发送所有已启用工具。改完下一条消息立即生效，无需重启。')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 生效组切换 */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={activeIds.length === 0 ? 'default' : 'outline'}
            disabled={saving}
            onClick={() => applyActive([])}
          >
            <Layers className="h-3.5 w-3.5 mr-1" />
            {t('tools.globalGroup', '全局组')}
          </Button>
          {groups.map(g => (
            <Button
              key={g.id}
              size="sm"
              variant={activeIds.includes(g.id) ? 'default' : 'outline'}
              disabled={saving}
              onClick={() => applyActive([g.id])}
              title={g.description}
            >
              {g.name}
              <span className="ml-1 text-[10px] opacity-70">{g.toolIds.length}</span>
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => { loadActive(); onChanged() }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* 生效结果 */}
        <div className="rounded border border-[var(--border)] p-2 text-xs space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{effective.label}</Badge>
            <span>
              {t('tools.effectiveCount', '本次发送工具数')}: <strong>{effective.tools.length}</strong> / {tools.length}
            </span>
            {effective.skipped.length > 0 && (
              <span className="text-[var(--text-muted)]">
                {t('tools.skippedTools', '未发送（已关闭或平台不符）')}: {effective.skipped.join(', ')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {effective.tools.map(x => (
              <span
                key={x.id}
                className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono text-[10px]"
                title={`${x.description}\n${toolEnvKey(x.name)}=1`}
              >
                {x.name}
              </span>
            ))}
            {effective.tools.length === 0 && (
              <span className="flex items-center gap-1 text-[var(--warning,#d97706)]">
                <AlertTriangle className="h-3 w-3" />
                {t('tools.noEffectiveTools', '当前没有任何可用工具，模型将无法调用工具')}
              </span>
            )}
          </div>
        </div>

        {/* 编辑哪个组 */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">{t('tools.editGroupMembers', '编辑组内工具')}</Label>
            <select
              className="w-full mt-1 text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5"
              value={editingGroupId}
              onChange={e => setEditingGroupId(e.target.value)}
            >
              <option value={GLOBAL_ID}>{t('tools.globalGroupAll', '全局组（勾选=启用/关闭工具）')}</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}（{g.toolIds.length}）</option>
              ))}
            </select>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowSaveAs(v => !v)}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {t('tools.saveAsGroup', '另存为组')}
          </Button>
        </div>

        {showSaveAs && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">{t('tools.newGroupName', '新组名称')}</Label>
              <Input value={saveAsName} onChange={e => setSaveAsName(e.target.value)} placeholder={t('tools.newGroupNamePlaceholder', '例如：编程')} />
            </div>
            <Button size="sm" onClick={handleSaveAs} disabled={!saveAsName.trim()}>
              {t('tools.confirmSave', '保存')}
            </Button>
            <span className="text-[10px] text-[var(--text-muted)]">
              {t('tools.saveAsHint', '将保存当前生效的 {{count}} 个工具').replace('{{count}}', String(effective.tools.length))}
            </span>
          </div>
        )}

        {/* 工具勾选列表 */}
        <div className="max-h-[320px] overflow-auto rounded border border-[var(--border)] divide-y divide-[var(--border)]">
          {tools.map(tool => {
            const checked = inEditingGroup(tool)
            const platformOk = isPlatformMatch(tool.platform)
            return (
              <label key={tool.id} className="flex items-start gap-2 p-2 text-xs hover:bg-[var(--bg-hover)] cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[var(--accent-primary)]"
                  checked={checked}
                  onChange={e => toggleToolInGroup(tool, e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{tool.name}</span>
                    <span className="text-[var(--text-muted)]">{tool.displayName !== tool.name ? tool.displayName : ''}</span>
                    <code className="text-[10px] px-1 rounded bg-[var(--bg-tertiary)]">{toolEnvKey(tool.name)}={checked ? '1' : '0'}</code>
                    {tool.platform !== 'all' && (
                      <Badge variant={platformOk ? 'secondary' : 'outline'} className="text-[10px]">
                        {tool.platform}
                      </Badge>
                    )}
                    {!platformOk && (
                      <span className="text-[10px] text-[var(--warning,#d97706)]">
                        {t('tools.platformMismatch', '当前平台不适用')}
                      </span>
                    )}
                  </div>
                  <div className="text-[var(--text-dim)] truncate" title={tool.description}>{tool.description}</div>
                </div>
              </label>
            )
          })}
          {tools.length === 0 && (
            <div className="p-3 text-xs text-[var(--text-muted)]">{t('tools.noTools', '暂无工具')}</div>
          )}
        </div>

        {message && (
          <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 px-2 py-1.5 rounded">
            <Info className="h-3.5 w-3.5" /> {message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
