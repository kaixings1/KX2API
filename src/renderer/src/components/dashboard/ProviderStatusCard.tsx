import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Server, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import type { ProviderStatus } from '@/types/electron'

export interface ProviderStats {
  id: string
  name: string
  status: ProviderStatus
  requestCount: number
  successCount: number
  quotaUsed?: number
  quotaTotal?: number
  latency?: number
}

export interface ProviderStatusCardProps {
  providers: ProviderStats[]
  className?: string
}

// 单行高度 + 行间距，用于计算滚动区高度
const ITEM_HEIGHT = 96
const GAP = 8
const MAX_VISIBLE_ROWS = 7

export function ProviderStatusCard({ providers, className }: ProviderStatusCardProps) {
  const { t } = useTranslation()

  const getStatusIcon = (status: ProviderStatus) => {
    switch (status) {
      case 'online':
        return <Wifi className="h-3 w-3" />
      case 'offline':
        return <WifiOff className="h-3 w-3" />
      default:
        return <AlertCircle className="h-3 w-3" />
    }
  }

  const getStatusColor = (status: ProviderStatus) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'offline':
        return 'bg-red-500'
      default:
        return 'bg-yellow-500'
    }
  }

  const getStatusBadge = (status: ProviderStatus) => {
    switch (status) {
      case 'online':
        return 'default'
      case 'offline':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusText = (status: ProviderStatus) => {
    switch (status) {
      case 'online':
        return t('providers.online')
      case 'offline':
        return t('providers.offline')
      default:
        return t('providers.unknown')
    }
  }

  const getSuccessRate = (success: number, total: number) => {
    if (total === 0) return 0
    return Math.round((success / total) * 100)
  }

  // 高度按实际供应商数量收缩：以前固定算 7 行（≈664px），
  // 只有一两个供应商时卡片里会空出一大片（看起来很“空”）。
  const visibleRows = Math.min(Math.max(providers.length, 1), MAX_VISIBLE_ROWS)
  const scrollHeight = ITEM_HEIGHT * visibleRows + GAP * Math.max(visibleRows - 1, 0)

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-7 w-7 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
            <Server className="h-4 w-4 text-[var(--accent-primary)]" />
          </div>
          {t('dashboard.providerStats')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-4 pt-0">
        {providers.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {t('providers.noProvidersFound')}
          </div>
        ) : (
          <ScrollArea className="pr-2" style={{ height: scrollHeight }}>
            <div className="space-y-2">
              {providers.map((provider) => {
                const successRate = getSuccessRate(
                  provider.successCount,
                  provider.requestCount
                )

                return (
                  <div
                    key={provider.id}
                    className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full',
                            getStatusColor(provider.status)
                          )}
                        />
                        <span className="font-medium text-sm">{provider.name}</span>
                      </div>
                      <Badge variant={getStatusBadge(provider.status) as "default" | "secondary" | "destructive"} className="text-xs">
                        {getStatusIcon(provider.status)}
                        <span className="ml-1">{getStatusText(provider.status)}</span>
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t('dashboard.totalRequests')}</span>
                        <p className="font-medium">{provider.requestCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('dashboard.successRate')}</span>
                        <p className="font-medium text-green-600 dark:text-green-400">{successRate}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('providers.latency')}</span>
                        <p className="font-medium">{provider.latency ? `${provider.latency}ms` : '-'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
