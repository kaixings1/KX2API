import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ProxyConfigForm,
  LoadBalanceConfig,
  ProxyStatus,
  AdvancedConfig,
} from '@/components/proxy'
import { useProxyStore } from '@/stores/proxyStore'
import { Settings, Scale, Activity, Settings2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function ProxySettings() {
  const { t } = useTranslation()
  const { fetchAppConfig, fetchProxyStatus, fetchProxyStatistics } = useProxyStore()
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    fetchAppConfig()
    fetchProxyStatus()
    fetchProxyStatistics()
  }, [])

  const tabDescriptions: Record<string, string> = {
    status: t('proxy.statusDesc', '查看代理运行状态、端口、运行时间及请求统计'),
    basic: t('proxy.basicConfigDesc', '配置监听地址、端口及 CORS 设置'),
    loadbalance: t('proxy.loadBalanceConfigDesc', '设置负载均衡策略和各账号权重'),
    advanced: t('proxy.advancedConfigDesc', '高级网络与连接配置'),
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">{t('proxy.title')}</h2>
        <p className="text-muted-foreground">{t('proxy.description')}</p>
      </div>

      <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)]">
        <CardContent className="pt-4">
          <p className="text-xs text-[var(--text-dim)] leading-relaxed">
            {t('proxy.pageHelp', '此页面分为四个标签页：状态监控用于实时查看代理运行情况和请求统计；基本配置用于设置监听地址和端口；负载均衡用于配置转发策略；高级配置用于网络和连接调优。')}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="flex flex-wrap w-full gap-1 h-auto p-1">
          <TabsTrigger value="status" className="flex items-center gap-2 py-2 px-3 flex-1 min-w-0">
            <Activity className="h-4 w-4 flex-shrink-0" />
            <span className="hidden md:inline truncate">{t('proxy.statusMonitoring')}</span>
          </TabsTrigger>
          <TabsTrigger value="basic" className="flex items-center gap-2 py-2 px-3 flex-1 min-w-0">
            <Settings className="h-4 w-4 flex-shrink-0" />
            <span className="hidden md:inline truncate">{t('proxy.basicConfig')}</span>
          </TabsTrigger>
          <TabsTrigger value="loadbalance" className="flex items-center gap-2 py-2 px-3 flex-1 min-w-0">
            <Scale className="h-4 w-4 flex-shrink-0" />
            <span className="hidden md:inline truncate">{t('proxy.loadBalancing')}</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2 py-2 px-3 flex-1 min-w-0">
            <Settings2 className="h-4 w-4 flex-shrink-0" />
            <span className="hidden md:inline truncate">{t('proxy.advancedConfig')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-6">
          <ProxyStatus />
        </TabsContent>

        <TabsContent value="basic" className="mt-6">
          <ProxyConfigForm />
        </TabsContent>

        <TabsContent value="loadbalance" className="mt-6">
          <LoadBalanceConfig />
        </TabsContent>

        <TabsContent value="advanced" className="mt-6">
          <AdvancedConfig />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ProxySettings
