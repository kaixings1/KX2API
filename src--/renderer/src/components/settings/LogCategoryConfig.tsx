import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore } from '@/stores/settingsStore'
import type { LogCategory, LogCategoryConfig } from '@shared/types'
import { LOG_CATEGORY_LABELS, DEFAULT_LOG_CATEGORIES } from '@shared/types'

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const

export function LogCategoryConfig() {
  const { t } = useTranslation()
  const { setLogCategoryConfigs } = useSettingsStore()
  const [configs, setConfigs] = useState<Record<string, { level: string; enabled: boolean }>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await window.electronAPI.logs.getCategoryConfig()
        if (result.success && result.config) {
          const merged = { ...DEFAULT_LOG_CATEGORIES, ...result.config }
          setConfigs(merged)
          setLogCategoryConfigs(merged)
        } else {
          setConfigs({ ...DEFAULT_LOG_CATEGORIES })
        }
      } catch {
        setConfigs({ ...DEFAULT_LOG_CATEGORIES })
      } finally {
        setIsLoading(false)
      }
    }
    void loadConfig()
  }, [setLogCategoryConfigs])

  const handleToggle = (category: string) => {
    const updated = {
      ...configs,
      [category]: {
        ...(configs[category] || { level: 'info' }),
        enabled: !configs[category]?.enabled,
      },
    }
    setConfigs(updated)
    setLogCategoryConfigs(updated)
    void window.electronAPI.logs.updateCategoryConfig(updated)
  }

  const handleLevelChange = (category: string, level: string) => {
    const updated = {
      ...configs,
      [category]: {
        ...(configs[category] || { enabled: true }),
        level: level as LogCategoryConfig['level'],
      },
    }
    setConfigs(updated)
    setLogCategoryConfigs(updated)
    void window.electronAPI.logs.updateCategoryConfig(updated)
  }

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        {t('common.loading') || '加载中...'}
      </div>
    )
  }

  const categories = Object.keys(LOG_CATEGORY_LABELS) as LogCategory[]

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {categories.map((category) => {
        const config = configs[category] || { level: 'info', enabled: true }
        const label = LOG_CATEGORY_LABELS[category]
        return (
          <div
            key={category}
            className={`flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 ${
              !config.enabled ? 'opacity-50' : ''
            }`}
          >
            <div className="space-y-1 pr-3">
              <Label htmlFor={`log-cat-${category}`}>{label}</Label>
              <p className="text-xs text-muted-foreground">
                {config.enabled ? `级别: ${config.level}` : '已禁用'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={config.level}
                onValueChange={(value) => handleLevelChange(category, value)}
                disabled={!config.enabled}
              >
                <SelectTrigger id={`log-cat-level-${category}`} className="h-8 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOG_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl} className="text-xs">
                      {lvl.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Switch
                id={`log-cat-${category}`}
                checked={config.enabled}
                onCheckedChange={() => handleToggle(category)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
