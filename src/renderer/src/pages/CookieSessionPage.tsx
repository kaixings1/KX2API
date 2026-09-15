import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionCard } from '@/components/ui/section-card'
import { Loader2, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'
import type { ProviderVendor } from '../../shared/types'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  ready: { label: '就绪', variant: 'default' },
  pending: { label: '等待中', variant: 'secondary' },
  not_init: { label: '未初始化', variant: 'secondary' },
  error: { label: '错误', variant: 'destructive' },
}

export function CookieSessionPage() {
  const { t } = useTranslation()
  const cookieSession = window.electronAPI.cookieSession
  const [initializing, setInitializing] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [statusData, setStatusData] = useState<{ success: boolean; status?: Record<ProviderVendor, { ready: boolean; cookieCount: number }>; error?: string } | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loginResults, setLoginResults] = useState<Record<string, { opened: boolean; error?: string }>>({})
  const [credentialCache, setCredentialCache] = useState<Record<ProviderVendor, Record<string, string>>>({} as Record<ProviderVendor, Record<string, string>>)

  const allProviders: ProviderVendor[] = ['deepseek', 'glm', 'kimi', 'mimo', 'minimax', 'qwen', 'qwen-ai', 'zai', 'perplexity', 'stepfun', 'custom']

  const handleInit = async () => {
    setInitializing(true)
    setInitError(null)
    try {
      const res = await cookieSession.init(allProviders)
      if (!res.success && res.error) {
        setInitError(res.error)
      }
      loadStatus()
    } catch (e) {
      setInitError((e as Error).message)
    } finally {
      setInitializing(false)
    }
  }

  const loadStatus = async () => {
    setLoadingStatus(true)
    try {
      const res = await cookieSession.getStatus()
      setStatusData(res)
    } catch (e) {
      setStatusData({ success: false, error: (e as Error).message })
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleOpenLogin = async (provider: ProviderVendor) => {
    try {
      const res = await cookieSession.openLogin(provider)
      setLoginResults((prev) => ({ ...prev, [provider]: res }))
      if (res.opened) {
        loadStatus()
      }
    } catch (e) {
      setLoginResults((prev) => ({ ...prev, [provider]: { opened: false, error: (e as Error).message } }))
    }
  }

  const handleClearLogin = async (provider: ProviderVendor) => {
    try {
      await cookieSession.clearLogin(provider)
      setLoginResults((prev) => {
        const next = { ...prev }
        delete next[provider]
        return next
      })
      loadStatus()
    } catch (e) {
      console.error('[CookieSession] clearLogin failed:', e)
    }
  }

  const handleViewCredentials = async (provider: ProviderVendor) => {
    try {
      const res = await cookieSession.getCredentials(provider)
      if (res.success) {
        setCredentialCache((prev) => ({ ...prev, [provider]: res.credentials }))
      }
    } catch (e) {
      console.error('[CookieSession] getCredentials failed:', e)
    }
  }

  const handleDestroy = async () => {
    if (!confirm('确定销毁 Cookie Session 并清除所有数据？')) return
    try {
      await cookieSession.destroy()
      setStatusData(null)
      setLoginResults({})
      setCredentialCache({})
    } catch (e) {
      console.error('[CookieSession] destroy failed:', e)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">Cookie Session</h2>
        <p className="text-muted-foreground">管理网页 Cookie 持续注入，自动完成 OAuth 登录</p>
      </div>

      <SectionCard title="操作">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button onClick={handleInit} disabled={initializing}>
              {initializing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />初始化中...</> : '初始化 Cookie Session'}
            </Button>
            <Button variant="outline" onClick={loadStatus} disabled={loadingStatus}>
              {loadingStatus ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />刷新</> : '刷新状态'}
            </Button>
            <Button variant="destructive" onClick={handleDestroy} disabled={!statusData?.success}>销毁</Button>
          </div>
          {initError && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{initError}</span>
            </div>
          )}
          {statusData?.error && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{statusData.error}</span>
            </div>
          )}
        </div>
      </SectionCard>

      {statusData?.success && statusData.status && (
        <SectionCard title={`Provider 状态 (${Object.keys(statusData.status).length})`}>
          <div className="space-y-2">
            {Object.entries(statusData.status).map(([provider, info]) => {
              const vendor = provider as ProviderVendor
              const statusLabel = info.ready ? '就绪' : '未就绪'
              const statusVariant = info.ready ? 'default' : 'secondary'
              const loginResult = loginResults[vendor]
              const cachedCreds = credentialCache[vendor]
              return (
                <div key={vendor} className="flex items-center justify-between rounded border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{vendor}</span>
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                    <span className="text-xs text-muted-foreground">Cookie 数: {info.cookieCount}</span>
                    {loginResult?.opened && (
                      <Badge variant="outline" className="text-[10px]">已打开登录</Badge>
                    )}
                    {loginResult?.error && (
                      <span className="text-xs text-destructive">{loginResult.error}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => handleOpenLogin(vendor)}>
                      <ExternalLink className="h-3 w-3 mr-1" />打开登录
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleClearLogin(vendor)} disabled={!loginResult?.opened}>清除登录</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleViewCredentials(vendor)} disabled={!info.ready}>查看凭证</Button>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {(Object.keys(credentialCache).length > 0) && (
        <SectionCard title="已获取凭证">
          <div className="space-y-2">
            {Object.entries(credentialCache).map(([provider, creds]) => (
              <div key={provider} className="rounded border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium capitalize">{provider}</span>
                </div>
                <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
                  {JSON.stringify(creds, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

export default CookieSessionPage
