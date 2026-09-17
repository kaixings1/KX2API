/**
 * ConfigGroupView — API 配置组管理视图
 *
 * 管理 .doge/*.json 配置组，支持创建、切换、删除配置组
 * 切换时执行完整的 login-equivalent 逻辑链
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import type { ConfigGroup, ConfigGroupData } from '@/types/electron'
import {
  FolderOpen,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronRight,
  Settings2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/design-system/Dialog'

type PresetInfo = {
  id: string
  provider: string
  model: string
  baseURL: string
  hasApiKey: boolean
}

export function ConfigGroupView() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [groups, setGroups] = useState<ConfigGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [groupDataMap, setGroupDataMap] = useState<Map<string, ConfigGroupData>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newGroupId, setNewGroupId] = useState('')

  const loadGroups = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI?.configGroups?.list?.()
      if (result?.success && result.groups) {
        setGroups(result.groups)
        setActiveGroupId(result.activeGroup ?? null)
        // 并行加载每个 group 的详细数据
        const dataMap = new Map<string, ConfigGroupData>()
        for (const g of result.groups) {
          try {
            const detail = await window.electronAPI.configGroups.get(g.id)
            if (detail?.success && detail.data) {
              dataMap.set(g.id, detail.data)
            }
          } catch {
            // skip
          }
        }
        setGroupDataMap(dataMap)
      }
    } catch (e) {
      console.error('Failed to load config groups:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const handleCreate = async () => {
    if (!newGroupId.trim()) return
    try {
      const result = await window.electronAPI.configGroups.create(newGroupId.trim())
      if (result?.success) {
        toast({
          title: '配置组已创建',
          description: `"${newGroupId}" 已成功创建`,
        })
        setNewGroupId('')
        setShowCreateDialog(false)
        loadGroups()
      } else {
        toast({
          title: '创建失败',
          description: result?.error || '配置组可能已存在',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '创建失败',
        description: '未知错误',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const result = await window.electronAPI.configGroups.delete(id)
      if (result?.success) {
        toast({
          title: '配置组已删除',
          description: `"${id}" 已删除`,
        })
        loadGroups()
      } else {
        toast({
          title: '删除失败',
          description: result?.error || '未知错误',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '删除失败',
        description: '未知错误',
        variant: 'destructive',
      })
    }
  }

  const handleSwitch = async (id: string) => {
    if (id === activeGroupId) return
    setIsSwitching(id)
    try {
      const result = await window.electronAPI.configGroups.switch(id)
      if (result?.success) {
        setActiveGroupId(id)
        toast({
          title: '配置已切换',
          description: `已切换到配置组 "${id}" (${result.preset ?? ''})`,
        })
        loadGroups()
      } else {
        toast({
          title: '切换失败',
          description: result?.error || '未知错误',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '切换失败',
        description: '未知错误',
        variant: 'destructive',
      })
    } finally {
      setIsSwitching(null)
    }
  }

  const getPresets = (groupId: string): PresetInfo[] => {
    const data = groupDataMap.get(groupId)
    if (!data?.presets) return []
    return Object.entries(data.presets).map(([id, preset]) => ({
      id,
      provider: preset.provider || 'unknown',
      model: preset.model || '-',
      baseURL: preset.baseURL || '-',
      hasApiKey: !!preset.apiKey,
    }))
  }

  const getActivePreset = (groupId: string): string | undefined => {
    return groupDataMap.get(groupId)?.activePreset
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">暂无配置组</p>
        <p className="text-sm mb-4">创建配置组来管理不同的 API 接入点</p>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建配置组
        </Button>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建配置组</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="配置组名称（如 f、k、test）"
                value={newGroupId}
                onChange={(e) => setNewGroupId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowCreateDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreate}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API 配置组</h2>
          <p className="text-muted-foreground text-sm">
            管理 .doge/*.json 配置文件，切换后即时生效
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          新建配置组
        </Button>
      </div>

      <div className="grid gap-3">
        {groups.map((group) => {
          const isActive = group.id === activeGroupId
          const isSwitchingThis = isSwitching === group.id
          const presets = getPresets(group.id)
          const activePreset = getActivePreset(group.id)

          return (
            <div
              key={group.id}
              className={`rounded-lg border p-4 transition-colors ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isActive ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {group.id}
                      {isActive && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          当前活跃
                        </span>
                      )}
                      {isSwitchingThis && (
                        <span className="text-xs bg-blue-500/20 text-blue-500 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          切换中...
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {group.fileName} · {presets.length} 个 preset
                      {activePreset && ` · 活跃: ${activePreset}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleSwitch(group.id)}
                      disabled={!!isSwitching}
                    >
                      {isSwitchingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Settings2 className="h-4 w-4 mr-1" />
                          切换
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(group.id)}
                    disabled={isActive}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Presets 列表 */}
              {presets.length > 0 && (
                <div className="mt-3 ml-8 space-y-1">
                  {presets.map((preset) => {
                    const isPresetActive = activePreset === preset.id
                    return (
                      <div
                        key={preset.id}
                        className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                          isPresetActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <ChevronRight className="h-3 w-3" />
                        <span className="font-mono">{preset.id}</span>
                        <span className="opacity-70">·</span>
                        <span>{preset.provider}</span>
                        <span className="opacity-70">·</span>
                        <span className="font-mono truncate max-w-[200px]">{preset.model}</span>
                        <span className="opacity-70">·</span>
                        <span className="truncate max-w-[200px]">{preset.baseURL}</span>
                        {preset.hasApiKey && (
                          <span className="text-green-500 dark:text-green-400">●</span>
                        )}
                        {isPresetActive && (
                          <span className="ml-auto text-[10px] bg-primary/20 px-1 rounded">活跃</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 创建对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建配置组</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="配置组名称（如 f、k、test）"
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
