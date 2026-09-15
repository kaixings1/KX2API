import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { SectionCard } from '@/components/ui/section-card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Play, CheckCircle2, XCircle, Loader2, Plus, Trash2, Users } from 'lucide-react'

type Phase = 'idle' | 'planning' | 'brainstorm' | 'debate' | 'consensus' | 'finalize' | 'executing' | 'done' | 'error'

interface DiscussionItem {
  id: string
  phase: string
  roleId: string
  roleName: string
  content: string
}

interface TaskItem {
  type: 'start' | 'complete'
  taskId: string
  description: string
  success?: boolean
  durationMs?: number
  output?: string
  error?: string
}

interface ReportItem {
  success: boolean
  totalDurationMs: number
  discussionRounds: number
  taskResults: TaskItem[]
  planId: string
}

interface CustomRole {
  id: string
  name: string
  systemPrompt: string
}

const PHASE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  planning: 'secondary',
  brainstorm: 'outline',
  debate: 'outline',
  consensus: 'secondary',
  finalize: 'secondary',
  'plan-generated': 'default',
  executing: 'secondary',
  done: 'default',
  error: 'destructive',
}

const BUILTIN_ROLES: CustomRole[] = [
  {
    id: 'planner',
    name: '规划师',
    systemPrompt: '你是 KX2Code 的规划师。你的职责是：分析用户需求，将其分解为可执行的任务，定义每个任务的目标、输入、输出、验证条件，确定任务之间的依赖关系和执行顺序，最终汇总所有讨论结果，生成可执行的 Plan JSON。输出要求：任务描述具体、可执行，依赖关系清晰，每个任务有明确的验证条件。',
  },
  {
    id: 'discussant',
    name: '讨论者',
    systemPrompt: '你是 KX2Code 的讨论者。你的职责是：认真听取其他角色的意见，提出建设性的补充、质疑或修正，指出计划中的遗漏或潜在风险，提出替代方案。讨论原则：对事不对人，每个观点要有具体理由，如果同意前一个观点，简要说明同意理由。',
  },
  {
    id: 'reviewer',
    name: '审查员',
    systemPrompt: '你是 KX2Code 的审查员。你的职责是：从执行可行性角度审查计划，检查是否有遗漏的步骤，检查依赖关系是否合理，提出改进建议。审查重点：计划是否可执行，是否有死锁或循环依赖，验证条件是否可判断，是否有过度复杂化的步骤。',
  },
  {
    id: 'critic',
    name: '批评家',
    systemPrompt: '你是 KX2Code 的批评家。你的职责是：找出计划中最坏的情况，指出可能的失败点，提出风险缓解方案，挑战不合理的假设。批评原则：假设每一步都可能失败，关注边界条件和异常情况，提出具体的风险缓解措施。',
  },
]

export function TeamTaskPage() {
  const { t } = useTranslation()
  const [description, setDescription] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [phaseDetail, setPhaseDetail] = useState('')
  const [discussions, setDiscussions] = useState<DiscussionItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [report, setReport] = useState<ReportItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [useCustomRoles, setUseCustomRoles] = useState(false)
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const discussionsEndRef = useRef<HTMLDivElement>(null)
  const [resultPlanId, setResultPlanId] = useState('')
  const [resultLoading, setResultLoading] = useState(false)
  const [resultError, setResultError] = useState<string | null>(null)
  const [resultData, setResultData] = useState<unknown>(null)

  function addCustomRole() {
    setCustomRoles(prev => [...prev, { id: `role_${Date.now()}`, name: '', systemPrompt: '' }])
  }

  function updateCustomRole(id: string, field: 'name' | 'systemPrompt', value: string) {
    setCustomRoles(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function removeCustomRole(id: string) {
    setCustomRoles(prev => prev.filter(r => r.id !== id))
  }

  function doClearState() {
    setPhase('idle')
    setPhaseDetail('')
    setDiscussions([])
    setTasks([])
    setReport(null)
    setError(null)
    setRunning(false)
  }

  const handleExecute = useCallback(async () => {
    const text = description.trim()
    if (!text || running) return

    const roles = useCustomRoles
      ? customRoles.filter((r) => r.name.trim() && r.systemPrompt.trim())
      : []

    doClearState()
    setRunning(true)
    setPhase('planning')

    const unsubPhase = window.electronAPI.team.onPhaseChange((e) => {
      setPhase(e.phase as Phase)
      setPhaseDetail(e.detail)
    })
    const unsubDiscussion = window.electronAPI.team.onDiscussion((e) => {
      setDiscussions((prev) => [...prev, e])
    })
    const unsubTask = window.electronAPI.team.onTaskEvent((e) => {
      setTasks((prev) => {
        if (e.type === 'start') {
          return [...prev.filter((t) => t.taskId !== e.taskId), e]
        }
        return [...prev.filter((t) => t.taskId !== e.taskId), e]
      })
      if (e.type === 'start') setPhase('executing')
    })
    const unsubDone = window.electronAPI.team.onDone((e) => {
      setReport(e as ReportItem)
      setPhase('done')
      setRunning(false)
    })
    const unsubError = window.electronAPI.team.onError((e) => {
      setError(e.error)
      setPhase('error')
      setRunning(false)
    })

    try {
      const result = await window.electronAPI.team.execute(text, useCustomRoles ? roles : undefined)
      if (!result.success) {
        setError(result.error as string)
        setPhase('error')
        setRunning(false)
      }
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
      setRunning(false)
    }

    unsubPhase()
    unsubDiscussion()
    unsubTask()
    unsubDone()
    unsubError()
  }, [description, running, useCustomRoles, customRoles])

  useEffect(() => {
    discussionsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [discussions])

  const phaseVariant = PHASE_VARIANTS[phase] ?? 'outline'

  function getPhaseLabel(key: string): string {
    const map: Record<string, string> = {
      planning: t('team.phasePlanning', '规划中'),
      brainstorm: t('team.phaseBrainstorm', '头脑风暴'),
      debate: t('team.phaseDebate', '讨论'),
      consensus: t('team.phaseConsensus', '汇总'),
      finalize: t('team.phaseFinalize', '审查'),
      'plan-generated': t('team.phasePlanGenerated', '计划已生成'),
      executing: t('team.phaseExecuting', '执行中'),
      done: t('team.phaseDone', '完成'),
      error: t('team.phaseError', '错误'),
    }
    return map[key] ?? key
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">{t('team.title', '多角色任务')}</h2>
        <p className="text-muted-foreground">
          {t('team.description', '由规划师、讨论者、审查员、批评家四个角色协作完成')}
        </p>
      </div>

      <SectionCard title={t('team.taskTitle', '任务描述')}>
        <div className="space-y-4">
          <Textarea
            placeholder={t('team.taskPlaceholder', '描述你想要完成的任务...')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={running}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleExecute} disabled={running || !description.trim()}>
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('team.running', '执行中...')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {t('team.execute', '执行')}
                </>
              )}
            </Button>
            {running && (
              <Button variant="outline" onClick={doClearState}>
                {t('team.cancel', '取消')}
              </Button>
            )}
            <Badge variant={phaseVariant}>{getPhaseLabel(phase)}</Badge>
            {phaseDetail && (
              <span className="text-sm text-muted-foreground">{phaseDetail}</span>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('team.roles', '角色配置')} icon={Users}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant={useCustomRoles ? 'default' : 'outline'}
              onClick={() => setUseCustomRoles(!useCustomRoles)}
            >
              {useCustomRoles ? t('team.useCustomRoles', '使用自定义角色') : t('team.useDefaultRoles', '使用默认角色')}
            </Button>
            {useCustomRoles && (
              <Button variant="ghost" size="sm" onClick={addCustomRole}>
                <Plus className="h-4 w-4 mr-1" />
                {t('team.addRole', '添加角色')}
              </Button>
            )}
          </div>

          {useCustomRoles && (
            <div className="space-y-3">
              {customRoles.map((role) => (
                <div key={role.id} className="grid gap-2 p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={t('team.roleName', '角色名称')}
                      value={role.name}
                      onChange={(e) => updateCustomRole(role.id, 'name', e.target.value)}
                      disabled={running}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomRole(role.id)}
                      disabled={running}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder={t('team.rolePrompt', '系统提示词')}
                    value={role.systemPrompt}
                    onChange={(e) => updateCustomRole(role.id, 'systemPrompt', e.target.value)}
                    rows={2}
                    disabled={running}
                  />
                </div>
              ))}
              {customRoles.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('team.noCustomRoles', '点击"添加角色"创建自定义角色')}</p>
              )}
            </div>
          )}

          {!useCustomRoles && (
            <div className="text-sm text-muted-foreground">
              {t('team.defaultRoles', '当前使用默认角色')}: {BUILTIN_ROLES.map((r) => r.name).join('、')}
            </div>
          )}
        </div>
      </SectionCard>

      {error && (
        <SectionCard className="border-destructive">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">{t('team.errorTitle', '执行失败')}</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </SectionCard>
      )}

      {discussions.length > 0 && (
        <SectionCard title={t('team.discussions', '讨论记录') + ` (${discussions.length} ${t('team.rounds', '轮')})`}>
          <div className="space-y-4">
            {discussions.map((d) => (
              <div key={d.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{d.phase}</Badge>
                  <span className="text-sm font-medium">{d.roleName}</span>
                </div>
                <div className="pl-4 border-l-2 border-muted text-sm text-muted-foreground whitespace-pre-wrap">
                  {d.content.length > 800 ? d.content.slice(0, 800) + '...' : d.content}
                </div>
                <Separator />
              </div>
            ))}
            <div ref={discussionsEndRef} />
          </div>
        </SectionCard>
      )}

      {tasks.length > 0 && (
        <SectionCard title={t('team.taskExecution', '任务执行')}>
          <div className="space-y-3">
            {tasks.map((task) => {
              if (task.type === 'start') {
                return (
                  <div key={task.taskId} className="flex items-center gap-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span>[{task.taskId}] {task.description}</span>
                  </div>
                )
              }
              return (
                <div key={task.taskId} className="flex items-start gap-3 text-sm">
                  {task.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">[{task.taskId}]</span> {task.description}
                    {task.durationMs !== undefined && (
                      <span className="text-muted-foreground ml-2">({task.durationMs}ms)</span>
                    )}
                    {task.error && (
                      <p className="text-destructive text-xs mt-1">{task.error}</p>
                    )}
                    {task.output && (
                      <pre className="text-xs bg-muted/50 rounded p-2 mt-1 overflow-auto max-h-32 whitespace-pre-wrap">
                        {task.output}
                      </pre>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {report && (
        <SectionCard className="border-green-500/30" title={t('team.reportTitle', '执行报告')}>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>{t('team.planId', '计划 ID')}: <code className="text-xs">{report.planId}</code></div>
              <div>{t('team.totalDuration', '耗时')}: {report.totalDurationMs}ms</div>
              <div>{t('team.discussionRounds', '讨论轮数')}: {report.discussionRounds}</div>
              <div>{t('team.taskCount', '任务数')}: {report.taskResults.length}</div>
            </div>
            <Separator />
            <div>
              <p className="font-medium mb-1">{t('team.taskResults', '任务结果')}:</p>
              {report.taskResults.map((r) => (
                <div key={r.taskId} className="flex items-center gap-2 text-sm py-1">
                  {r.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span>[{r.taskId}]</span>
                  <span className="truncate">{r.description}</span>
                  <span className="text-muted-foreground">({r.durationMs}ms)</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('team.historyTitle', '历史结果查询')}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('team.planIdPlaceholder', '输入 Plan ID 查看历史执行结果')}
              value={resultPlanId}
              onChange={(e) => setResultPlanId(e.target.value)}
            />
            <Button onClick={async () => {
              const planId = resultPlanId.trim()
              if (!planId) return
              setResultLoading(true)
              setResultError(null)
              setResultData(null)
              try {
                const res = await window.electronAPI.team.getResult(planId)
                if (res.success) {
                  setResultData(res.data)
                } else {
                  setResultError(res.error || '查询失败')
                }
              } catch (e) {
                setResultError((e as Error).message)
              } finally {
                setResultLoading(false)
              }
            }} disabled={resultLoading || !resultPlanId.trim()}>
              {resultLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('team.queryResult', '查询')}
            </Button>
          </div>
          {resultError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{resultError}</span>
            </div>
          )}
          {resultData && (
            <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(resultData, null, 2)}
            </pre>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
