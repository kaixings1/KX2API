import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SessionManagement as SessionManagementComponent } from '@/components/proxy'
import { ContextManagement } from '@/components/proxy/ContextManagement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Activity, Trash2, RefreshCw, Users } from 'lucide-react'

const sessionApi = window.electronAPI.session

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: '活跃', variant: 'default' },
  expired: { label: '已过期', variant: 'secondary' },
  deleted: { label: '已删除', variant: 'destructive' },
}

const SESSION_TYPE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  chat: { label: '对话', variant: 'default' },
  agent: { label: '代理', variant: 'secondary' },
}

export function SessionManagement() {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [stats, setStats] = useState({ total: 0, active: 0 })

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await sessionApi.getAll()
      setSessions(Array.isArray(data) ? data : [])
      const activeList = await sessionApi.getActive().catch(() => [])
      setStats({ total: data.length, active: activeList.length })
    } catch (e) {
      console.error('[SessionManagement] Failed to load sessions:', e)
      setSessions([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此会话？')) return
    try {
      await sessionApi.delete(id)
      loadSessions()
    } catch (e) {
      console.error('[SessionManagement] Delete failed:', e)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('确定清除所有会话？')) return
    try {
      await sessionApi.clearAll()
      loadSessions()
    } catch (e) {
      console.error('[SessionManagement] Clear all failed:', e)
    }
  }

  const filteredSessions = sessions.filter(s => {
    if (search && !s.providerId?.includes(search) && !s.accountId?.includes(search) && !s.providerSessionId?.includes(search)) return false
    if (filterType !== 'all' && s.sessionType !== filterType) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">{t('session.title', '会话管理')}</h2>
        <p className="text-muted-foreground">{t('session.description', '管理代理会话和上下文，查看连接状态与历史记录')}</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-[var(--accent-primary)]" />
            {t('session.sessionTitle', '会话状态')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SessionManagementComponent />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-[var(--accent-primary)]" />
            会话列表
            <Badge variant="secondary" className="ml-2">{stats.total} 总计 / {stats.active} 活跃</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索 provider / account / sessionId..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">全部类型</option>
              <option value="chat">对话</option>
              <option value="agent">代理</option>
            </select>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" onClick={loadSessions} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearAll} disabled={sessions.length === 0}>
              <Trash2 className="h-4 w-4 mr-1" /> 清除全部
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">加载中...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">暂无会话数据</div>
          ) : (
            <div className="space-y-2">
              {filteredSessions.map((s) => {
                const statusInfo = STATUS_MAP[s.status] || { label: s.status, variant: 'secondary' as const }
                const typeInfo = SESSION_TYPE_MAP[s.sessionType] || { label: s.sessionType, variant: 'secondary' as const }
                return (
                  <div key={s.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-3 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium truncate">{s.providerId} / {s.accountId}</p>
                        <p className="text-xs text-muted-foreground">#{s.providerSessionId?.slice(0, 20)}...</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Badge variant={typeInfo.variant} className="text-xs">{typeInfo.label}</Badge>
                        <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleString()}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-[var(--accent-primary)]" />
            {t('session.contextTitle', '上下文管理')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContextManagement />
        </CardContent>
      </Card>
    </div>
  )
}

export default SessionManagement
