/**
 * tools/toolMetrics.ts — 工具运行时的度量与评估（dev.txt §13）
 *
 * 记录每次请求的工具上下文与调用情况，用于回答：
 *   - 工具部分占了多少 token（上下文成本）
 *   - 动态加载是否增加了轮次与延迟
 *   - 误选率如何（模型选了不在活跃集里的工具 = 一次误选）
 *   - 分层模式 vs 全量模式谁更省
 *
 * 存储：内存环形缓冲 + 定期汇总，不写库（量小，且避免引入 SQLite 依赖）。
 * 需要长期留存时可从此处导出到文件。
 */

export interface ToolCallRecord {
  ts: number
  sessionId: string
  tool: string
  /** 是否在活跃集内（false = 误选，模型调了没加载的工具） */
  wasActive: boolean
  allowed: boolean
  /** 拒绝原因 */
  reason?: string
  durationMs: number
  /** 输出字节数 */
  outputBytes: number
  ok: boolean
}

export interface ContextRecord {
  ts: number
  sessionId: string
  layered: boolean
  /** 发给模型的工具数 */
  exposed: number
  /** 工具库总数 */
  total: number
  /** 工具部分估算 token */
  estimatedTokens: number
  /** 因预算被淘汰的工具数 */
  evicted: number
}

const MAX_RECORDS = 2000

const calls: ToolCallRecord[] = []
const contexts: ContextRecord[] = []

/** 记录一次工具调用 */
export function recordToolCall(rec: Omit<ToolCallRecord, 'ts'>): void {
  calls.push({ ...rec, ts: Date.now() })
  if (calls.length > MAX_RECORDS) calls.splice(0, calls.length - MAX_RECORDS)
}

/** 记录一次上下文构建 */
export function recordContext(rec: Omit<ContextRecord, 'ts'>): void {
  contexts.push({ ...rec, ts: Date.now() })
  if (contexts.length > MAX_RECORDS) contexts.splice(0, contexts.length - MAX_RECORDS)
}

export interface ToolMetricsSummary {
  /** 调用总次数 */
  totalCalls: number
  /** 成功率 */
  successRate: number
  /** 误选率：调用了未加载的工具 */
  misselectRate: number
  /** 被权限拒绝的比例 */
  deniedRate: number
  /** 平均耗时 */
  avgDurationMs: number
  /** 平均输出字节 */
  avgOutputBytes: number
  /** 上下文请求数 */
  totalContexts: number
  /** 平均暴露工具数 */
  avgExposedTools: number
  /** 平均工具部分 token */
  avgToolTokens: number
  /** 分层模式占比 */
  layeredRatio: number
  /** 调用次数最多的工具 TopN */
  topTools: Array<{ name: string; count: number }>
}

/** 汇总统计。since 为毫秒时间戳，只统计该时刻之后的记录。 */
export function summarize(since = 0, topN = 10): ToolMetricsSummary {
  const c = calls.filter(r => r.ts >= since)
  const ctx = contexts.filter(r => r.ts >= since)

  const counts = new Map<string, number>()
  for (const r of c) counts.set(r.tool, (counts.get(r.tool) || 0) + 1)
  const topTools = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, topN)

  // 无样本时显式归零，避免拿 0 当「成功率 0%」误报；有样本才做除法。
  const hasCall = c.length > 0
  const hasCtx = ctx.length > 0

  return {
    totalCalls: c.length,
    successRate: hasCall ? c.filter(r => r.ok).length / c.length : 0,
    misselectRate: hasCall ? c.filter(r => !r.wasActive).length / c.length : 0,
    deniedRate: hasCall ? c.filter(r => !r.allowed).length / c.length : 0,
    avgDurationMs: hasCall ? c.reduce((s, r) => s + r.durationMs, 0) / c.length : 0,
    avgOutputBytes: hasCall ? c.reduce((s, r) => s + r.outputBytes, 0) / c.length : 0,
    totalContexts: ctx.length,
    avgExposedTools: hasCtx ? ctx.reduce((s, r) => s + r.exposed, 0) / ctx.length : 0,
    avgToolTokens: hasCtx ? ctx.reduce((s, r) => s + r.estimatedTokens, 0) / ctx.length : 0,
    layeredRatio: hasCtx ? ctx.filter(r => r.layered).length / ctx.length : 0,
    topTools,
  }
}

/** 清空（测试用 / 手动重置） */
export function resetMetrics(): void {
  calls.length = 0
  contexts.length = 0
}

/** 导出原始记录（供离线分析或落盘） */
export function exportMetrics(): { calls: ToolCallRecord[]; contexts: ContextRecord[] } {
  return { calls: [...calls], contexts: [...contexts] }
}
