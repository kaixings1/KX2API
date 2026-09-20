/**
 * engine/ecoFilter.ts — Bash 输出压缩过滤器（Taked 自 D:\src\engine\ecoFilter.ts）
 *
 * 在 Bash 输出发送给模型前，经过确定性过滤器管道压缩原始输出（可选 tee 到 session 文件，
 * 确保可恢复）。价值：Bash 输出的 token 常占对话预算大头，压缩可显著降成本。
 *
 * 管道顺序: test-failure-focus → ceremony-strip → log-dedup → head-cap
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { roughTokenCountEstimation } from '../utils/tokenEstimation.ts'

export interface EcoStats {
  commands: number
  baselineTokens: number
  ecoTokens: number
  savedTokens: number
  savingsPct: number
  byFilter: Record<string, [uses: number, saved: number]>
}

export interface EcoSessionState {
  enabled: boolean
  sessionId: string
  teeDir: string
  stats: EcoStats
}

let currentSession: EcoSessionState | null = null

export function isEcoEnabled(): boolean {
  return currentSession?.enabled ?? false
}

export function getEcoStats(): EcoStats {
  return currentSession?.stats ?? {
    commands: 0,
    baselineTokens: 0,
    ecoTokens: 0,
    savedTokens: 0,
    savingsPct: 0,
    byFilter: {},
  }
}

export function setEcoEnabled(sessionId: string, enabled: boolean, teeDir?: string): void {
  if (enabled && !currentSession) {
    currentSession = {
      enabled: true,
      sessionId,
      teeDir: teeDir ?? '',
      stats: { commands: 0, baselineTokens: 0, ecoTokens: 0, savedTokens: 0, savingsPct: 0, byFilter: {} },
    }
  } else if (!enabled) {
    currentSession = null
  } else if (enabled && currentSession) {
    currentSession.enabled = true
    if (teeDir) currentSession.teeDir = teeDir
  }
}

export function resetEcoStats(): void {
  if (currentSession) {
    currentSession.stats = { commands: 0, baselineTokens: 0, ecoTokens: 0, savedTokens: 0, savingsPct: 0, byFilter: {} }
  }
}

function estimateTokens(text: string): number {
  return roughTokenCountEstimation(text)
}

function recordFilter(filterName: string, baseline: number, eco: number): void {
  if (!currentSession) return
  const saved = baseline - eco
  currentSession.stats.commands++
  currentSession.stats.baselineTokens += baseline
  currentSession.stats.ecoTokens += eco
  currentSession.stats.savedTokens += saved
  currentSession.stats.savingsPct = currentSession.stats.baselineTokens > 0
    ? (currentSession.stats.savedTokens / currentSession.stats.baselineTokens) * 100
    : 0
  const prev = currentSession.stats.byFilter[filterName] ?? [0, 0]
  currentSession.stats.byFilter[filterName] = [prev[0] + 1, prev[1] + saved]
}

/**
 * 过滤器 1: 测试失败高亮保留 — 保留 FAILED/FAIL/ERROR/XFAIL/XPASS 行及前后文
 */
function filterTestFailures(content: string): { result: string; baseline: number; eco: number } {
  const baseline = estimateTokens(content)
  const lines = content.split('\n')
  const keepIndices = new Set<number>()
  const TEST_FAIL_RE = /(FAILED|FAIL|ERROR:|ERROR |XFAIL|XPASS|AssertionError|panic|Segmentation fault)/i

  for (let i = 0; i < lines.length; i++) {
    if (TEST_FAIL_RE.test(lines[i])) {
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 5); j++) {
        keepIndices.add(j)
      }
    }
  }

  if (keepIndices.size === 0) {
    return { result: '❌ 错误: [无失败测试输出]', baseline, eco: estimateTokens('❌ 错误: [无失败测试输出]') }
  }

  const kept = Array.from(keepIndices).sort((a, b) => a - b).map(i => lines[i])
  const result = kept.join('\n')
  recordFilter('test-failure-focus', baseline, estimateTokens(result))
  return { result, baseline, eco: estimateTokens(result) }
}

/**
 * 过滤器 2: git/npm/pip ceremony stripping — 移除版本确认/帮助文本等噪音
 */
function filterCeremony(content: string): { result: string; baseline: number; eco: number } {
  const baseline = estimateTokens(content)
  const lines = content.split('\n')
  const filtered = lines.filter(line => {
    if (/^npm (notice|WARN|warn)\b.*\b(amd64|linux|darwin|win32)\b/im.test(line)) return false
    if (/^npm (warn|WARN) .* (deprecated|legacy)/im.test(line)) return false
    if (/^pip \d+\.\d+ from /im.test(line)) return false
    if (/^(Cloning|remote: |From https?:\/\/)/im.test(line)) return false
    if (/^\s*\* (master|main|HEAD)\s+->/im.test(line)) return false
    if (/^(Checking connectivity|Resolving deltas|Unpacking objects:\s+\d+%)\.\.\.?/im.test(line)) return false
    if (/^Downloading /im.test(line)) return false
    if (/^Installing collected packages:/im.test(line)) return false
    if (/^Successfully installed /im.test(line)) return false
    if (/^Requirement already satisfied:/im.test(line)) return false
    return true
  })

  if (filtered.length === lines.length) {
    return { result: content, baseline, eco: baseline }
  }

  const result = filtered.join('\n')
  const saved = baseline - estimateTokens(result)
  if (saved > 0) {
    recordFilter('ceremony-strip', baseline, estimateTokens(result))
  }
  return { result, baseline, eco: estimateTokens(result) }
}

/**
 * 过滤器 3: 日志去重 — 合并连续重复行
 */
function filterDedup(content: string): { result: string; baseline: number; eco: number } {
  const baseline = estimateTokens(content)
  const lines = content.split('\n')
  const result: string[] = []
  let prevLine = ''
  let repeatCount = 0
  const MAX_REPEAT = 3

  for (const line of lines) {
    if (line === prevLine && repeatCount >= MAX_REPEAT) {
      continue
    }
    if (line === prevLine) {
      repeatCount++
    } else {
      repeatCount = 0
    }
    result.push(line)
    prevLine = line
  }

  if (result.length === lines.length) {
    return { result: content, baseline, eco: baseline }
  }

  const resultStr = result.join('\n')
  recordFilter('log-dedup', baseline, estimateTokens(resultStr))
  return { result: resultStr, baseline, eco: estimateTokens(resultStr) }
}

/**
 * 过滤器 4: 可恢复 head cap — 长输出截断但 tee 到文件
 */
function filterHeadCap(
  content: string,
  maxLines: number = 200,
): { result: string; baseline: number; eco: number; truncated: boolean } {
  const baseline = estimateTokens(content)
  const lines = content.split('\n')

  if (lines.length <= maxLines) {
    return { result: content, baseline, eco: baseline, truncated: false }
  }

  const head = lines.slice(0, maxLines)
  const tail = lines.slice(-20)
  const truncated = `[... 截断 ${lines.length - maxLines - 20} 行 (共 ${lines.length} 行)。完整输出见 session tee 文件]`

  const result = [...head, truncated, ...tail].join('\n')
  recordFilter('head-cap', baseline, estimateTokens(result))
  return { result, baseline, eco: estimateTokens(result), truncated: true }
}

/**
 * 主入口: 对 Bash 输出执行 Eco 压缩管道
 *
 * 顺序: test-failure-focus → ceremony-strip → log-dedup → head-cap
 */
export function ecoCompress(
  content: string,
  isError: boolean,
  teePath?: string,
): { compressed: string; truncated: boolean; stats: { baseline: number; eco: number; saved: number } } {
  if (!isEcoEnabled()) {
    return { compressed: content, truncated: false, stats: { baseline: 0, eco: 0, saved: 0 } }
  }

  if (teePath && currentSession) {
    try {
      const dir = path.dirname(teePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      appendFileSync(teePath, `\n--- eco raw tee ---\n${content}\n`)
    } catch { /* noop */ }
  }

  const initialBaseline = estimateTokens(content)

  if (isError) {
    const failureFilter = filterTestFailures(content)
    content = failureFilter.result
  }

  const ceremonyFilter = filterCeremony(content)
  content = ceremonyFilter.result

  const dedupFilter = filterDedup(content)
  content = dedupFilter.result

  const capFilter = filterHeadCap(content)
  content = capFilter.result

  const finalEco = estimateTokens(content)
  return {
    compressed: content,
    truncated: capFilter.truncated,
    stats: { baseline: initialBaseline, eco: finalEco, saved: initialBaseline - finalEco },
  }
}

/** 导出供诊断：统计状态（会话外部读取）. */
export function getSessionStats(): EcoStats | null {
  return currentSession ? { ...currentSession.stats, byFilter: { ...currentSession.stats.byFilter } } : null
}