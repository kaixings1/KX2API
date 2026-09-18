/**
 * engine/cost/costHook.ts — useCostSummary Hook (Electron 适配版)
 *
 * 吸收自 D:\src\costHook.ts。原版在终端 REPL 的 process.on('exit') 中保存成本，
 * KX2API 使用 Electron，改为由渲染器在会话结束事件中触发保存。
 *
 * ⚠️ 架构归属提醒：本文件是**唯一的 engine 层 React 依赖**（useEffect）。
 * engine 层会被主进程（Node 环境，无 React）加载，React hook 放在这里是错位的。
 * 它当前**未被任何代码引用**，因此没有实际影响；但若要启用它，正确做法是
 * 把它移到 `src/renderer/src/hooks/`（那边已有 useAgentExecution 等同类文件），
 * 而不是让渲染层的 hook 从 engine barrel 里被导出。
 * 保留在此仅为「移植痕迹」，请勿从 `engine/cost/index.ts` 或
 * `engine/index.ts` 中导出它 —— 那会把 React 拉进主进程打包。
 */

import { useEffect } from 'react'
import {
  getTotalCostUSD,
  getTotalAPIDuration,
  getTotalDuration,
  getTotalLinesAdded,
  getTotalLinesRemoved,
  getTotalInputTokens,
  getTotalOutputTokens,
  getTotalCacheReadInputTokens,
  getTotalCacheCreationInputTokens,
  getTotalWebSearchRequests,
  getModelUsage,
  getStoredState,
  type FpsMetrics,
} from './costTracker.ts'

export interface CostSummaryData {
  totalCostUSD: number
  totalAPIDuration: number
  totalDuration: number
  totalLinesAdded: number
  totalLinesRemoved: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadInputTokens: number
  totalCacheCreationInputTokens: number
  totalWebSearchRequests: number
  modelUsage: Record<string, { costUSD: number; inputTokens: number; outputTokens: number }>
}

export function useCostSummary(
  _getFpsMetrics?: () => FpsMetrics | undefined,
  onSave?: (data: CostSummaryData) => void,
): CostSummaryData {
  const data: CostSummaryData = {
    totalCostUSD: getTotalCostUSD(),
    totalAPIDuration: getTotalAPIDuration(),
    totalDuration: getTotalDuration(),
    totalLinesAdded: getTotalLinesAdded(),
    totalLinesRemoved: getTotalLinesRemoved(),
    totalInputTokens: getTotalInputTokens(),
    totalOutputTokens: getTotalOutputTokens(),
    totalCacheReadInputTokens: getTotalCacheReadInputTokens(),
    totalCacheCreationInputTokens: getTotalCacheCreationInputTokens(),
    totalWebSearchRequests: getTotalWebSearchRequests(),
    modelUsage: Object.fromEntries(
      Object.entries(getModelUsage()).map(([model, usage]) => [
        model,
        { costUSD: usage.costUSD, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      ]),
    ),
  }

  useEffect(() => {
    return () => {
      // 组件卸载时保存（对应 D:\src 的 process.on('exit')）
      onSave?.(data)
    }
  }, [data, onSave])

  return data
}

/**
 * 获取用于持久化的完整状态快照
 */
export function getCostSnapshot(fpsMetrics?: FpsMetrics) {
  return {
    ...getStoredState(),
    lastFpsAverage: fpsMetrics?.averageFps,
    lastFpsLow1Pct: fpsMetrics?.low1PctFps,
  }
}
