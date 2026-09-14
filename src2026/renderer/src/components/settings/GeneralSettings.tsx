import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useSettingsStore, CloseBehavior, OAuthProxyMode } from '@/stores/settingsStore'
import { Bell, Minimize2, Power, Globe, Terminal, Clock, RotateCcw } from 'lucide-react'

export function GeneralSettings() {
  const { t } = useTranslation()
  const {
    autoStart,
    setAutoStart,
    autoStartProxy,
    setAutoStartProxy,
    minimizeToTray,
    setMinimizeToTray,
    closeBehavior,
    setCloseBehavior,
    enableNotifications,
    setEnableNotifications,
    oauthProxyMode,
    setOauthProxyMode,
    config,
    updateConfig,
  } = useSettingsStore()

  const handleRequestTimeoutChange = async (value: string) => {
    const ms = Math.max(0, parseInt(value) || 0)
    await updateConfig({ requestTimeout: ms })
  }

  const handleRetryCountChange = async (value: string) => {
    const count = Math.max(0, parseInt(value) || 0)
    await updateConfig({ retryCount: count })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            {t('settings.autoStart')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-start">{t('settings.autoStart')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.autoStartHelp')}</p>
            </div>
            <Switch
              id="auto-start"
              checked={autoStart}
              onCheckedChange={setAutoStart}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-start-proxy">{t('settings.autoStartProxy')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.autoStartProxyHelp')}</p>
            </div>
            <Switch
              id="auto-start-proxy"
              checked={autoStartProxy}
              onCheckedChange={setAutoStartProxy}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Minimize2 className="h-5 w-5" />
            {t('settings.closeBehavior')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="minimize-tray">{t('settings.minimizeToTray')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.minimizeToTrayHelp')}</p>
            </div>
            <Switch
              id="minimize-tray"
              checked={minimizeToTray}
              onCheckedChange={setMinimizeToTray}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.closeBehavior')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.closeBehaviorHelp')}</p>
            </div>
            <Select
              value={closeBehavior}
              onValueChange={(value) => setCloseBehavior(value as CloseBehavior)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('settings.closeBehavior')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimize">{t('settings.closeBehaviorMinimize')}</SelectItem>
                <SelectItem value="close">{t('settings.closeBehaviorClose')}</SelectItem>
                <SelectItem value="ask">{t('settings.closeBehaviorAsk')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('settings.notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">{t('settings.enableNotifications')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.enableNotificationsHelp')}</p>
            </div>
            <Switch
              id="notifications"
              checked={enableNotifications}
              onCheckedChange={setEnableNotifications}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {t('settings.apiLogging')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="log-to-console">{t('settings.logToConsole')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.logToConsoleHelp')}</p>
            </div>
            <Switch
              id="log-to-console"
              checked={config?.requestLogConfig?.logToConsole ?? false}
              onCheckedChange={async (checked) => {
                await updateConfig({
                  requestLogConfig: {
                    enabled: config?.requestLogConfig?.enabled ?? true,
                    logToConsole: checked,
                    maxEntries: config?.requestLogConfig?.maxEntries ?? 1000,
                    includeBodies: config?.requestLogConfig?.includeBodies ?? true,
                    maxBodyChars: config?.requestLogConfig?.maxBodyChars ?? 8000,
                    redactSensitiveData: config?.requestLogConfig?.redactSensitiveData ?? true,
                  },
                })
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('settings.networkProxy')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.oauthProxyMode')}</Label>
              <p className="text-sm text-muted-foreground">{t('settings.oauthProxyModeHelp')}</p>
            </div>
            <Select
              value={oauthProxyMode}
              onValueChange={(value) => setOauthProxyMode(value as OAuthProxyMode)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('settings.oauthProxyMode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t('settings.oauthProxySystem')}</SelectItem>
                <SelectItem value="none">{t('settings.oauthProxyNone')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            请求与重试
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="request-timeout">请求超时（ms）</Label>
              <p className="text-sm text-muted-foreground">API 请求的最大等待时间，0 表示不限制</p>
            </div>
            <Input
              id="request-timeout"
              type="number"
              className="w-[140px]"
              value={config?.requestTimeout ?? 0}
              onChange={(e) => handleRequestTimeoutChange(e.target.value)}
              onBlur={(e) => { if (!e.target.value) void handleRequestTimeoutChange('0') }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="retry-count">重试次数</Label>
              <p className="text-sm text-muted-foreground">请求失败后的自动重试次数</p>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <Input
                id="retry-count"
                type="number"
                className="w-[100px]"
                min={0}
                max={10}
                value={config?.retryCount ?? 0}
                onChange={(e) => handleRetryCountChange(e.target.value)}
                onBlur={(e) => { if (!e.target.value) void handleRetryCountChange('0') }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
