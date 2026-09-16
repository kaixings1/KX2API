/**
 * tools/toolContext.ts — 每轮请求的「工具上下文」构建（dev.txt §5 / §7）
 *
 * 目标：在保证任务成功率的前提下，最小化每轮上下文里的工具定义 token。
 *
 * 三层暴露协议：
 *   L0 核心常驻   —— 元工具 + 最小基础集，永远给完整 schema（数量少，5~10 个）
 *   L1 组目录常驻 —— 只给「组名 + 描述 + 工具数」，让模型知道"有什么类"
 *   L2 活跃 schema —— 仅当前活跃工具给完整定义（模型可直接调用）
 *   L3 按需文档   —— tool_describe 拉取，默认不进上下文
 *
 * 灰度开关：
 *   默认走 legacy（全量工具名清单），只有显式开启才用三层协议。
 *   原因：把工具名从提示词里撤掉会改变模型可见信息，属于行为级变更，
 *   必须先小范围验证再切默认，避免重演「改了 prompt 导致工具调用大面积失败」。
 */

import type { ToolDefinition, ToolGroup } from './types'
import { flattenLabels, normalizeToolLabels } from './toolLabels'
import { getActiveTools, touchTool, lastUsedAt } from './toolMetaTools'
import { isCoreTool } from './toolRoles'
import { estimateTokensWithCjk } from '../../engine/token-counter/index.ts'

/** 三层协议开关（环境变量 KX2_TOOL_CONTEXT=layered 开启） */
export const TOOL_CONTEXT_ENV = 'KX2_TOOL_CONTEXT'
/** 分层模式下的 token 预算占比（工具部分占上下文的百分比） */
export const TOOL_BUDGET_ENV = 'KX2_TOOL_BUDGET_PCT'

/** 是否启用三层暴露协议 */
export function useLayeredContext(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env[TOOL_CONTEXT_ENV] || '').trim().toLowerCase()
  return v === 'layered' || v === '1' || v === 'true'
}

/**
 * 粗略 token 估算：中文按 ~1.5 字/token，ASCII 按 ~4 字符/token。
 * 用于预算控制，不追求精确（真正的计数由上游 API 返回的 usage 校准）。
 *
 * 实现统一收敛到 engine/token-counter，避免同一仓库内出现多份
 * 口径不一的估算（历史上这里是第二份实现）。
 */
export function estimateTokens(text: string): number {
  return estimateTokensWithCjk(text)
}

/** 单个工具 schema 的 token 成本 */
export function toolTokenCost(tool: ToolDefinition): number {
  const { risk, cost, labels } = normalizeToolLabels(tool)
  const schema = JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    tags: flattenLabels(labels, risk, cost),
  })
  return estimateTokens(schema)
}

export interface ContextBuildInput {
  /** 全部可用工具（已按 enabled + 平台 + 引擎注册过滤） */
  tools: ToolDefinition[]
  /** 全部分组 */
  groups: ToolGroup[]
  /** 会话 id（活跃集隔离） */
  sessionId?: string
  /** 工具部分 token 预算；0 或未给表示不限制 */
  budgetTokens?: number
}

export interface ToolContextResult {
  /** L0 + L2 合并后的完整 schema 清单（发给模型的 tools 数组来源） */
  activeTools: ToolDefinition[]
  /** L1 组目录文本 */
  groupCatalog: string
  /** 组装好的提示词块 */
  hint: string
  /** 估算 token */
  estimatedTokens: number
  /** 因预算/LRU 被移出的工具名 */
  evicted: string[]
  /** 当前是否分层模式 */
  layered: boolean
}

/**
 * 生成 L1 组目录：只有组名、描述与工具数量，不含每个工具的 schema。
 * 只统计「当前实际可用」的工具（组里可能含已删除/禁用/平台不符的 id，
 * 直接数 toolIds.length 会虚报数量，让模型误以为组里有更多工具）。
 */
export function buildGroupCatalog(
  groups: ToolGroup[],
  tools: ToolDefinition[],
  /** 分组 id → 该组内实际可用工具数；不传则按 tools 交集自行计算 */
  availableCount?: (groupId: string) => number
): string {
  const byId = new Set(tools.map(t => t.id))
  const byName = new Set(tools.map(t => t.name))
  const lines: string[] = []
  for (const g of groups) {
    if (g.enabled === false) continue
    const count = availableCount
      ? availableCount(g.id)
      : g.toolIds.filter(id => byId.has(id) || byName.has(id)).length
    if (count === 0) continue
    lines.push(`- ${g.id}: ${g.description || g.name} (${count})`)
  }
  if (lines.length === 0) return ''
  return ['可用工具组：', ...lines, '需要某类工具时用 tool_search 检索，再用 tool_load 加载。'].join('\n')
}

/**
 * 分层构建工具上下文。
 *
 * 预算超限时的淘汰顺序（dev.txt §8）：
 *   先按「非核心 + 最久未用」淘汰，核心工具永不淘汰。
 */
export function buildToolContext(input: ContextBuildInput): ToolContextResult {
  const sessionId = input.sessionId || 'default'
  const all = input.tools

  // L0：核心常驻
  const core = all.filter(t => isCoreTool(t))

  // L2：会话活跃集（元工具 load 进来的）
  const activeIds = getActiveTools(all, sessionId)
  const activeSet = new Set(activeIds)
  const l2 = all.filter(t => activeSet.has(t.id) && !isCoreTool(t))

  // 合并去重，保持「核心在前」顺序，稳定前缀利于 prompt caching
  const seen = new Set<string>()
  const picked: ToolDefinition[] = []
  for (const t of [...core, ...l2]) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    picked.push(t)
  }

  // 预算控制：超限则按「最后使用时间」淘汰非核心（核心永不淘汰）
  const evicted: string[] = []
  const costOf = new Map(picked.map(t => [t.id, toolTokenCost(t)]))
  let total = picked.reduce((n, t) => n + (costOf.get(t.id) || 0), 0)
  if (input.budgetTokens && input.budgetTokens > 0 && total > input.budgetTokens) {
    // 真正按 LRU 排序：最早使用/从未使用的先淘汰，而不是单纯依赖数组顺序
    const nonCore = picked
      .filter(t => !isCoreTool(t))
      .sort((a, b) => lastUsedAt(sessionId, a.id) - lastUsedAt(sessionId, b.id))
    for (const t of nonCore) {
      if (total <= input.budgetTokens) break
      total -= costOf.get(t.id) || 0
      evicted.push(t.name)
      const idx = picked.findIndex(x => x.id === t.id)
      if (idx >= 0) picked.splice(idx, 1)
    }
  }

  // 只记录非核心工具的暴露时间：核心工具永不淘汰，记录它们毫无意义，
  // 反而会因为「每轮都刷新」把 lastUsed 表刷大。
  for (const t of picked) if (!isCoreTool(t)) touchTool(sessionId, t.id)

  const catalog = buildGroupCatalog(input.groups, all)
  const hint = buildLayeredHint(picked, catalog, evicted)

  return {
    activeTools: picked,
    groupCatalog: catalog,
    hint,
    estimatedTokens: total,
    evicted,
    layered: true,
  }
}

/** 组装分层提示词：L0/L2 给名字与简述，L1 给组目录 */
function buildLayeredHint(tools: ToolDefinition[], catalog: string, evicted: string[]): string {
  const lines = tools.map(t => {
    const core = isCoreTool(t) ? ' [核心]' : ''
    const usage = t.usage && t.usage !== `/${t.name}` ? `（${t.usage}）` : ''
    return `- ${t.name}${core} — ${t.description || t.displayName || ''}${usage}`
  })
  const parts = [
    `【工具】当前可直接调用 ${tools.length} 个（完整参数定义见 tools 字段）：`,
    ...lines,
  ]
  if (catalog) parts.push('', catalog)
  if (evicted.length > 0) {
    parts.push('', `（因上下文预算，以下工具已暂不可用，需要时用 tool_load 重新加载：${evicted.join(', ')}）`)
  }
  return parts.join('\n')
}

/**
 * 从「工具部分应占的 token」反推预算。
 * 上下文总窗口未知时用保守默认（工具 <= 20%，dev.txt §7 预算表）。
 */
export function computeToolBudget(contextWindowTokens: number, pct?: number): number {
  const ratio = pct && pct > 0 && pct <= 100 ? pct / 100 : 0.2
  return Math.floor(contextWindowTokens * ratio)
}
