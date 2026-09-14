import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RequestLogList } from '@/components/logs'
import { RequestLogStats } from '@/components/logs'
import { BarChart3, List } from 'lucide-react'

export default function LogsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')

  const [activeTab, setActiveTab] = useState(tabFromUrl === 'stats' ? 'stats' : 'list')

  useEffect(() => {
    if (tabFromUrl === 'stats') {
      setActiveTab('stats')
    } else if (tabFromUrl === 'request' || !tabFromUrl) {
      setActiveTab('list')
    }
  }, [tabFromUrl])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (value === 'stats') {
      searchParams.set('tab', 'stats')
    } else {
      searchParams.set('tab', 'list')
    }
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
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="list" className="flex items-center gap-2 py-2">
            <List className="h-4 w-4" />
            <span>{t('logs.requestLogs', '请求日志')}</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2 py-2">
            <BarChart3 className="h-4 w-4" />
            <span>{t('logs.statistics', '统计概览')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t('logs.requestLogList', '请求记录')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RequestLogList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t('logs.statsTitle', '日志统计')}</CardTitle>
            </CardHeader>
            <CardContent>
              <RequestLogStats />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
