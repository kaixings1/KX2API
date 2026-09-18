/**
 * engine/orchestrator/shared.ts
 *
 * 编排器各模式共用的纯函数。
 *
 * 此前 `computeQualityScore` 在 orchestrator.ts 与 pipeline.ts 各写一份、
 * `stageToRole` 在 pipeline.ts 与 taskGraph.ts 各写一份 —— 内容逐字相同。
 * 这类「同名定义多份」改一处漏一处，是本项目类型/行为不一致的头号根因，
 * 故抽出到此处统一。
 */

import type { WorkflowStage, AgentRole, RoleExecutionResult } from './messages.ts'

/** 各阶段在质量评分中的权重（满分 100，超出截断） */
const STAGE_WEIGHTS: Record<string, number> = {
  research: 10,
  analyze: 15,
  design: 15,
  plan: 10,
  implement: 25,
  verify: 20,
  review: 5,
}

/**
 * 根据各角色执行结果计算质量评分（0-100）。
 *
 * 成功：拿满该阶段权重，并按输出长度加最多 5 分的「内容充实度」奖励。
 * 失败：只拿权重的 20%（承认部分工作已投入）。
 */
export function computeQualityScore(results: RoleExecutionResult[]): number {
  if (results.length === 0) return 0

  let score = 0
  for (const r of results) {
    const w = STAGE_WEIGHTS[r.stage] ?? 10
    if (r.success) {
      score += w
      score += Math.min(5, Math.floor(r.output.length / 200))
    } else {
      score += Math.floor(w * 0.2)
    }
  }

  return Math.min(100, score)
}

/** 阶段 → 承担该阶段的主责角色 */
export function stageToRole(stage: WorkflowStage): AgentRole {
  const map: Record<WorkflowStage, AgentRole> = {
    research: 'researcher',
    analyze: 'pm',
    design: 'architect',
    plan: 'team_leader',
    implement: 'engineer',
    verify: 'qa',
    review: 'team_leader',
    discuss: 'team_leader',
    done: 'supervisor',
    failed: 'supervisor',
  }
  return map[stage] ?? 'team_leader'
}

/** 毫秒 → 人类可读时长（<1s 显示 ms，否则显示 s） */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
