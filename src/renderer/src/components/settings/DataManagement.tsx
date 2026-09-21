import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useSettingsStore, LogLevel } from '@/stores/settingsStore'
import { LogCategoryConfig } from './LogCategoryConfig'
import { useToast } from '@/hooks/use-toast'
import { Database, Download, Upload, Trash2, RotateCcw, AlertTriangle, HardDrive, History } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'

export function DataManagement() {
  const { t } = useTranslation()
  const {
    logLevel,
    setLogLevel,
    logRetentionDays,
    setLogRetentionDays,
    maxLogs,
    setMaxLogs,
    config,
    updateConfig,
  } = useSettingsStore()
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // ---- 全量备份 / 恢复（mgmt.* IPC）----
  // 说明：上面那对「导出/导入配置」只操作渲染层的 localStorage 缓存，
  // 不包含 electron-store 里的真实配置（账户、供应商、代理、工具等）。
  // 这里接的是后端 mgmt.backup/restore，操作 userData 下的全部 store 文件。
  const [backups, setBackups] = useState<Array<{ name: string; path: string }>>([])
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [restoringName, setRestoringName] = useState<string | null>(null)

  const requestLogConfig = config?.requestLogConfig ?? {
    enabled: true,
    logToConsole: false,
    maxEntries: 200,
    includeBodies: true,
    maxBodyChars: 8000,
    redactSensitiveData: true,
  }

  const updateRequestLogConfig = async (
    updates: Partial<typeof requestLogConfig>,
  ) => {
    await updateConfig({
      requestLogConfig: {
        ...requestLogConfig,
        ...updates,
      } as typeof requestLogConfig,
    })
  }

  const handleExportConfig = async () => {
    setIsExporting(true)
    try {
      const config = {
        version: '1.1.2',
        exportedAt: new Date().toISOString(),
        settings: localStorage.getItem('chat2api-settings'),
      }
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chat2api-config-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({
        title: t('common.success'),
        description: t('settings.exportSuccess'),
      })
    } catch {
      toast({
        title: t('common.error'),
        description: t('settings.exportFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const config = JSON.parse(text)
      if (config.settings) {
        localStorage.setItem('chat2api-settings', config.settings)
        toast({
          title: t('common.success'),
          description: t('settings.importSuccess'),
        })
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } catch {
      toast({
        title: t('common.error'),
        description: t('settings.importFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  const handleClearCache = async () => {
    setIsClearing(true)
    try {
      sessionStorage.clear()
      toast({
        title: t('common.success'),
        description: t('settings.cacheCleared'),
      })
    } catch {
      toast({
        title: t('common.error'),
        description: t('settings.cacheClearFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsClearing(false)
    }
  }

  const handleResetApp = async () => {
    setIsResetting(true)
    try {
      localStorage.clear()
      sessionStorage.clear()
      
      if (window.electronAPI?.store?.clearAll) {
        await window.electronAPI.store.clearAll()
      }
      
      toast({
        title: t('common.success'),
        description: t('settings.resetSuccess'),
      })
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch {
      toast({
        title: t('common.error'),
        description: t('settings.resetFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsResetting(false)
    }
  }

  // ==================== 全量备份 / 恢复 ====================

  const refreshBackups = useCallback(async () => {
    try {
      const r = await window.electronAPI.mgmt.getAllBackups()
      if (r.success && r.data) setBackups(r.data)
    } catch {
      /* 列表读取失败不打扰用户，下次操作再报 */
    }
  }, [])

  useEffect(() => {
    void refreshBackups()
  }, [refreshBackups])

  const handleBackup = async () => {
    setIsBackingUp(true)
    try {
      const r = await window.electronAPI.mgmt.backup()
      if (r.success) {
        toast({
          title: t('common.success'),
          description: t('settings.backupCreated', '备份已创建：{{name}}', {
            name: r.path?.split(/[\\/]/).pop() || '',
          }),
        })
        await refreshBackups()
      } else {
        toast({ title: r.error || t('settings.backupFailed', '备份失败'), variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' })
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleRestore = async (filePath: string) => {
    setRestoringName(filePath)
    try {
      const r = await window.electronAPI.mgmt.restore(filePath)
      if (r.success) {
        // 恢复的是 store 数据，当前界面仍持有旧值 —— 必须重载才能看到新配置
        const total = r.restored
          ? Object.values(r.restored).reduce((n, v) => n + v, 0)
          : 0
        toast({
          title: t('common.success'),
          description: t('settings.restoreDone', '已恢复 {{count}} 条记录，即将刷新界面', { count: total }),
        })
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast({ title: r.error || t('settings.restoreFailed', '恢复失败'), variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' })
    } finally {
      setRestoringName(null)
    }
  }

  const handleDeleteBackup = async (fileName: string) => {
    try {
      const r = await window.electronAPI.mgmt.deleteBackup(fileName)
      if (r.success) {
        toast({ title: t('settings.backupDeleted', '备份已删除') })
        await refreshBackups()
      } else {
        toast({ title: r.error || t('settings.backupDeleteFailed', '删除失败'), variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <Database className="h-4 w-4 text-[var(--accent-primary)]" />
            </div>
            {t('settings.logSettings')}
          </CardTitle>
          <CardDescription>{t('settings.logRetentionDays')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
              <Label htmlFor="log-level">{t('settings.logLevel')}</Label>
              <Select value={logLevel} onValueChange={(value) => setLogLevel(value as LogLevel)}>
                <SelectTrigger id="log-level">
                  <SelectValue placeholder={t('settings.selectLogLevel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('settings.logLevelHelp')}</p>
            </div>
            <div className="space-y-2 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
              <Label htmlFor="log-retention">{t('settings.logRetentionDays')}</Label>
              <Input
                id="log-retention"
                type="number"
                min={1}
                max={365}
                value={logRetentionDays}
                onChange={(e) => setLogRetentionDays(parseInt(e.target.value) || 30)}
              />
              <p className="text-xs text-muted-foreground">{t('settings.logRetentionHelp')}</p>
            </div>
            <div className="space-y-2 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
              <Label htmlFor="max-logs">{t('settings.maxLogs')}</Label>
              <Input
                id="max-logs"
                type="number"
                min={100}
                max={100000}
                value={maxLogs}
                onChange={(e) => setMaxLogs(parseInt(e.target.value) || 10000)}
              />
              <p className="text-xs text-muted-foreground">{t('settings.maxLogsHelp')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
              <div className="space-y-1">
                <Label htmlFor="request-log-enabled">{t('settings.requestLogEnabled')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.requestLogEnabledHelp')}</p>
              </div>
              <Switch
                id="request-log-enabled"
                checked={requestLogConfig.enabled}
                onCheckedChange={(checked) => {
                  void updateRequestLogConfig({ enabled: checked })
                }}
              />
            </div>

            {requestLogConfig.enabled ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
                  <Label htmlFor="request-log-max-entries">{t('settings.requestLogMaxEntries')}</Label>
                  <Input
                    id="request-log-max-entries"
                    type="number"
                    min={0}
                    max={10000}
                    value={requestLogConfig.maxEntries}
                    onChange={(e) => {
                      void updateRequestLogConfig({ maxEntries: parseInt(e.target.value, 10) || 0 })
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.requestLogMaxEntriesHelp')}</p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
                  <div className="space-y-1 pr-3">
                    <Label htmlFor="request-log-bodies">{t('settings.requestLogIncludeBodies')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.requestLogIncludeBodiesHelp')}</p>
                  </div>
                  <Switch
                    id="request-log-bodies"
                    checked={requestLogConfig.includeBodies}
                    onCheckedChange={(checked) => {
                      void updateRequestLogConfig({
                        includeBodies: checked,
                        maxBodyChars: checked ? Math.max(requestLogConfig.maxBodyChars, 8000) : requestLogConfig.maxBodyChars,
                      })
                    }}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
                  <div className="space-y-1 pr-3">
                    <Label htmlFor="request-log-redact">{t('settings.requestLogRedactSensitive')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.requestLogRedactSensitiveHelp')}</p>
                  </div>
                  <Switch
                    id="request-log-redact"
                    checked={requestLogConfig.redactSensitiveData}
                    onCheckedChange={(checked) => {
                      void updateRequestLogConfig({ redactSensitiveData: checked })
                    }}
                  />
                </div>

                {requestLogConfig.includeBodies ? (
                  <div className="space-y-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 md:col-span-2 xl:col-span-3">
                    <Label htmlFor="request-log-max-body">{t('settings.requestLogMaxBodyChars')}</Label>
                    <Input
                      id="request-log-max-body"
                      type="number"
                      min={0}
                      max={1000000}
                      value={requestLogConfig.maxBodyChars}
                      onChange={(e) => {
                        void updateRequestLogConfig({ maxBodyChars: parseInt(e.target.value, 10) || 0 })
                      }}
                    />
                    <p className="text-xs text-muted-foreground">{t('settings.requestLogMaxBodyCharsHelp')}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 细分日志分类配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <Database className="h-4 w-4 text-[var(--accent-primary)]" />
            </div>
            {t('settings.logCategories') || '日志分类配置'}
          </CardTitle>
          <CardDescription>{t('settings.logCategoriesDesc') || '按子系统独立控制日志级别和开关'}</CardDescription>
        </CardHeader>
        <CardContent>
          <LogCategoryConfig />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <Download className="h-4 w-4 text-[var(--accent-primary)]" />
            </div>
            {t('settings.dataManagement')}
          </CardTitle>
          <CardDescription>{t('settings.dataManagementDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleExportConfig}
              disabled={isExporting}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? t('settings.exporting') : t('settings.exportConfig')}
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportConfig}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isImporting}
              />
              <Button
                variant="outline"
                disabled={isImporting}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {isImporting ? t('settings.importing') : t('settings.importConfig')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ==================== 全量备份 / 恢复 ==================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-[var(--accent-primary)]" />
            </div>
            {t('settings.fullBackup', '全量备份')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.fullBackupDesc',
              '备份 userData 下的全部配置（账户、供应商、代理、工具、分组等）。与上方"导出配置"不同：那个只包含界面缓存，这个才是完整数据。',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleBackup()}
              disabled={isBackingUp}
              className="flex items-center gap-2"
            >
              <HardDrive className="h-4 w-4" />
              {isBackingUp ? t('settings.backingUp', '备份中...') : t('settings.createBackup', '创建备份')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void refreshBackups()}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {t('tools.refresh', '刷新')}
            </Button>
          </div>

          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('settings.noBackups', '暂无备份。点击"创建备份"生成第一份。')}
            </p>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate" title={b.path}>
                      {b.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={b.path}>
                      {b.path}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleRestore(b.path)}
                      disabled={restoringName !== null}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      {restoringName === b.path
                        ? t('settings.restoring', '恢复中...')
                        : t('settings.restore', '恢复')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDeleteBackup(b.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t(
              'settings.restoreHint',
              '恢复采用"仅新增"策略：已存在的同 ID 记录会被跳过，不会覆盖当前数据。',
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('settings.dangerZone')}
          </CardTitle>
          <CardDescription>{t('settings.dangerZoneDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleClearCache}
              disabled={isClearing}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isClearing ? t('settings.clearing') : t('settings.clearCache')}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {t('settings.resetApp')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('settings.confirmReset')}</DialogTitle>
                  <DialogDescription>
                    {t('settings.confirmResetDesc')}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">
                      {t('common.cancel')}
                    </Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={handleResetApp}
                    disabled={isResetting}
                  >
                    {isResetting ? t('settings.resetting') : t('settings.confirmReset')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
