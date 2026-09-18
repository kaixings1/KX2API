/**
 * engine/tool-history-guard/fix.ts — 工具历史修复器
 *
 * 与 validate.ts 的分工：
 *   - validate.ts **只报告不改**（其 issue 一律 fixable:false，作为诊断口径）
 *   - 本文件负责**实际改写**消息序列，三项修复各自可开关：
 *       reorderAdjacentToolResults  把错位的结果挪回其 tool_call 之后
 *       removeOrphanToolResults     删除找不到对应调用的孤立结果
 *       dedupeToolResults           同一 id 的重复结果只保留第一条
 *
 * 为什么需要它：
 *   上游（Anthropic / OpenAI）对 tool_calls 与 tool 结果要求**严格配对且顺序一致**，
 *   违反时直接返回 400「tool calls and tool results do not match」，整轮对话无法继续。
 *   validate 能指出问题，但格式一旦出错仍需有人把它改成合法形态 —— 就是本模块。
 *
 * 注意：本模块处理的是**线格式**（`tool_calls` / `tool_call_id` / `tool_use_id`），
 * 与 engine 内部的 `InternalMessage.toolUseId` 是两套方言，不要混用。
 */

import {
  FixOptions,
  FixResult,
  HistoryAdapter,
  Message,
  ValidationIssue,
} from "./types";
import {
  analyzeMessages,
  cloneMessages,
  createIssue,
  defaultHistoryAdapter,
  getValidIds,
} from "./utils";
import { validateToolHistory } from "./validate";

/** 修复开关的默认值：三项全开（调用方要的是"能修就修"） */
const DEFAULT_OPTIONS = {
  removeOrphanToolResults: true,
  reorderAdjacentToolResults: true,
  dedupeToolResults: true,
} as const;

/**
 * 修复工具历史的配对与顺序问题。
 *
 * 流程：先 validate 拿到诊断 → 在克隆副本上施加三项修复 → 记录 applied_* 警告 →
 *       对修复结果再 validate 一次，把最终结论写回 valid/errors。
 *
 * 之所以"先校验再看开关"：如果消息本来就合法，不该因为开关打开就重组顺序 ——
 * 那会平白改变对话时序（prompt cache 也会失效）。
 */
export function fixToolHistory<TMessage extends Message>(
  messages: TMessage[],
  options: FixOptions<TMessage> = {},
): FixResult<TMessage> {
  const adapter = (options.adapter ?? defaultHistoryAdapter) as HistoryAdapter<TMessage>;
  const flags = {
    removeOrphanToolResults: options.removeOrphanToolResults ?? DEFAULT_OPTIONS.removeOrphanToolResults,
    reorderAdjacentToolResults:
      options.reorderAdjacentToolResults ?? DEFAULT_OPTIONS.reorderAdjacentToolResults,
    dedupeToolResults: options.dedupeToolResults ?? DEFAULT_OPTIONS.dedupeToolResults,
  };

  const warnings: ValidationIssue[] = [];
  let working = cloneMessages(messages);

  // ── 1) 去重：同一 id 的结果只保留第一条 ──
  if (flags.dedupeToolResults) {
    const seen = new Set<string>()
    const deduped: TMessage[] = []
    for (let i = 0; i < working.length; i++) {
      const ids = getValidIds(adapter.getToolResults(working[i]))
      const dupId = ids.find((id) => seen.has(id))
      if (dupId) {
        warnings.push(
          createIssue({
            code: "applied_dedupe_tool_result",
            severity: "warning",
            index: i,
            toolCallId: dupId,
            message: `Removed duplicate tool result for "${dupId}".`,
          }),
        )
        continue
      }
      for (const id of ids) seen.add(id)
      deduped.push(working[i])
    }
    working = deduped
  }

  // ── 2) 删除孤立结果：找不到对应 tool_call 的结果 ──
  if (flags.removeOrphanToolResults) {
    // 先收集全部 call id（在原始顺序上扫，避免边删边判的偏差）
    const allCallIds = new Set<string>()
    for (const msg of working) {
      for (const id of getValidIds(adapter.getToolCalls(msg))) allCallIds.add(id)
    }

    const kept: TMessage[] = []
    for (let i = 0; i < working.length; i++) {
      const ids = getValidIds(adapter.getToolResults(working[i]))
      const orphanId = ids.find((id) => !allCallIds.has(id))
      if (orphanId) {
        warnings.push(
          createIssue({
            code: "applied_remove_orphan_tool_result",
            severity: "warning",
            index: i,
            toolCallId: orphanId,
            message: `Removed orphan tool result for "${orphanId}" (no matching tool call).`,
          }),
        )
        continue
      }
      kept.push(working[i])
    }
    working = kept
  }

  // ── 3) 重排：把结果挪回其 tool_call 所在的 assistant 消息之后 ──
  if (flags.reorderAdjacentToolResults) {
    const analysis = analyzeMessages(working, adapter)

    // 每个 call id → 它所属消息的下标；以及每个结果消息 → 它引用的 id 列表
    const callIdToMsgIndex = new Map<string, number>()
    for (let i = 0; i < analysis.length; i++) {
      for (const id of getValidIds(analysis[i].callIds)) {
        if (!callIdToMsgIndex.has(id)) callIdToMsgIndex.set(id, i)
      }
    }

    // 结果消息按「它引用的 call 所属消息」归组；其余消息保持原位
    const insertAfter = new Map<number, TMessage[]>()
    const repositionedIndices = new Set<number>()

    for (let i = 0; i < working.length; i++) {
      const ids = getValidIds(adapter.getToolResults(working[i]))
      if (ids.length === 0) continue

      const ownerIndex = callIdToMsgIndex.get(ids[0])
      if (typeof ownerIndex !== "number") continue
      // 已经紧邻正确位置 → 不动（避免无谓重排）
      if (i === ownerIndex + 1) continue

      // 只在「该结果出现在其 owner 之后」时重排；
      // 出现在 owner 之前的属「结果先于调用」，这类重排会改变时序语义，
      // 交由上游或人工处理，修复器不擅自搬动。
      if (i < ownerIndex) continue

      const bucket = insertAfter.get(ownerIndex) ?? []
      bucket.push(working[i])
      insertAfter.set(ownerIndex, bucket)
      repositionedIndices.add(i)

      warnings.push(
        createIssue({
          code: "applied_reorder_adjacent_tool_result",
          severity: "warning",
          index: i,
          relatedIndex: ownerIndex,
          toolCallId: ids[0],
          message: `Moved tool result for "${ids[0]}" next to its assistant tool call.`,
        }),
      )
    }

    if (repositionedIndices.size > 0) {
      const reordered: TMessage[] = []
      for (let i = 0; i < working.length; i++) {
        if (!repositionedIndices.has(i)) reordered.push(working[i])
        const bucket = insertAfter.get(i)
        if (bucket) reordered.push(...bucket)
      }
      working = reordered
    }
  }

  // ── 4) 用最终序列重新校验，得出权威结论 ──
  const finalCheck = validateToolHistory(working, { adapter })

  return {
    valid: finalCheck.valid,
    errors: finalCheck.errors,
    warnings: [...finalCheck.warnings, ...warnings],
    fixedMessages: working,
  };
}
