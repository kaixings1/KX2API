import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { SectionCard } from '@/components/ui/section-card'
import { Separator } from '@/components/ui/separator'
import { GitBranch, Upload, Download, FolderOpen, Loader2, Info } from 'lucide-react'

const gitApi = window.electronAPI.git

export function GitManagement() {
  const { t } = useTranslation()
  const [repoPath, setRepoPath] = useState('')
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloneTarget, setCloneTarget] = useState('')
  const [cloneDialog, setCloneDialog] = useState(false)
  const [error, setError] = useState('')

  const loadStatus = useCallback(async () => {
    if (!repoPath) return
    setLoading(true)
    setError('')
    try {
      const res = await gitApi.getStatus(repoPath)
      setStatus(res || null)
    } catch (e) {
      console.error('[GitManagement] Failed to load status:', e)
      setError((e as Error).message || 'Failed to get status')
    }
    setLoading(false)
  }, [repoPath])

  const loadBranches = useCallback(async () => {
    if (!repoPath) return
    const res = await gitApi.getBranches(repoPath)
    setBranches(res || [])
  }, [repoPath])

  useEffect(() => { if (repoPath) { loadStatus(); loadBranches() } }, [repoPath, loadStatus, loadBranches])

  const handlePull = async () => {
    setLoading(true)
    const res = await gitApi.pull(repoPath)
    if (res.success) {
      loadStatus()
    } else {
      setError(res.error || 'Pull failed')
    }
    setLoading(false)
  }

  const handlePush = async () => {
    setLoading(true)
    const res = await gitApi.push(repoPath)
    if (res.success) {
      loadStatus()
    } else {
      setError(res.error || 'Push failed')
    }
    setLoading(false)
  }

  const handleClone = async () => {
    setLoading(true)
    const res = await gitApi.clone(cloneUrl, cloneTarget)
    if (res.success) {
      setRepoPath(cloneTarget)
      setCloneDialog(false)
    } else {
      setError(res.error || 'Clone failed')
    }
    setLoading(false)
  }

  const handleCheckout = async (branchName: string) => {
    setLoading(true)
    const res = await gitApi.checkout(repoPath, branchName)
    if (res.success) {
      loadStatus()
      loadBranches()
    } else {
      setError(res.error || 'Checkout failed')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">{t('git.title', 'Git 管理')}</h2>
        <p className="text-muted-foreground">{t('git.description', '管理 Git 仓库')}</p>
      </div>

      <SectionCard title={t('git.pageHelpTitle', '关于 Git')} icon={Info}>
        <p className="text-xs text-[var(--text-dim)] leading-relaxed">
          {t('git.pageHelp', '输入本地仓库路径以查看状态、拉取和推送代码。使用克隆功能从远程仓库复制代码到本地。')}
        </p>
      </SectionCard>

      <SectionCard>
        <div className="pt-6 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>{t('git.repoPath', '仓库路径')}</Label>
              <Input value={repoPath} onChange={e => setRepoPath(e.target.value)} placeholder={t('git.repoPathPlaceholder', '/path/to/repo')} />
            </div>
            <div className="flex items-end">
              <Dialog open={cloneDialog} onOpenChange={setCloneDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon"><FolderOpen className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('git.clone', '克隆仓库')}</DialogTitle>
                    <DialogDescription>{t('git.cloneDesc', '从 Git 仓库克隆代码到本地')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>{t('git.cloneUrl', 'URL')}</Label>
                      <Input value={cloneUrl} onChange={e => setCloneUrl(e.target.value)} />
                    </div>
                    <div>
                      <Label>{t('git.cloneTarget', '目标路径')}</Label>
                      <Input value={cloneTarget} onChange={e => setCloneTarget(e.target.value)} />
                    </div>
                    <Button onClick={handleClone} className="w-full">{t('git.clone', '克隆')}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {status && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant={status.isClean ? 'outline' : 'destructive'}>
                  {status.isClean ? t('git.clean', '干净') : t('git.dirty', '有修改')}
                </Badge>
                <span className="text-sm">Branch: <strong>{status.currentBranch}</strong></span>
                <span className="text-sm text-muted-foreground">{t('git.ahead', '领先')}: {status.ahead} | {t('git.behind', '落后')}: {status.behind}</span>
              </div>

              {!status.isClean && (
                <div className="grid grid-cols-3 gap-4">
                  {status.staged.length > 0 && (
                    <SectionCard title={t('git.staged', '已暂存')}>
                      <ul className="text-sm space-y-1">{status.staged.map(f => <li key={f} className="font-mono text-xs">{f}</li>)}</ul>
                    </SectionCard>
                  )}
                  {status.unstaged.length > 0 && (
                    <SectionCard title={t('git.unstaged', '已修改')}>
                      <ul className="text-sm space-y-1">{status.unstaged.map(f => <li key={f} className="font-mono text-xs">{f}</li>)}</ul>
                    </SectionCard>
                  )}
                  {status.untracked.length > 0 && (
                    <SectionCard title={t('git.untracked', '未跟踪')}>
                      <ul className="text-sm space-y-1">{status.untracked.map(f => <li key={f} className="font-mono text-xs">{f}</li>)}</ul>
                    </SectionCard>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handlePull} disabled={loading}><Download className="h-3 w-3 mr-1" />{t('git.pull', '拉取')}</Button>
                <Button size="sm" variant="outline" onClick={handlePush} disabled={loading}><Upload className="h-3 w-3 mr-1" />{t('git.push', '推送')}</Button>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">{t('git.branches', '分支')}</h3>
                <div className="flex flex-wrap gap-2">
                  {branches.map(branch => (
                    <Button key={branch.name} size="sm" variant={branch.current ? 'default' : 'outline'} onClick={() => !branch.current && handleCheckout(branch.name)} disabled={loading}>
                      <GitBranch className="h-3 w-3 mr-1" />{branch.name} {branch.current && t('git.current', '(当前)')}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

export default GitManagement
