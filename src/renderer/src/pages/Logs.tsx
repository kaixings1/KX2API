import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionCard } from '@/components/ui/section-card'
import { RequestLogList } from '@/components/logs'
import { RequestLogStats } from '@/components/logs'
import { LogList, LogFilter, LogStats } from '@/components/logs'
import { useLogsStore } from '@/stores/logsStore'
import { BarChart3, List, FileText, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** URL 上 tab 参数的合法取值 */
const TAB_VALUES = new Set(['list', 'stats', 'app'])

export default function LogsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const initialTab = tabFromUrl && TAB_VALUES.has(tabFromUrl) ? tabFromUrl : 'list'
  const [activeTab, setActiveTab] = useState(initialTab)

  // 应用日志的数据靠 store 拉取，而 LogList / LogStats 自身**不会**主动加载
  // （LogList 只在滚动到底时 loadMore）。不在这里触发 refresh，界面就是空的。
  const refreshLogs = useLogsStore(s => s.refresh)
  const isLoadingLogs = useLogsStore(s => s.isLoading)

  useEffect(() => {
    // 用白名单校验：未知 tab 值保持当前状态，不把 activeTab 设成非法值
    // （否则 Tabs 会落空、页面一片空白）
    if (tabFromUrl && TAB_VALUES.has(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  // 切到「应用日志」时按需加载（不在进页面时就拉，避免无谓请求）
  useEffect(() => {
    if (activeTab === 'app') void refreshLogs()
  }, [activeTab, refreshLogs])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    searchParams.set('tab', value)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">{t('logs.title')}</h1>
          <p className="text-muted-foreground">{t('logs.description')}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="list" className="flex items-center gap-2 py-2">
            <List className="h-4 w-4" />
            <span>{t('logs.requestLogs', '请求日志')}</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2 py-2">
            <BarChart3 className="h-4 w-4" />
            <span>{t('logs.statistics', '统计概览')}</span>
          </TabsTrigger>
          <TabsTrigger value="app" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span>{t('logs.appLogs', '应用日志')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <SectionCard title={t('logs.requestLogList', '请求记录')}>
            <RequestLogList />
          </SectionCard>
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <SectionCard title={t('logs.statsTitle', '日志统计')}>
            <RequestLogStats />
          </SectionCard>
        </TabsContent>

        {/* 应用日志：引擎/代理/OAuth 的运行日志（logManager 记录）。
            此前只有后端与 preload 暴露，没有界面 —— 用户无法查看。 */}
        <TabsContent value="app" className="mt-6 space-y-6">
          <SectionCard title={t('logs.appStatsTitle', '运行日志统计')}>
            <LogStats />
          </SectionCard>
          <SectionCard title={t('logs.appListTitle', '运行日志')}>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <LogFilter />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  disabled={isLoadingLogs}
                  onClick={() => void refreshLogs()}
                >
                  <RotateCw className={isLoadingLogs ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                  刷新
                </Button>
              </div>
              <LogList />
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
