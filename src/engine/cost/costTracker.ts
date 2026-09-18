/**
 * engine/cost/costTracker.ts — API 调用成本追踪器
 *
 * 吸收自 D:\src\cost-tracker.ts，适配 Electron 架构：
 * - 内存状态管理（替代 bootstrap/state.js 的全局变量）
 * - 通过 electron-store 持久化
 * - 支持按模型统计
 */

// 用 .ts 后缀：本项目的 moduleResolution 为 "bundler"，不会把 .js 自动映射到 .ts。
// 写成 './pricing.js' 会导致该导入解析失败，进而使本模块整体解析中断 ——
// 表现为上游 `recordApiUsage` 报 "Cannot find name"（导入链断了）。
import { calculateCost } from './pricing.ts'

export interface ModelUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number
  costUSD: number
  contextWindow: number
  maxOutputTokens: number
}

export interface CostState {
  totalCostUSD: number
  totalAPIDuration: number
  totalAPIDurationWithoutRetries: number
  totalToolDuration: number
  totalLinesAdded: number
  totalLinesRemoved: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadInputTokens: number
  totalCacheCreationInputTokens: number
  totalWebSearchRequests: number
  lastDuration: number | undefined
  modelUsage: Record<string, ModelUsage>
  lastSessionId: string | undefined
}

export interface StoredCostState extends Omit<CostState, 'modelUsage'> {
  modelUsage?: Record<string, Omit<ModelUsage, 'contextWindow' | 'maxOutputTokens'>>
}

let state: CostState = {
  totalCostUSD: 0,
  totalAPIDuration: 0,
  totalAPIDurationWithoutRetries: 0,
  totalToolDuration: 0,
  totalLinesAdded: 0,
  totalLinesRemoved: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadInputTokens: 0,
  totalCacheCreationInputTokens: 0,
  totalWebSearchRequests: 0,
  lastDuration: undefined,
  modelUsage: {},
  lastSessionId: undefined,
}

/**
 * 从存储恢复成本状态
 */
export function restoreCostState(stored: StoredCostState | undefined): void {
  if (!stored) return
  state.totalCostUSD = stored.totalCostUSD ?? 0
  state.totalAPIDuration = stored.totalAPIDuration ?? 0
  state.totalAPIDurationWithoutRetries = stored.totalAPIDurationWithoutRetries ?? 0
  state.totalToolDuration = stored.totalToolDuration ?? 0
  state.totalLinesAdded = stored.totalLinesAdded ?? 0
  state.totalLinesRemoved = stored.totalLinesRemoved ?? 0
  state.totalInputTokens = stored.totalInputTokens ?? 0
  state.totalOutputTokens = stored.totalOutputTokens ?? 0
  state.totalCacheReadInputTokens = stored.totalCacheReadInputTokens ?? 0
  state.totalCacheCreationInputTokens = stored.totalCacheCreationInputTokens ?? 0
  state.totalWebSearchRequests = stored.totalWebSearchRequests ?? 0
  state.lastDuration = stored.lastDuration
  state.lastSessionId = stored.lastSessionId
  if (stored.modelUsage) {
    state.modelUsage = Object.fromEntries(
      Object.entries(stored.modelUsage).map(([model, usage]) => [
        model,
        {
          ...usage,
          contextWindow: 0,
          maxOutputTokens: 0,
        },
      ]),
    )
  }
}

/**
 * 获取用于持久化的状态快照
 */
export function getStoredState(): StoredCostState {
  return {
    ...state,
    modelUsage: Object.fromEntries(
      Object.entries(state.modelUsage).map(([model, usage]) => [
        model,
        {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadInputTokens: usage.cacheReadInputTokens,
          cacheCreationInputTokens: usage.cacheCreationInputTokens,
          webSearchRequests: usage.webSearchRequests,
          costUSD: usage.costUSD,
        },
      ]),
    ),
  }
}

// ─── 总计查询 ───

export function getTotalCostUSD(): number { return state.totalCostUSD }
export function getTotalAPIDuration(): number { return state.totalAPIDuration }
export function getTotalAPIDurationWithoutRetries(): number { return state.totalAPIDurationWithoutRetries }
export function getTotalToolDuration(): number { return state.totalToolDuration }
export function getTotalDuration(): number { return state.totalAPIDuration + state.totalToolDuration }
export function getTotalInputTokens(): number { return state.totalInputTokens }
export function getTotalOutputTokens(): number { return state.totalOutputTokens }
export function getTotalCacheReadInputTokens(): number { return state.totalCacheReadInputTokens }
export function getTotalCacheCreationInputTokens(): number { return state.totalCacheCreationInputTokens }
export function getTotalWebSearchRequests(): number { return state.totalWebSearchRequests }
export function getTotalLinesAdded(): number { return state.totalLinesAdded }
export function getTotalLinesRemoved(): number { return state.totalLinesRemoved }

// ─── 行数变更 ───

export function addToTotalLinesChanged(added: number, removed: number): void {
  state.totalLinesAdded += added
  state.totalLinesRemoved += removed
}

// ─── 模型使用 ───

export function getModelUsage(): Record<string, ModelUsage> { return state.modelUsage }
export function getUsageForModel(model: string): ModelUsage | undefined { return state.modelUsage[model] }

export function addModelUsage(
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; webSearchRequests: number },
  costUSD: number,
): void {
  const existing = state.modelUsage[model] ?? {
    inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0, webSearchRequests: 0, costUSD: 0, contextWindow: 0, maxOutputTokens: 0,
  }
  // 非有限值（NaN/Infinity）一律按 0 记账。
  //
  // 价格表没有该模型时 calculateCost 返回 NaN，调用方若直接传入，
  // `0 + NaN = NaN` 会**永久污染** totalCostUSD（之后每次累加仍是 NaN，
  // 界面上成本显示从此废掉，且无法自愈）。token 是真实测量值，照常累计；
  // 只是"算不出钱"的部分记 0，并由 hasUnknownModelCost() 暴露价格表缺口。
  const safeCost = Number.isFinite(costUSD) ? costUSD : 0
  state.modelUsage[model] = {
    ...existing,
    inputTokens: existing.inputTokens + usage.inputTokens,
    outputTokens: existing.outputTokens + usage.outputTokens,
    cacheReadInputTokens: existing.cacheReadInputTokens + usage.cacheReadInputTokens,
    cacheCreationInputTokens: existing.cacheCreationInputTokens + usage.cacheCreationInputTokens,
    webSearchRequests: existing.webSearchRequests + usage.webSearchRequests,
    costUSD: existing.costUSD + safeCost,
  }
  state.totalCostUSD += safeCost
  state.totalInputTokens += usage.inputTokens
  state.totalOutputTokens += usage.outputTokens
  state.totalCacheReadInputTokens += usage.cacheReadInputTokens
  state.totalCacheCreationInputTokens += usage.cacheCreationInputTokens
  state.totalWebSearchRequests += usage.webSearchRequests
}

// ─── 时间 ───

export function addAPIDuration(ms: number, withoutRetries?: number): void {
  state.totalAPIDuration += ms
  state.totalAPIDurationWithoutRetries += withoutRetries ?? ms
}

export function addToolDuration(ms: number): void {
  state.totalToolDuration += ms
}

export function setLastDuration(ms: number | undefined): void {
  state.lastDuration = ms
}

// ─── 重置 ───

export function resetCostState(): void {
  state = {
    totalCostUSD: 0,
    totalAPIDuration: 0,
    totalAPIDurationWithoutRetries: 0,
    totalToolDuration: 0,
    totalLinesAdded: 0,
    totalLinesRemoved: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadInputTokens: 0,
    totalCacheCreationInputTokens: 0,
    totalWebSearchRequests: 0,
    lastDuration: undefined,
    modelUsage: {},
    lastSessionId: state.lastSessionId,
  }
}

export function setCostStateForRestore(data: StoredCostState): void {
  restoreCostState(data)
}

/**
 * 显式标记「存在未知模型成本」。
 *
 * 除推导式判定外，调用方有时能直接知道「这个模型没有价格」（例如
 * 价格表查找失败）。用一个显式标志兜住这类情况，避免只靠启发式推导漏报。
 */
let _hasUnknownModelCostFlag = false

export function setHasUnknownModelCost(value: boolean): void {
  _hasUnknownModelCostFlag = value
}

export function hasUnknownModelCost(): boolean {
  if (_hasUnknownModelCostFlag) return true
  // 检查是否有任何模型「用了 token 但算不出钱」：成本为 0 或非有限值（NaN）。
  //
  // 原实现只判 `costUSD === 0`，而价格表缺失的模型走的是 NaN 路径
  // （`NaN === 0` 为 false），恰恰是最该报警的情况被漏掉。
  // addModelUsage 现在把 NaN 归零存储，但直接由 restoreCostState 读入的
  // 旧数据仍可能是 NaN，故这里两种都判。
  return Object.values(state.modelUsage).some(
    u => (u.inputTokens > 0 || u.outputTokens > 0) && (!Number.isFinite(u.costUSD) || u.costUSD === 0),
  )
}

export function getCostCounter(): number {
  return Object.keys(state.modelUsage).length
}

// ─── 接线便捷函数 ───

/**
 * 按模型记账一次 API 调用（token + 费用）。
 *
 * 这是「引擎 → 成本追踪」的单一入口：调用方只需给出模型名与 token 数，
 * 价格换算与未知模型处置都在这里完成，避免每个调用点各写一遍。
 */
export function recordApiUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  const usage = {
    inputTokens: Math.max(0, inputTokens | 0),
    outputTokens: Math.max(0, outputTokens | 0),
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    webSearchRequests: 0,
  }
  const cost = calculateCost(model, usage)
  if (!Number.isFinite(cost)) {
    // 价格表没有这个模型：token 照常统计，费用记 0，并打上未知标记
    setHasUnknownModelCost(true)
  }
  addModelUsage(model, usage, cost)
}

// ─── 费用格式化 ───

/**
 * 格式化单笔费用为 `$X.XX` 形式的可读字符串。
 *
 * 小额（< 0.01）保留更多小数位：API 单次调用常在 $0.0001 量级，
 * 一律两位小数会全部显示为 `$0.00`，等于看不到任何信息。
 * 非有限值单独显示为 `$?`，提示价格表缺失（而非误导性地显示 0）。
 */
export function formatCost(cost: number): string {
  if (!Number.isFinite(cost)) return '$?'
  if (cost === 0) return '$0.00'
  const abs = Math.abs(cost)
  if (abs < 0.01) return `$${cost.toFixed(4)}`
  if (abs < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

/**
 * 格式化总费用（含模型明细）。
 *
 * 形如：
 *   总费用：$0.1234
 *     gpt-4o            $0.1000  1,200 in / 800 out
 *     claude-3-haiku    $0.0234  5,000 in / 0 out
 *   未知模型成本：存在（价格表可能缺失）
 */
export function formatTotalCost(): string {
  const lines: string[] = [`总费用：${formatCost(state.totalCostUSD)}`]
  const entries = Object.entries(state.modelUsage)
    .sort((a, b) => b[1].costUSD - a[1].costUSD)

  for (const [model, u] of entries) {
    lines.push(
      `  ${model.padEnd(24)} ${formatCost(u.costUSD).padStart(9)}  ` +
        `${u.inputTokens.toLocaleString()} in / ${u.outputTokens.toLocaleString()} out`,
    )
  }

  if (entries.length === 0) {
    lines.push('  （暂无调用记录）')
  }
  if (hasUnknownModelCost()) {
    lines.push('未知模型成本：存在（价格表可能缺失，费用统计不完整）')
  }
  return lines.join('\n')
}

/**
 * 重置所有状态（含显式标志）。测试专用。
 *
 * 与 `resetCostState()` 的区别：后者保留 `lastSessionId`（跨会话标识），
 * 且不清 `hasUnknownModelCost` 的显式标志 —— 测试需要完全干净的初始态。
 */
export function resetStateForTests(): void {
  resetCostState()
  state.lastSessionId = undefined
  _hasUnknownModelCostFlag = false
}

/** FPS 指标（可选） */
export interface FpsMetrics {
  averageFps: number
  low1PctFps: number
}
