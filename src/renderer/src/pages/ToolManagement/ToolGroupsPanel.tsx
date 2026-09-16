/**
 * ToolGroupsPanel — 「哪个组的工具现在生效」面板
 *
 * 背景：工具管理页以前只能编辑分组数据，但那份数据跟请求链路是断开的：
 * 切组、改工具集合对实际发给模型的工具有没有任何影响。这个面板把它接上：
 *
 * - 选生效组（全局组 = 所有启用的工具）→ 写入 config.enabledToolGroups
 * - 勾选工具加入/移出某个组 → toolManager 的组数据
 * - 把当前生效集合另存为命名组
 * - 展示工具环境变量开关（KX2_TOOL_DEF_<NAME>）与本次会发送的工具清单
 *
 * 主进程在「每次请求」时重新解析，改完不用重启，下一条消息就生效。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Layers, Zap, Save, RefreshCw, Info, AlertTriangle, Search, CheckSquare, Square, SlidersHorizontal, Monitor,
} from 'lucide-react'

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
const SKIPPED_PREVIEW_LIMIT = 48

/** 工具名 → 环境变量名（与主进程 toolRuntime.toolEnvKey 保持一致） */
function toolEnvName(name: string): string {
  return 'KX2_TOOL_DEF_' + String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

/** 平台是否属于当前运行环境 */
function isPlatformMatch(platform: string): boolean {
  const isWindows = navigator.userAgent.includes('Windows')
  if (!platform || platform === 'all') return true
  if (platform === 'windows') return isWindows
  if (platform === 'unix') return !isWindows
  return true
}

/** 按平台归组，用于折叠展示 */
function groupByPlatform(tools: ToolDef[]): { platform: string; label: string; items: ToolDef[] }[] {
  const order: Array<{ key: string; label: string }> = [
    { key: 'all', label: '全部平台' },
    { key: 'windows', label: 'Windows' },
    { key: 'unix', label: 'Unix' },
  ]
  const buckets: Record<string, ToolDef[]> = {}
  for (const tt of tools) {
    const key = tt.platform || 'all'
    ;(buckets[key] ??= []).push(tt)
  }
  return order
    .filter(o => (buckets[o.key] || []).length > 0)
    .map(o => ({ platform: o.key, label: o.label, items: buckets[o.key]! }))
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
  const [localTools, setLocalTools] = useState<ToolDef[]>(tools)
  const [localGroups, setLocalGroups] = useState<ToolGroup[]>(groups)
  const [activeIds, setActiveIds] = useState<string[]>([])
  const [editingGroupId, setEditingGroupId] = useState<string>(GLOBAL_ID)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberPlatform, setMemberPlatform] = useState<string>('all')
  const [saving, setSaving] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsError, setSaveAsError] = useState('')
  const [message, setMessage] = useState('')

  const api = window.electronAPI.tools

  // 外部 props 变化时同步到本地状态（全量刷新场景）
  useEffect(() => { setLocalTools(tools) }, [tools])
  useEffect(() => { setLocalGroups(groups) }, [groups])

  // 读取当前生效组（存在 config.enabledToolGroups，空数组 = 全局组）
  const loadActive = useCallback(async () => {
    try {
      const cfg = await window.electronAPI.config.get()
      setActiveIds((cfg as { enabledToolGroups?: string[] })?.enabledToolGroups || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadActive() }, [loadActive])

  // 乐观更新：本地工具状态（启用/禁用）
  const updateLocalTool = useCallback((id: string, enabled: boolean) => {
    setLocalTools(prev => prev.map(t => t.id === id ? { ...t, enabled } : t))
  }, [])

  // 乐观更新：本地分组状态
  const updateLocalGroup = useCallback((groupId: string, updater: (g: ToolGroup) => ToolGroup) => {
    setLocalGroups(prev => prev.map(g => g.id === groupId ? updater(g) : g))
  }, [])

  // 当前编辑目标（全局组 / 命名组）— 用本地状态，不触发重渲染
  const editing = editingGroupId === GLOBAL_ID
    ? { id: GLOBAL_ID, name: t('tools.globalGroup', '全局组'), toolIds: localTools.map(x => x.id) }
    : localGroups.find(g => g.id === editingGroupId) || { id: GLOBAL_ID, name: t('tools.globalGroup', '全局组'), toolIds: localTools.map(x => x.id) }

  // 判断某工具是否处于「当前编辑组内被勾选」状态
  const isCheckedIn = useCallback((tool: ToolDef): boolean => {
    if (editingGroupId === GLOBAL_ID) {
      // 从本地状态读取，保证勾选框即时响应
      const local = localTools.find(t => t.id === tool.id || t.name === tool.name)
      return local ? local.enabled : tool.enabled
    }
    return editing.toolIds.some(id => id === tool.id || id === tool.name)
  }, [editingGroupId, editing.toolIds, localTools])

  // 真正会发给模型的工具（用本地状态计算，不触发 IPC）
  const effective = useMemo(() => {
    if (activeIds.length === 0) {
      return {
        isGlobal: true,
        label: t('tools.globalGroup', '全局组'),
        tools: localTools.filter(x => x.enabled && isPlatformMatch(x.platform)),
        skipped: localTools.filter(x => !x.enabled || !isPlatformMatch(x.platform)).map(x => x.name),
      }
    }
    const picked: ToolDef[] = []
    const seen = new Set<string>()
    for (const gid of activeIds) {
      const g = localGroups.find(x => x.id === gid)
      if (!g) continue
      for (const tid of g.toolIds) {
        if (seen.has(tid)) continue
        seen.add(tid)
        const tool = localTools.find(x => x.id === tid || x.name === tid)
        if (tool) picked.push(tool)
      }
    }
    const usable = picked.filter(x => x.enabled && isPlatformMatch(x.platform))
    return {
      isGlobal: false,
      label: activeIds.map(id => localGroups.find(g => g.id === id)?.name || id).join(' + '),
      tools: usable.length > 0 ? usable : localTools.filter(x => x.enabled && isPlatformMatch(x.platform)),
      skipped: picked.filter(x => !x.enabled || !isPlatformMatch(x.platform)).map(x => x.name),
    }
  }, [activeIds, localGroups, localTools, t])

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

  // 切换单个工具归属（乐观更新 + 后台持久化）
  const toggleToolInGroup = useCallback(async (tool: ToolDef, checked: boolean) => {
    if (checked === isCheckedIn(tool)) {
      setMessage(t('tools.noChange', '该工具已是目标状态'))
      return
    }
    // 乐观更新：立即反映到本地状态
    if (editingGroupId === GLOBAL_ID) {
      updateLocalTool(tool.id, checked)
    } else {
      updateLocalGroup(editingGroupId, g =>
        checked
          ? { ...g, toolIds: [...g.toolIds, tool.id] }
          : { ...g, toolIds: g.toolIds.filter(id => id !== tool.id) }
      )
    }
    setMessage('')
    try {
      if (editingGroupId === GLOBAL_ID) {
        await api.toggle(tool.id)
      } else if (checked) {
        await api.addToGroup(tool.id, editingGroupId)
      } else {
        await api.removeFromGroup(tool.id, editingGroupId)
      }
    } catch (e) {
      // 失败回滚：重新从服务器加载
      setMessage(`${t('tools.updateFailed', '更新失败')}: ${(e as Error).message}`)
      onChanged()
    }
  }, [api, editingGroupId, isCheckedIn, onChanged, t, updateLocalTool, updateLocalGroup])

  // 批量操作当前过滤结果（全选 / 清空）（乐观更新）
  const applyBatch = useCallback(async (checked: boolean) => {
    const kw = memberSearch.trim().toLowerCase()
    const pf = memberPlatform
    let base = kw
      ? localTools.filter(x => x.name.toLowerCase().includes(kw)
        || (x.displayName || '').toLowerCase().includes(kw)
        || (x.description || '').toLowerCase().includes(kw))
      : localTools
    if (pf !== 'all') {
      base = base.filter(x => (x.platform || 'all') === pf)
    }
    const target = base
    if (target.length === 0) return
    // 乐观更新
    if (editingGroupId === GLOBAL_ID) {
      setLocalTools(prev => prev.map(t =>
        target.some(tt => tt.id === t.id) ? { ...t, enabled: checked } : t
      ))
    } else {
      updateLocalGroup(editingGroupId, g => {
        const inIds = new Set(g.toolIds)
        const addIds = target.filter(t => checked !== (inIds.has(t.id) || inIds.has(t.name))).map(t => t.id)
        const newToolIds = checked
          ? [...g.toolIds, ...addIds]
          : g.toolIds.filter(id => !addIds.includes(id))
        return { ...g, toolIds: newToolIds }
      })
    }
    setMessage(checked
      ? t('tools.batchAddDone', '已对 {{n}} 个工具批量启用').replace('{{n}}', String(target.length))
      : t('tools.batchRemoveDone', '已对 {{n}} 个工具批量关闭').replace('{{n}}', String(target.length)))
    try {
      if (editingGroupId === GLOBAL_ID) {
        const jobs = target.filter(x => x.enabled !== checked).map(x => api.toggle(x.id))
        await Promise.all(jobs)
      } else {
        const inIds = new Set(editing.toolIds)
        const jobs = target
          .filter(x => !(checked === (inIds.has(x.id) || inIds.has(x.name))))
          .map(x => checked ? api.addToGroup(x.id, editingGroupId) : api.removeFromGroup(x.id, editingGroupId))
        await Promise.all(jobs)
      }
    } catch (e) {
      setMessage(`${t('tools.batchFailed', '批量操作失败')}: ${(e as Error).message}`)
      onChanged()
    }
  }, [api, editingGroupId, memberSearch, memberPlatform, localTools, editing.toolIds, onChanged, t, updateLocalGroup])

  const handleSaveAs = useCallback(async () => {
    const name = saveAsName.trim()
    if (!name) { setSaveAsError(t('tools.nameRequired', '请填写组名称')); return }
    if (localGroups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
      setSaveAsError(t('tools.nameConflict', '已存在同名分组'))
      return
    }
    try {
      const newGroup = await api.addGroup({
        name,
        description: t('tools.savedFromCurrent', '由当前生效工具另存'),
        toolIds: effective.tools.map(x => x.id),
        enabled: true,
      })
      setLocalGroups(prev => [...prev, newGroup.data || { id: 'group-' + Date.now(), name, description: t('tools.savedFromCurrent', '由当前生效工具另存'), toolIds: effective.tools.map(x => x.id), enabled: true, builtin: false }])
      setShowSaveAs(false)
      setSaveAsName('')
      setSaveAsError('')
      setMessage(t('tools.savedAsGroupDone', '已另存为新组：{{name}}').replace('{{name}}', name))
    } catch (e) {
      setSaveAsError(`${t('tools.saveFailed', '另存失败')}: ${(e as Error).message}`)
    }
  }, [api, effective.tools, localGroups, onChanged, saveAsName, t])

  // 成员列表：带搜索 + 平台过滤 + 按平台分组
  const memberList = useMemo(() => {
    const kw = memberSearch.trim().toLowerCase()
    const pf = memberPlatform
    let base = kw
      ? localTools.filter(x => x.name.toLowerCase().includes(kw)
        || (x.displayName || '').toLowerCase().includes(kw)
        || (x.description || '').toLowerCase().includes(kw))
      : localTools
    if (pf !== 'all') {
      base = base.filter(x => (x.platform || 'all') === pf)
    }
    return groupByPlatform(base)
  }, [localTools, memberSearch, memberPlatform])

  const memberTotal = memberList.reduce((acc, s) => acc + s.items.length, 0)

  return (
    <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between flex-wrap gap-2 text-base">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t('tools.effectiveTitle', '当前生效工具组')}
          </span>
          <Button size="sm" variant="ghost" onClick={() => { loadActive(); onChanged() }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
        <CardDescription>
          {t('tools.effectiveDesc', '选中某个组后，只有组内（且已启用、平台匹配）的工具会随请求发送给模型；选全局组则发送所有已启用工具。改完下一条消息立即生效。')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 1) 生效组切换 */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={activeIds.length === 0 ? 'default' : 'outline'} disabled={saving} onClick={() => applyActive([])}>
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
        </div>

        {/* 2) 生效结果 */}
        <div className="rounded border border-[var(--border)] p-3 text-xs space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{effective.label}</Badge>
            <span className="text-[var(--text-muted)]">
              {t('tools.effectiveCount', '本次发送工具数')}: <strong className="text-[var(--text-primary)]">{effective.tools.length}</strong> / {tools.length}
            </span>
            {effective.skipped.length > 0 && (
              <span className="text-[var(--warning)]">
                <AlertTriangle className="inline h-3 w-3 mr-0.5" />
                {t('tools.skippedCount', '{{n}} 个被跳过').replace('{{n}}', String(effective.skipped.length))}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 pt-1">
            {effective.tools.slice(0, 60).map(x => (
              <span
                key={x.id}
                className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono text-[10px] cursor-default"
                title={`${toolEnvName(x.name)}=1\n${x.description || ''}`}
              >
                {x.name}
              </span>
            ))}
            {effective.tools.length > 60 && (
              <span className="px-1 text-[10px] text-[var(--text-muted)]">+{effective.tools.length - 60}</span>
            )}
            {effective.tools.length === 0 && (
              <span className="flex items-center gap-1 text-[var(--warning)]">
                <AlertTriangle className="h-3 w-3" />
                {t('tools.noEffectiveTools', '当前没有任何可用工具，模型将无法调用工具')}
              </span>
            )}
          </div>

          {effective.skipped.length > 0 && (
            <>
              <Separator className="my-1" />
              <details>
                <summary className="cursor-pointer select-none text-[var(--text-muted)]">
                  {t('tools.skippedTools', '未发送（已关闭或平台不符）')} ({effective.skipped.length})
                </summary>
                <div className="mt-1 flex flex-wrap gap-1">
                  {effective.skipped.slice(0, SKIPPED_PREVIEW_LIMIT).map(n => (
                    <span key={n} className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-dashed border-[var(--border)] font-mono text-[10px] text-[var(--text-dim)] line-through">
                      {n}
                    </span>
                  ))}
                  {effective.skipped.length > SKIPPED_PREVIEW_LIMIT && (
                    <span className="px-1 text-[10px] text-[var(--text-muted)]">+{effective.skipped.length - SKIPPED_PREVIEW_LIMIT}</span>
                  )}
                </div>
              </details>
            </>
          )}
        </div>

        <Separator />

        {/* 3) 编辑目标 + 另存为 */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-[var(--text-muted)] mb-1">{t('tools.editGroupMembers', '编辑此组的工具')}</div>
            <select
              className="w-full text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1.5"
              value={editingGroupId}
              onChange={e => { setEditingGroupId(e.target.value); setMemberSearch('') }}
            >
              <option value={GLOBAL_ID}>{t('tools.globalGroupAll', '全局组（勾选=启用/关闭工具）')}</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}（{g.toolIds.length}）</option>
              ))}
            </select>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowSaveAs(true)}>
            <Save className="h-3.5 w-3.5 mr-1" />
            {t('tools.saveAsGroup', '另存为组')}
          </Button>
        </div>

        {/* 4) 成员：搜索 + 平台过滤 + 批量 + 分组列表 */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
              <Input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder={t('tools.filterToolsHint', '搜索工具名/别名/描述…')}
                className="pl-7 h-8 text-xs"
              />
            </div>
            <select
              className="h-8 text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-1.5"
              value={memberPlatform}
              onChange={e => setMemberPlatform(e.target.value)}
            >
              <option value="all">{t('common.all', '全部平台')}</option>
              <option value="windows">Windows</option>
              <option value="unix">Unix</option>
            </select>
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <SlidersHorizontal className="h-3 w-3" />
              {t('tools.memberCount', '{{count}} / {{total}}').replace('{{count}}', String(memberTotal)).replace('{{total}}', String(tools.length))}
            </span>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => applyBatch(true)}>
              <CheckSquare className="h-3.5 w-3.5 mr-1" /> {t('tools.memberAll', '全选')}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => applyBatch(false)}>
              <Square className="h-3.5 w-3.5 mr-1" /> {t('tools.memberNone', '清空')}
            </Button>
          </div>

          <div className="rounded border border-[var(--border)] max-h-[380px] overflow-y-auto">
            {memberList.length === 0 ? (
              <div className="p-3 text-xs text-[var(--text-muted)]">{t('tools.noMatchTool', '没有匹配的工具')}</div>
            ) : (
              <div>
                {memberList.map(section => (
                  <div key={section.platform} className="border-b border-[var(--border)] last:border-b-0">
                    <div className="px-2 py-1.5 bg-[var(--bg-secondary)] sticky top-0 z-10 flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{section.label}</span>
                      <span className="text-[10px] text-[var(--text-dim)]">({section.items.length})</span>
                    </div>
                    {section.items.map(tool => {
                      const checked = isCheckedIn(tool)
                      const platformOk = isPlatformMatch(tool.platform)
                      return (
                        <label key={tool.id} className="flex items-center gap-2 p-2 text-xs cursor-pointer hover:bg-[var(--bg-hover)]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => toggleToolInGroup(tool, e.target.checked)}
                            className="accent-[var(--accent-primary)]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{tool.name}</span>
                              {tool.displayName && tool.displayName !== tool.name && (
                                <span className="text-[var(--text-muted)]">{tool.displayName}</span>
                              )}
                              {tool.builtin && <Badge variant="secondary" className="text-[10px]">内置</Badge>}
                            </div>
                            <div className="truncate text-[var(--text-dim)]" title={tool.description}>{tool.description}</div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            {!platformOk && (
                              <span className="text-[10px] text-[var(--warning)]">{t('tools.platformMismatch', '当前平台不适用')}</span>
                            )}
                            <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                              title={t('tools.envTitle', '环境变量开关：1=启用 0=禁用')}>
                              {checked ? '1' : '0'}
                            </code>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className="flex items-center gap-2 rounded bg-[var(--accent-primary)]/10 px-2 py-1.5 text-xs text-[var(--accent-primary)]">
            <Info className="h-3.5 w-3.5" /> {message}
          </div>
        )}
      </CardContent>

      {/* 另存为组 */}
      <Dialog open={showSaveAs} onOpenChange={(v) => { setShowSaveAs(v); if (!v) setSaveAsError('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tools.saveAsTitle', '另存为新组')}</DialogTitle>
            <DialogDescription>
              {t('tools.saveAsHintDialog', '将保存当前生效的 {{count}} 个工具为命名组').replace('{{count}}', String(effective.tools.length))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('tools.newGroupName', '新组名称')}</Label>
              <Input
                value={saveAsName}
                onChange={e => { setSaveAsName(e.target.value); if (saveAsError) setSaveAsError('') }}
                placeholder={t('tools.newGroupNamePlaceholder', '例如：编程')}
              />
            </div>
            {saveAsError && <p className="text-xs text-red-400">{saveAsError}</p>}
            <div className="max-h-[120px] overflow-auto rounded border border-[var(--border)] p-2 flex flex-wrap gap-1">
              {effective.tools.map(x => (
                <span key={x.id} className="rounded border border-[var(--border)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[10px]">{x.name}</span>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSaveAs(false)}>{t('common.cancel', '取消')}</Button>
            <Button size="sm" disabled={!saveAsName.trim()} onClick={handleSaveAs}>{t('tools.confirmSave', '保存')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}