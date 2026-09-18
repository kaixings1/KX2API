/**
 * engine/orchestrator/orchestrator.ts
 *
 * 编排器核心 — 整合 Pipeline + Discuss + Parallel 三种模式
 */

import type {
  WorkflowStage,
  AgentRole,
  AgentMessage,
  OrchestrationResult,
  OrchestratorConfig,
  RoleExecutionResult,
} from './messages.ts'
import { buildAgentDefinition, getAllRoles, getRoleDisplayName } from './agentRole.ts'
import { computeQualityScore } from './shared.ts'
import { PipelineExecutor, type PipelineExecutorDeps, PIPELINE_STAGES } from './pipeline.ts'
import { TaskGraph, buildParallelGraph } from './taskGraph.ts'

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class Orchestrator {
  private config: OrchestratorConfig
  private deps: OrchestratorDeps
  private graph: TaskGraph | null = null
  private discussionHistory: AgentMessage[] = []

  constructor(config: Partial<OrchestratorConfig> = {}, deps: OrchestratorDeps) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.deps = deps
  }

  async run(taskDescription: string): Promise<OrchestrationResult> {
    const traceName = `orchestrator:${this.config.mode}`
    const traceId = this.deps.onTraceStart?.(traceName, taskDescription)
    const startTime = Date.now()
    try {
      const result = await this._runImpl(taskDescription)
      if (traceId) {
        this.deps.onTraceEnd?.(traceId, result.summary ?? '', [`mode:${this.config.mode}`])
      }

      if (traceId && this.deps.onTracePersist) {
        this.deps.onTracePersist({
          traceId,
          name: traceName,
          input: taskDescription,
          output: result.summary,
          metadata: [`mode:${this.config.mode}`],
          startTime,
          endTime: Date.now(),
        })
      }
      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      if (traceId) this.deps.onTraceFail?.(traceId, errMsg)

      if (traceId && this.deps.onTracePersist) {
        this.deps.onTracePersist({
          traceId,
          name: traceName,
          input: taskDescription,
          error: errMsg,
          metadata: [`mode:${this.config.mode}`],
          startTime,
          endTime: Date.now(),
        })
      }
      throw error
    }
  }

  private async _runImpl(taskDescription: string): Promise<OrchestrationResult> {
    if (this.config.mode === 'discuss') {
      return this.runDiscussMode(taskDescription)
    }

    if (this.config.mode === 'parallel') {
      return this.runParallelMode(taskDescription)
    }

    return this.runPipelineMode(taskDescription)
  }

  // -----------------------------------------------------------------------
  // Pipeline 模式
  // -----------------------------------------------------------------------

  private async runPipelineMode(taskDescription: string): Promise<OrchestrationResult> {
    const executor = new PipelineExecutor(
      {
        executeRole: (role, systemPrompt, userPrompt, context) =>
          this.deps.executeLLM(role, systemPrompt, userPrompt, context),
        onProgress: (stage, role, output) => {
          if (this.config.verbose) {
            console.log(`[Orchestrator] ${stage} → ${role} 完成`)
          }
        },
      },
      this.config
    )

    return executor.run(taskDescription)
  }

  // -----------------------------------------------------------------------
  // Parallel 模式
  // -----------------------------------------------------------------------

  private async runParallelMode(taskDescription: string): Promise<OrchestrationResult> {
    const nodes = buildParallelGraph(taskDescription)
    this.graph = new TaskGraph()
    this.graph.addNodes(nodes)

    const roleResults: RoleExecutionResult[] = []
    const startTime = Date.now()
    let totalIterations = 0
    const artifacts: string[] = []

    while (!this.graph.isAllCompleted() && !this.graph.hasFailed()) {
      const readyNodes = this.graph.getReady()
      if (readyNodes.length === 0) {
        // 没有可执行的节点：检查是否有因依赖失败而应跳过的节点，避免死循环
        const allNodes = this.graph.getAll()
        let anySkipped = false
        for (const node of allNodes) {
          if (node.status === 'pending' && this.graph.skipIfDependencyFailed(node.id)) {
            anySkipped = true
          }
        }
        if (!anySkipped) break
        continue
      }

      // 真正并行：同一时刻所有「无依赖、已就绪」的节点同时发起 LLM 调用，
      // 等全部完成后才进入下一波。这是 parallel 模式相对 pipeline 模式的本质区别
      // （pipeline 是严格串行）。getReady() 返回的就是当前这一波可并行执行的节点。
      const graph = this.graph
      const settled = await Promise.all(
        readyNodes.map(async (node) => {
          const n = node as NonNullable<typeof node>
          graph.markRunning(n.id)
          const roleDef = buildAgentDefinition(n.role)
          const context = this.buildNodeContext(n)
          try {
            const output = await this.deps.executeLLM(
              n.role,
              roleDef.systemPrompt,
              n.description,
              context
            )
            const nodeArtifacts = this.extractArtifacts(output)
            graph.markCompleted(n.id, output)
            return { node: n, success: true as const, output, artifacts: nodeArtifacts }
          } catch (err: any) {
            graph.markFailed(n.id, err.message)
            return { node: n, success: false as const, output: err.message, artifacts: [] as string[] }
          }
        })
      )

      for (const r of settled) {
        artifacts.push(...r.artifacts)
        roleResults.push({
          role: r.node.role,
          stage: r.node.stage,
          success: r.success,
          output: r.output,
          iterations: 1,
          duration: 0,
          artifacts: r.artifacts,
        })
        totalIterations++

        if (this.config.verbose) {
          console.log(`[Orchestrator] ${r.node.stage} → ${r.node.role} ${r.success ? '完成' : '失败'}`)
        }
      }
    }

    const hasFailed = this.graph.hasFailed()
    const lastCompleted = this.graph.getAll().filter(n => n.status === 'completed').pop()
    const mergedOutput = lastCompleted?.result ?? ''

    return {
      success: !hasFailed,
      finalStage: hasFailed ? 'failed' : 'done',
      roleResults,
      mergedOutput,
      qualityScore: computeQualityScore(roleResults),
      totalDuration: Date.now() - startTime,
      totalIterations,
      summary: this.buildSummary(!hasFailed, hasFailed ? 'failed' : 'done', roleResults, artifacts, Date.now() - startTime, totalIterations),
      artifacts,
    }
  }

  // -----------------------------------------------------------------------
  // Discuss 模式 — 多角色自由讨论
  // -----------------------------------------------------------------------

  private async runDiscussMode(taskDescription: string): Promise<OrchestrationResult> {
    const startTime = Date.now()
    const roleResults: RoleExecutionResult[] = []
    const artifacts: string[] = []
    const enabledRoles = this.config.roles
    const maxRounds = this.config.maxDiscussionRounds

    let discussionContext = `## 任务\n${taskDescription}\n\n## 讨论规则\n${enabledRoles.map(r => `- ${getRoleDisplayName(r)}: 从你的专业角度分析`).join('\n')}\n\n请开始讨论。`

    for (let round = 0; round < maxRounds; round++) {
      for (const role of enabledRoles) {
        const roleDef = buildAgentDefinition(role)
        const userPrompt = `${discussionContext}\n\n## 轮次 ${round + 1} — ${getRoleDisplayName(role)} 发言\n请从你的专业角度分析，给出观点、建议或决策。`

        try {
          const output = await this.deps.executeLLM(role, roleDef.systemPrompt, userPrompt, discussionContext)

          const message: AgentMessage = {
            id: `msg-${round}-${role}-${Date.now()}`,
            from: role,
            content: output,
            causeBy: 'discuss',
            timestamp: new Date().toISOString(),
          }
          this.discussionHistory.push(message)

          if (output.includes('[CONSENSUS]') || output.includes('[DECISION]')) {
            const nodeArtifacts = this.extractArtifacts(output)
            artifacts.push(...nodeArtifacts)

            return {
              success: true,
              finalStage: 'done',
              roleResults: [
                ...roleResults,
                {
                  role,
                  stage: 'review',
                  success: true,
                  output,
                  iterations: round + 1,
                  duration: Date.now() - startTime,
                  artifacts: nodeArtifacts,
                },
              ],
              mergedOutput: output,
              qualityScore: 80,
              totalDuration: Date.now() - startTime,
              totalIterations: round + 1,
              summary: this.buildSummary(true, 'done', roleResults, artifacts, Date.now() - startTime, round + 1),
              artifacts,
            }
          }

          roleResults.push({
            role,
            stage: 'discuss',
            success: true,
            output,
            iterations: 1,
            duration: 0,
          })

          discussionContext = this.buildDiscussionContext(this.discussionHistory.slice(-10))
        } catch (err: any) {
          roleResults.push({
            role,
            stage: 'discuss',
            success: false,
            output: err.message,
            iterations: 1,
            duration: 0,
            error: err.message,
          })
        }
      }
    }

    const finalOutput = this.discussionHistory.length > 0
      ? this.discussionHistory[this.discussionHistory.length - 1].content
      : '讨论未产生有效结果'

    return {
      success: false,
      finalStage: 'review',
      roleResults,
      mergedOutput: finalOutput,
      qualityScore: computeQualityScore(roleResults),
      totalDuration: Date.now() - startTime,
      totalIterations: maxRounds,
      summary: this.buildSummary(false, 'review', roleResults, artifacts, Date.now() - startTime, maxRounds),
      artifacts,
    }
  }

  // -----------------------------------------------------------------------
  // 辅助方法
  // -----------------------------------------------------------------------

  private buildNodeContext(node: any): string {
    let ctx = ''
    if (node.dependencies.length > 0) {
      ctx += '## 依赖节点输出\n'
      for (const depId of node.dependencies) {
        const dep = this.graph?.get(depId)
        if (dep?.result) {
          ctx += `### ${dep.stage}\n${dep.result.slice(0, 1000)}\n\n`
        }
      }
    }
    return ctx
  }

  private buildDiscussionContext(messages: AgentMessage[]): string {
    const recent = messages.slice(-10)
    return recent
      .map(m => `[${getRoleDisplayName(m.from)}] ${m.content.slice(0, 500)}`)
      .join('\n\n')
  }

  private extractArtifacts(output: string): string[] {
    const artifacts: string[] = []
    const patterns = [
      /(?:创建|写入|保存|修改|生成)\s+[`"']?([^\s`"']+\.(ts|tsx|js|jsx|py|md|json|yaml|yml|toml))[`"']?/gi,
    ]
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(output)) !== null) {
        const path = match[1]
        if (path && !artifacts.includes(path)) artifacts.push(path)
      }
    }
    return artifacts
  }

  private buildSummary(success: boolean, finalStage: string, results: RoleExecutionResult[], artifacts: string[], duration: number, iterations: number): string {
    const status = success ? '✅ 成功' : '❌ 失败'
    const lines = [
      `${status} | 最终阶段: ${finalStage}`,
      `质量评分: ${computeQualityScore(results)}/100`,
      `总耗时: ${(duration / 1000).toFixed(1)}s`,
      `总迭代: ${iterations}`,
      '',
      '阶段执行结果:',
    ]

    for (const r of results) {
      const icon = r.success ? '✅' : '❌'
      lines.push(`  ${icon} ${r.role} (${r.stage})`)
      if (r.error) lines.push(`     错误: ${r.error}`)
    }

    if (artifacts.length > 0) {
      lines.push('', '产出文件:')
      for (const a of artifacts) lines.push(`  - ${a}`)
    }

    return lines.join('\n')
  }
}

// ---------------------------------------------------------------------------
// OrchestratorDeps
// ---------------------------------------------------------------------------

export interface OrchestratorDeps {
  executeLLM: (role: string, systemPrompt: string, userPrompt: string, context: string) => Promise<string>
  onTraceStart?: (name: string, input: string) => string
  onTraceEnd?: (traceId: string, output: string, metadata?: string[]) => void
  onTraceFail?: (traceId: string, error: string) => void
  onTracePersist?: (record: {
    traceId: string
    name: string
    input: string
    output?: string
    error?: string
    metadata?: string[]
    startTime: number
    endTime: number
  }) => void
}

// ---------------------------------------------------------------------------
// 默认配置
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: OrchestratorConfig = {
  mode: 'pipeline',
  maxIterations: 10,
  parallelResearch: true,
  mergeStrategy: 'merge',
  roles: ['team_leader', 'pm', 'architect', 'engineer', 'qa', 'researcher'],
  autoFix: true,
  qualityGate: true,
  verbose: false,
  maxDiscussionRounds: 5,
}

