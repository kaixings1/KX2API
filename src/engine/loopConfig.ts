/**
 * engine/loopConfig.ts — Agent 循环控制参数
 *
 * 这些值原先散落为 messageLoop.ts 内的硬编码常量，直接决定
 * 「循环跑几轮、什么情况该切断」，属于影响程序走向的关键参数。
 * 集中到此并支持外部注入，便于调优而无需改代码。
 *
 * 全部字段可选：缺省时回落到 DEFAULT_AGENT_LOOP_CONFIG，
 * 保证未配置的用户行为与改造前完全一致。
 */

export interface AgentLoopConfig {
  /** 单次用户请求内，模型-工具往返的最大轮数，防止无限循环 */
  maxIterations?: number
  /** 连续「模型给出无法解析工具名」达到该次数即中止本轮 */
  maxInvalidToolCalls?: number
  /** 连续工具执行失败达到该次数即中止本轮 */
  maxToolFailures?: number
  /** 连续命中 max_tokens 达到该次数即停止续写，避免空转烧钱 */
  maxConsecutiveMaxTokens?: number
  /** 连续几轮工具签名完全一致（无进展死循环）即切断 */
  toolLoopThreshold?: number
  /** 自动续写的最大次数 */
  autoContinueMaxCount?: number
  /** 命中「是否继续」等关键词后，等待多久自动发送「继续」（毫秒） */
  autoContinueDelayMs?: number
}

/** 默认值 —— 与改造前的硬编码常量逐一对齐，确保行为不变 */
export const DEFAULT_AGENT_LOOP_CONFIG: Required<AgentLoopConfig> = {
  maxIterations: 100,
  maxInvalidToolCalls: 2,
  maxToolFailures: 3,
  maxConsecutiveMaxTokens: 3,
  toolLoopThreshold: 2,
  autoContinueMaxCount: 5,
  autoContinueDelayMs: 3000,
}

/**
 * 合并用户配置与默认值。
 *
 * 只接受「有限正数」：undefined / NaN / 0 / 负数一律回落到默认，
 * 避免用户填入非法值导致循环失控（如 maxIterations: 0 直接不执行）
 * 或永不终止（如 Infinity）。
 */
export function resolveLoopConfig(
  input?: AgentLoopConfig | null | void,
): Required<AgentLoopConfig> {
  if (!input) return { ...DEFAULT_AGENT_LOOP_CONFIG }
  const d = DEFAULT_AGENT_LOOP_CONFIG
  const pick = (v: number | undefined, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
  return {
    maxIterations: pick(input.maxIterations, d.maxIterations),
    maxInvalidToolCalls: pick(input.maxInvalidToolCalls, d.maxInvalidToolCalls),
    maxToolFailures: pick(input.maxToolFailures, d.maxToolFailures),
    maxConsecutiveMaxTokens: pick(
      input.maxConsecutiveMaxTokens,
      d.maxConsecutiveMaxTokens,
    ),
    toolLoopThreshold: pick(input.toolLoopThreshold, d.toolLoopThreshold),
    autoContinueMaxCount: pick(
      input.autoContinueMaxCount,
      d.autoContinueMaxCount,
    ),
    autoContinueDelayMs: pick(input.autoContinueDelayMs, d.autoContinueDelayMs),
  }
}
