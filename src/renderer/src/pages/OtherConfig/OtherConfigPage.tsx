import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, RotateCcw } from 'lucide-react'

const otherConfigApi = window.electronAPI.otherConfig

export function OtherConfig() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [advancedJson, setAdvancedJson] = useState('{}')
  const [experimentalJson, setExperimentalJson] = useState('{}')
  const [developerJson, setDeveloperJson] = useState('{}')
  const [message, setMessage] = useState('')

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await otherConfigApi.get()
      if (res?.advanced) {
        setAdvancedJson(JSON.stringify(res.advanced, null, 2))
      }
      if (res?.experimental) {
        setExperimentalJson(JSON.stringify(res.experimental, null, 2))
      }
      if (res?.developer) {
        setDeveloperJson(JSON.stringify(res.developer, null, 2))
      }
    } catch (e) {
      console.error('[OtherConfig] Failed to load config:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleUpdateAdvanced = async () => {
    try {
      const parsed = JSON.parse(advancedJson)
      await otherConfigApi.updateAdvanced(parsed)
      setMessage(t('otherConfig.saveSuccess', '保存成功'))
      setTimeout(() => setMessage(''), 2000)
    } catch {
      setMessage(t('otherConfig.jsonError', 'JSON 格式错误'))
    }
  }

  const handleUpdateExperimental = async () => {
    try {
      const parsed = JSON.parse(experimentalJson)
      await otherConfigApi.update({ experimental: parsed })
      setMessage(t('otherConfig.saveSuccess', '保存成功'))
      setTimeout(() => setMessage(''), 2000)
    } catch {
      setMessage(t('otherConfig.jsonError', 'JSON 格式错误'))
    }
  }

  const handleUpdateDeveloper = async () => {
    try {
      const parsed = JSON.parse(developerJson)
      await otherConfigApi.update({ developer: parsed })
      setMessage(t('otherConfig.saveSuccess', '保存成功'))
      setTimeout(() => setMessage(''), 2000)
    } catch {
      setMessage(t('otherConfig.jsonError', 'JSON 格式错误'))
    }
  }

  const handleReset = async () => {
    await otherConfigApi.reset()
    setMessage(t('otherConfig.resetSuccess', '已重置'))
    loadConfig()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('otherConfig.title', '其他配置')}</h2>
        <p className="text-muted-foreground">{t('otherConfig.description', '高级和实验性配置')}</p>
      </div>

      {message && <Card><CardContent className="py-2 text-sm text-center">{message}</CardContent></Card>}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Tabs defaultValue="advanced">
          <TabsList>
            <TabsTrigger value="advanced">{t('otherConfig.advanced', '高级')}</TabsTrigger>
            <TabsTrigger value="experimental">{t('otherConfig.experimental', '实验')}</TabsTrigger>
            <TabsTrigger value="developer">{t('otherConfig.developer', '开发者')}</TabsTrigger>
          </TabsList>
          <TabsContent value="advanced" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('otherConfig.advancedTitle', '高级配置 (JSON)')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={advancedJson}
                  onChange={e => setAdvancedJson(e.target.value)}
                  className="w-full h-64 p-3 text-sm font-mono border rounded-md bg-background"
                />
                <div className="flex gap-2">
                  <Button onClick={handleUpdateAdvanced}>{t('common.save', '保存')}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="experimental" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('otherConfig.experimentalTitle', '实验性配置 (JSON)')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={experimentalJson}
                  onChange={e => setExperimentalJson(e.target.value)}
                  className="w-full h-64 p-3 text-sm font-mono border rounded-md bg-background"
                />
                <div className="flex gap-2">
                  <Button onClick={handleUpdateExperimental}>{t('common.save', '保存')}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="developer" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('otherConfig.developerTitle', '开发者配置 (JSON)')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={developerJson}
                  onChange={e => setDeveloperJson(e.target.value)}
                  className="w-full h-64 p-3 text-sm font-mono border rounded-md bg-background"
                />
                <div className="flex gap-2">
                  <Button onClick={handleUpdateDeveloper}>{t('common.save', '保存')}</Button>
                  <Button variant="destructive" onClick={handleReset}><RotateCcw className="h-4 w-4 mr-1" />{t('otherConfig.reset', '重置')}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default OtherConfig
