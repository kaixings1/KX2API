import type { ChatMessage, ChatCompletionMessageToolCall } from '../types'
import type { ToolCallingPlan } from './types'

export interface HistoryValidationIssue {
  code: string
  message: string
  severity: 'error' | 'warning'
  index: number
  relatedIndex?: number
  toolCallId?: string
  fixable?: boolean
}

export interface HistoryValidationResult {
  valid: boolean
  errors: HistoryValidationIssue[]
  warnings: HistoryValidationIssue[]
}

export interface HistoryFixResult extends HistoryValidationResult {
  fixedMessages: ChatMessage[]
}

/**
 * Validates message history for tool call / tool result structural issues.
 * Detects:
 *  - tool_result_ordering: result not immediately after its call
 *  - duplicate_tool_result: same result appears twice
 *  - tool_result_before_call: result appears before the call
 *  - tool_result_without_call: result has no matching call
 *  - tool_call_without_result: call has no matching result
 */
export function validateToolHistory(
  messages: ChatMessage[],
  _options?: { plan?: ToolCallingPlan },
): HistoryValidationResult {
  const errors: HistoryValidationIssue[] = []
  const warnings: HistoryValidationIssue[] = []

  const callFirstIndex = new Map<string, number>()
  const resultSeenIds = new Set<string>()
  const resultExistsById = new Set<string>()

  // First pass: collect all call IDs and result IDs
  for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    const message = messages[messageIndex]
    for (const toolCall of getToolCalls(message)) {
      if (!toolCall.id) {
        errors.push({
          code: 'malformed_tool_call_id',
          message: '工具调用缺少合法的字符串 id。',
          severity: 'error',
          index: messageIndex,
        })
        continue
      }
      if (!callFirstIndex.has(toolCall.id)) {
        callFirstIndex.set(toolCall.id, messageIndex)
      }
    }

    for (const result of getToolResults(message)) {
      if (!result.id) {
        errors.push({
          code: 'malformed_tool_result_id',
          message: 'Tool result is missing a valid tool_call_id reference.',
          severity: 'error',
          index: messageIndex,
        })
        continue
      }
      resultExistsById.add(result.id)
    }
  }

  // Second pass: check ordering and matching
  const pending = new Map<string, number>()
  const orderingReported = new Set<string>()

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    const message = messages[messageIndex]
    const validCallIds = getToolCalls(message).map((c) => c.id).filter((id): id is string => id !== null)
    const validResultIds = getToolResults(message).map((r) => r.id).filter((id): id is string => id !== null)

    if (pending.size > 0 && validResultIds.length === 0) {
      for (const [toolCallId, callIndex] of pending) {
        if (orderingReported.has(toolCallId)) continue
        errors.push({
          code: 'tool_result_ordering',
          message: `Tool result for "${toolCallId}" is not immediately following the assistant tool call.`,
          severity: 'error',
          index: messageIndex,
          relatedIndex: callIndex,
          toolCallId,
        })
        orderingReported.add(toolCallId)
      }
    }

    for (const toolCallId of validCallIds) {
      if (!pending.has(toolCallId)) {
        pending.set(toolCallId, messageIndex)
      }
    }

    for (const toolCallId of validResultIds) {
      if (resultSeenIds.has(toolCallId)) {
        errors.push({
          code: 'duplicate_tool_result',
          message: `Duplicate tool result found for "${toolCallId}".`,
          severity: 'error',
          index: messageIndex,
          toolCallId,
        })
        continue
      }

      resultSeenIds.add(toolCallId)

      if (pending.has(toolCallId)) {
        pending.delete(toolCallId)
        continue
      }

      const callIndex = callFirstIndex.get(toolCallId)
      if (typeof callIndex === 'number') {
        errors.push({
          code: 'tool_result_before_call',
          message: `Tool result for "${toolCallId}" appears before its assistant tool call.`,
          severity: 'error',
          index: messageIndex,
          relatedIndex: callIndex,
          toolCallId,
        })
        continue
      }

      errors.push({
        code: 'tool_result_without_call',
        message: `Tool result for "${toolCallId}" does not have a matching assistant tool call.`,
        severity: 'error',
        index: messageIndex,
        toolCallId,
      })
    }
  }

  for (const [toolCallId, callIndex] of pending) {
    if (resultExistsById.has(toolCallId)) continue
    errors.push({
      code: 'tool_call_without_result',
      message: `Assistant tool call "${toolCallId}" is missing a matching tool result.`,
      severity: 'error',
      index: callIndex,
      toolCallId,
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Fixes structural issues in message history:
 *  - reorderAdjacentToolResults: reorder result messages that follow their call
 *  - dedupeToolResults: remove duplicate result messages
 *  - removeOrphanToolResults: remove results with no matching call
 */
export function fixToolHistory(
  messages: ChatMessage[],
  options?: {
    plan?: ToolCallingPlan
    reorderAdjacentToolResults?: boolean
    dedupeToolResults?: boolean
    removeOrphanToolResults?: boolean
  },
): HistoryFixResult {
  const reorder = options?.reorderAdjacentToolResults ?? true
  const dedupe = options?.dedupeToolResults ?? true
  const removeOrphan = options?.removeOrphanToolResults ?? false

  const fixedMessages = structuredClone(messages) as ChatMessage[]
  const warnings: HistoryValidationIssue[] = []

  let changed = true
  while (changed) {
    changed = false

    if (reorder) {
      const analysis = analyzeMessages(fixedMessages)
      for (let index = 0; index < fixedMessages.length - 1; index++) {
        if (!canSwapAdjacentMessages(analysis[index], analysis[index + 1])) continue

        const current = fixedMessages[index]
        fixedMessages[index] = fixedMessages[index + 1]
        fixedMessages[index + 1] = current

        warnings.push({
          code: 'applied_reorder_adjacent_tool_result',
          message: '已调整相邻工具结果的顺序，使其紧随对应的助手工具调用。',
          severity: 'warning',
          index,
          relatedIndex: index + 1,
          fixable: true,
        })
        changed = true
        break
      }
      if (changed) continue
    }

    if (dedupe) {
      const analysis = analyzeMessages(fixedMessages)
      for (let index = 1; index < fixedMessages.length; index++) {
        if (!canRemoveDuplicateResultMessage(fixedMessages[index - 1], fixedMessages[index], analysis[index - 1], analysis[index])) continue

        fixedMessages.splice(index, 1)
        warnings.push({
          code: 'applied_dedupe_tool_result',
          message: '已移除重复的工具结果消息。',
          severity: 'warning',
          index,
          fixable: true,
        })
        changed = true
        break
      }
      if (changed) continue
    }

    if (removeOrphan) {
      const analysis = analyzeMessages(fixedMessages)
      const allCallIds = new Set(analysis.flatMap((e) => getValidIds(e.callIds)))

      for (let index = 0; index < fixedMessages.length; index++) {
        if (!isSafeOrphanResultMessage(analysis[index], allCallIds)) continue

        fixedMessages.splice(index, 1)
        warnings.push({
          code: 'applied_remove_orphan_tool_result',
          message: '已移除孤立工具结果：历史中找不到与之匹配的工具调用。',
          severity: 'warning',
          index,
          fixable: true,
        })
        changed = true
        break
      }
    }
  }

  const validation = validateToolHistory(fixedMessages, { plan: options?.plan })

  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: [...warnings, ...validation.warnings],
    fixedMessages,
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface MessageAnalysis {
  callIds: NormalizedRef[]
  resultIds: NormalizedRef[]
  pureToolCallContainer: boolean
  pureToolResultContainer: boolean
}

interface NormalizedRef {
  id: string | null
}

function analyzeMessages(messages: ChatMessage[]): MessageAnalysis[] {
  return messages.map((message) => {
    const callIds = getToolCalls(message).map((c) => ({ id: c.id }))
    const resultIds = getToolResults(message).map((r) => ({ id: r.id }))
    return {
      callIds,
      resultIds,
      pureToolCallContainer: isPureToolCallContainer(message, callIds, resultIds),
      pureToolResultContainer: isPureToolResultContainer(message, callIds, resultIds),
    }
  })
}

function getToolCalls(message: ChatMessage): Array<{ id: string | null }> {
  const calls: Array<{ id: string | null }> = []
  if (Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      calls.push({ id: tc?.id ?? null })
    }
  }
  return calls
}

function getToolResults(message: ChatMessage): Array<{ id: string | null }> {
  const results: Array<{ id: string | null }> = []
  if (message.role === 'tool' || message.tool_call_id) {
    results.push({ id: message.tool_call_id ?? null })
  }
  return results
}

function getValidIds(refs: NormalizedRef[]): string[] {
  return refs.flatMap((ref) => (ref.id ? [ref.id] : []))
}

function isPureToolCallContainer(
  message: ChatMessage,
  callIds: NormalizedRef[],
  resultIds: NormalizedRef[],
): boolean {
  return message.role === 'assistant' && callIds.length > 0 && resultIds.length === 0
}

function isPureToolResultContainer(
  message: ChatMessage,
  callIds: NormalizedRef[],
  resultIds: NormalizedRef[],
): boolean {
  if (callIds.length > 0 || resultIds.length === 0) return false
  if (message.role === 'tool') return true
  return false
}

function canSwapAdjacentMessages(left: MessageAnalysis, right: MessageAnalysis): boolean {
  if (!left.pureToolResultContainer || !right.pureToolCallContainer) return false

  const resultIds = getValidIds(left.resultIds)
  const callIds = getValidIds(right.callIds)

  if (resultIds.length === 0 || resultIds.length !== left.resultIds.length) return false
  if (callIds.length === 0 || callIds.length !== right.callIds.length) return false
  if (resultIds.length !== callIds.length) return false

  return resultIds.every((id) => callIds.includes(id))
}

function canRemoveDuplicateResultMessage(
  previousMessage: ChatMessage,
  currentMessage: ChatMessage,
  previous: MessageAnalysis,
  current: MessageAnalysis,
): boolean {
  if (!previous.pureToolResultContainer || !current.pureToolResultContainer) return false

  const previousIds = getValidIds(previous.resultIds)
  const currentIds = getValidIds(current.resultIds)

  if (
    previousIds.length === 0 ||
    previousIds.length !== previous.resultIds.length ||
    currentIds.length !== current.resultIds.length ||
    previousIds.length !== currentIds.length
  ) {
    return false
  }

  const idsMatch = previousIds.every((id) => currentIds.includes(id))
  if (!idsMatch) return false

  return stableStringify(previousMessage) === stableStringify(currentMessage)
}

function isSafeOrphanResultMessage(entry: MessageAnalysis, allCallIds: Set<string>): boolean {
  if (!entry.pureToolResultContainer) return false

  const resultIds = getValidIds(entry.resultIds)
  if (resultIds.length === 0 || resultIds.length !== entry.resultIds.length) return false

  return resultIds.every((toolCallId) => !allCallIds.has(toolCallId))
}

function stableStringify(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const sortedKeys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + sortedKeys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}'
}
