/**
 * main/runtimeConfigApply.ts — 代理层与日志层运行参数的落地
 *
 * 与 engine-bridge 的 applyToolRuntimeConfig 分工：
 * 那边管「引擎侧」参数（循环、工具、记忆、子代理），
 * 这边管「基础设施侧」参数（去重、流队列、探测超时、轮询间隔、日志保留）。
 *
 * 两组都从同一份 ConfigManager 读取，读不到就用默认值（行为与改造前一致）。
 */

import { ConfigManager } from './store/config'

interface ProxyRuntimeShape {
  dedupWindowMs?: number
  dedupMaxBufferMb?: number
  queueDetectorMaxBytes?: number
  checkTimeoutMs?: number
  taskCheckIntervalMs?: number
}

interface LogRuntimeShape {
  maxLogs?: number
  retentionDays?: number
  auditBufferSize?: number
  auditFlushIntervalMs?: number
  promptSectionCacheLimit?: number
}

/**
 * 应用辅助运行参数。
 *
 * 所有子项都是「尽力而为」：任一项失败不影响其他项，
 * 配置异常绝不能让代理或日志功能不可用。
 */
export function applyAuxRuntimeConfig(): void {
  let cfg: { proxyRuntime?: ProxyRuntimeShape; logRuntime?: LogRuntimeShape } | void
  try {
    cfg = ConfigManager.get() as typeof cfg
  } catch {
    return
  }
  if (!cfg) return

  const proxy = cfg.proxyRuntime
  if (proxy) {
    void import('./proxy/dedup/index.ts')
      .then(({ setDedupOptions }) => {
        setDedupOptions({
          dedupWindowMs: proxy.dedupWindowMs,
          maxBufferMb: proxy.dedupMaxBufferMb,
        })
      })
      .catch(() => {})

    void import('./proxy/utils/streamQueueDetector.ts')
      .then(({ setMaxQueueBytes }) => {
        setMaxQueueBytes(proxy.queueDetectorMaxBytes)
      })
      .catch(() => {})

    void import('./providers/checker.ts')
      .then(({ setCheckTimeout }) => {
        setCheckTimeout(proxy.checkTimeoutMs)
      })
      .catch(() => {})
  }

  const log = cfg.logRuntime
  if (log) {
    void import('../engine/promptSections.ts')
      .then(({ setSectionCacheLimit, clearSectionCache }) => {
        setSectionCacheLimit(log.promptSectionCacheLimit)
        // 缓存上限变化后旧条目可能不再适配，清空重算更稳妥
        clearSectionCache()
      })
      .catch(() => {})
  }
}

/**
 * 把日志与审计的保留策略推给已存在的实例。
 *
 * 与 applyAuxRuntimeConfig 分开，是因为日志/审计实例由启动流程持有，
 * 不属于模块级单例 —— 调用方需把实例传进来。
 */
export interface LogLimitsTarget {
  setLimits: (o: { maxLogs?: number; retentionDays?: number }) => void
}

export interface AuditLimitsTarget {
  setLimits: (o: { maxBufferSize?: number; flushIntervalMs?: number }) => void
}

export function applyLogLimitsTo(
  logger?: LogLimitsTarget,
  audit?: AuditLimitsTarget,
): void {
  try {
    const cfg = ConfigManager.get() as { logRuntime?: LogRuntimeShape } | void
    const log = cfg?.logRuntime
    if (!log) return
    logger?.setLimits({ maxLogs: log.maxLogs, retentionDays: log.retentionDays })
    audit?.setLimits({
      maxBufferSize: log.auditBufferSize,
      flushIntervalMs: log.auditFlushIntervalMs,
    })
  } catch {
    /* 配置异常时保持既有设置 */
  }
}
