/**
 * engine/cost/costTracker.ts — API 调用成本追踪器
 *
 * 吸收自 D:\src\cost-tracker.ts，适配 Electron 架构：
 * - 内存状态管理（替代 bootstrap/state.js 的全局变量）
 * - 通过 electron-store 持久化
 * - 支持按模型统计
 */

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

export function setHasUnknownModelCost(_value: boolean): void {
  // KX2API 实现：标记未知模型成本
}

export function hasUnknownModelCost(): boolean {
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

/** FPS 指标（可选） */
export interface FpsMetrics {
  averageFps: number
  low1PctFps: number
}
