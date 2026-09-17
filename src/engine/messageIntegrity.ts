/**
 * engine/messageIntegrity.ts — 消息配对完整性与 API 轮次分组
 *
 * 移植自 D:\src 的两处实现：
 * - `services/compact/grouping.ts` 的 `groupMessagesByApiRound`
 * - `utils/messages.ts` 的 `ensureToolResultPairing`
 *
 * 解决的问题：Anthropic / OpenAI 都要求 `tool_use` 与 `tool_result` 严格配对。
 * 一旦压缩/恢复/截断把配对切断，API 会直接 400（孤立 tool_result 或缺失
 * tool_result），整轮对话无法继续。这两个函数是所有压缩策略的安全前提。
 */

import type { InternalMessage } from './messageNormalizer.ts'

/** 缺失工具结果时插入的占位内容（明确标记为错误，让模型知道工具没跑成） */
export const SYNTHETIC_TOOL_RESULT_PLACEHOLDER =
  '[工具结果缺失：该工具调用未产生输出，可能因中断、压缩或会话恢复导致。请勿假设它已成功，如需结果请重新调用。]'

/** 孤立 tool_result 被剥离后，若消息整体变空则用它占位 */
const EMPTY_MESSAGE_PLACEHOLDER = '[内容因配对修复被移除]'

/** 判断一条消息是否为「带工具调用的助手消息」 */
function isAssistantWithToolUse(msg: InternalMessage): boolean {
  if (msg.role !== 'assistant') return false
  if (!Array.isArray(msg.content)) return false
  return (msg.content as Array<Record<string, unknown>>).some(b => b && typeof b === 'object' && b.type === 'tool_use')
}

/** 抽取助手消息里所有 tool_use 的 id */
function collectToolUseIds(msg: InternalMessage): string[] {
  if (!Array.isArray(msg.content)) return []
  const ids: string[] = []
  for (const b of msg.content as Array<Record<string, unknown>>) {
    if (b && typeof b === 'object' && b.type === 'tool_use' && typeof b.id === 'string' && b.id) {
      ids.push(b.id)
    }
  }
  return ids
}

/**
 * 按 API 轮次分组：一组 = 一次 API 往返。
 *
 * 边界判定 = 出现一条**新的助手消息**。API 契约要求每条 tool_use 都在下一次
 * 助手发言之前被解析完，因此助手消息的起点天然是安全切点 —— 配对有效性由此
 * 自动成立，无需追踪未解析的 tool_use（追踪的做法在会话畸形时会把边界永久锁死，
 * 反而把所有轮次并成一组）。
 *
 * KX2API 没有 Claude Code 的 `message.id`（流式分块共享同一 id），
 * 但每轮只产生一条聚合后的助手消息，语义等价。
 */
export function groupMessagesByApiRound(messages: InternalMessage[]): InternalMessage[][] {
  const groups: InternalMessage[][] = []
  let current: InternalMessage[] = []

  for (const msg of messages) {
    if (msg.role === 'assistant' && current.length > 0) {
      groups.push(current)
      current = [msg]
    } else {
      current.push(msg)
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

/**
 * 保证 `tool_use` 与 `tool_result` 严格配对，修复四类畸形：
 *
 * 1. **重复 tool_use**：同一 id 在多个助手消息里出现 → 只保留首次出现的那个块
 *    （否则 API 报 "tool_use ids must be unique"）
 * 2. **孤立 tool_result**：工具消息找不到对应的 tool_use（压缩/恢复后常见）→ 剥离该消息
 * 3. **缺失 tool_result**：有 tool_use 但从没有结果 → 插入合成错误结果占位
 * 4. **重复 tool_result**：同一 id 出现多次 → 只保留首次
 *
 * 本函数是纯函数，不修改入参。
 */
export function ensureToolResultPairing(messages: InternalMessage[]): InternalMessage[] {
  const out: InternalMessage[] = []

  // ── Pass 1：清掉重复 tool_use，并按**出现顺序**收集本次 assistant 的 tool_use id ──
  const seenToolUse = new Set<string>()

  const pass1: InternalMessage[] = []
  for (const msg of messages) {
    if (!isAssistantWithToolUse(msg)) {
      pass1.push(msg)
      continue
    }
    const blocks = msg.content as Array<Record<string, unknown>>
    const keptBlocks: Array<Record<string, unknown>> = []
    for (const b of blocks) {
      if (b && typeof b === 'object' && b.type === 'tool_use' && typeof b.id === 'string' && b.id) {
        if (seenToolUse.has(b.id)) {
          if (process.env.KX2_DEBUG_INTEGRITY === '1') {
            console.warn(`[MessageIntegrity] 剥离重复 tool_use: ${b.id}`)
          }
          continue
        }
        seenToolUse.add(b.id)
      }
      keptBlocks.push(b)
    }
    // 所有块都被剥离后不能留空助手消息；补一个 text 占位保住角色序列
    pass1.push(
      keptBlocks.length > 0
        ? { ...msg, content: keptBlocks }
        : { ...msg, content: [{ type: 'text', text: EMPTY_MESSAGE_PLACEHOLDER }] },
    )
  }

  // ── Pass 2：按「assistant → 其全部 tool 结果」重排 ──
  //
  // 原实现只做「剥离孤立 / 补占位」，完全不动顺序。而严格的 API 实现既要求
  // 配对存在，也要求结果与对应 tool_use 保持相邻且顺序一致，否则报
  //   400: tool calls and tool results do not match
  // 常见触发场景：同一 assistant 的多个结果乱序、结果之间夹了 system 消息、
  // 压缩后占位结果被追加到末尾。这里统一按 tool_use 的原始顺序收拢。
  const resultById = new Map<string, InternalMessage>()
  const groupless: InternalMessage[] = []

  for (const msg of pass1) {
    if (msg.role !== 'tool') {
      groupless.push(msg)
      continue
    }
    const id = msg.toolUseId
    const known = typeof id === "string" && id.length > 0 && seenToolUse.has(id)
    if (!known) {
      if (process.env.KX2_DEBUG_INTEGRITY === '1') {
        console.warn(`[MessageIntegrity] 剥离孤立 tool_result: ${String(id)}`)
      }
      continue
    }
    if (resultById.has(id)) {
      if (process.env.KX2_DEBUG_INTEGRITY === '1') {
        console.warn(`[MessageIntegrity] 剥离重复 tool_result: ${id}`)
      }
      continue
    }
    resultById.set(id, msg)
  }

  // 重建：遇到 assistant(tool_use) 时，立刻按顺序补上它的全部结果
  for (const msg of groupless) {
    if (!isAssistantWithToolUse(msg)) {
      out.push(msg)
      continue
    }
    out.push(msg)
    for (const id of collectToolUseIds(msg)) {
      const existing = resultById.get(id)
      if (existing) {
        out.push(existing)
      } else {
        // 缺失结果 → 补占位，且必须紧跟在对应的 tool_use 之后
        out.push({
          role: 'tool',
          toolUseId: id,
          content: SYNTHETIC_TOOL_RESULT_PLACEHOLDER,
        })
      }
    }
  }

  return out
}
function findLastIndex<T>(arr: T[], pred: (x: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i
  }
  return -1
}

export interface SafeSplitResult {
  /** 保留的近期消息（配对完整） */
  kept: InternalMessage[]
  /** 被切掉的旧消息（配对完整，用于生成摘要） */
  dropped: InternalMessage[]
}

/**
 * 在 API 轮次边界切分消息，保证 `dropped` 与 `kept` 各自配对完整。
 *
 * 这是压缩的安全前提：直接 `messages.slice(-N)` 会把切点落在
 * `assistant(tool_use)` 与 `tool_result` 之间，导致保留段以孤立
 * tool_result 开头，下一次请求直接 400。
 *
 * @param messages       完整消息列表
 * @param keepRecentCount 期望保留的「轮次」数量（非消息条数）
 */
export function splitAtSafeBoundary(
  messages: InternalMessage[],
  keepRecentCount: number,
): SafeSplitResult {
  if (messages.length === 0) return { kept: [], dropped: [] }

  const groups = groupMessagesByApiRound(messages)
  // 至少要留一组（最后一组就是当前进行中的轮次）
  const keep = Math.max(1, Math.min(keepRecentCount, groups.length))
  const droppedGroups = groups.slice(0, groups.length - keep)
  const keptGroups = groups.slice(groups.length - keep)

  return {
    dropped: droppedGroups.flat(),
    kept: keptGroups.flat(),
  }
}
