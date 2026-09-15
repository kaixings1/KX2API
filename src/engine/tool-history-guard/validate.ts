import {
  HistoryAdapter,
  Message,
  ValidateOptions,
  ValidationIssue,
  ValidationResult,
} from "./types";
import {
  analyzeMessages,
  createIssue,
  defaultHistoryAdapter,
  getValidIds,
} from "./utils";

export function validateToolHistory<TMessage extends Message>(
  messages: TMessage[],
  options: ValidateOptions<TMessage> = {},
): ValidationResult<TMessage> {
  const adapter = (options.adapter ?? defaultHistoryAdapter) as HistoryAdapter<TMessage>;
  const analysis = analyzeMessages(messages, adapter);
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const callFirstIndex = new Map<string, number>();
  const resultSeenIds = new Set<string>();
  const resultExistsById = new Set<string>();

  for (const [messageIndex, entry] of analysis.entries()) {
    for (const toolCall of entry.callIds) {
      if (!toolCall.id) {
        errors.push(
          createIssue({
            code: "malformed_tool_call_id",
            index: messageIndex,
            message: "Tool call is missing a valid string id.",
          }),
        );
        continue;
      }

      if (!callFirstIndex.has(toolCall.id)) {
        callFirstIndex.set(toolCall.id, messageIndex);
      }
    }

    for (const result of entry.resultIds) {
      if (!result.id) {
        errors.push(
          createIssue({
            code: "malformed_tool_result_id",
            index: messageIndex,
            message: "Tool result is missing a valid tool_call_id or tool_use_id reference.",
          }),
        );
        continue;
      }

      resultExistsById.add(result.id);
    }
  }

  const pending = new Map<string, number>();
  const orderingReported = new Set<string>();

  for (const [messageIndex, entry] of analysis.entries()) {
    const validCallIds = getValidIds(entry.callIds);
    const validResultIds = getValidIds(entry.resultIds);

    if (pending.size > 0 && validResultIds.length === 0) {
      for (const [toolCallId, callIndex] of pending.entries()) {
        if (orderingReported.has(toolCallId)) {
          continue;
        }

        errors.push(
          createIssue({
            code: "tool_result_ordering",
            index: messageIndex,
            relatedIndex: callIndex,
            toolCallId,
            fixable: false,
            message: `Tool result for "${toolCallId}" is not immediately following the assistant tool call.`,
          }),
        );
        orderingReported.add(toolCallId);
      }
    }

    for (const toolCallId of validCallIds) {
      if (!pending.has(toolCallId)) {
        pending.set(toolCallId, messageIndex);
      }
    }

    for (const toolCallId of validResultIds) {
      if (resultSeenIds.has(toolCallId)) {
        errors.push(
          createIssue({
            code: "duplicate_tool_result",
            index: messageIndex,
            toolCallId,
            fixable: false,
            message: `Duplicate tool result found for "${toolCallId}".`,
          }),
        );
        continue;
      }

      resultSeenIds.add(toolCallId);

      if (pending.has(toolCallId)) {
        pending.delete(toolCallId);
        continue;
      }

      const callIndex = callFirstIndex.get(toolCallId);
      if (typeof callIndex === "number") {
        errors.push(
          createIssue({
            code: "tool_result_before_call",
            index: messageIndex,
            relatedIndex: callIndex,
            toolCallId,
            fixable: false,
            message: `Tool result for "${toolCallId}" appears before its assistant tool call.`,
          }),
        );
        continue;
      }

      errors.push(
        createIssue({
          code: "tool_result_without_call",
          index: messageIndex,
          toolCallId,
          fixable: false,
          message: `Tool result for "${toolCallId}" does not have a matching assistant tool call.`,
        }),
      );
    }
  }

  for (const [toolCallId, callIndex] of pending.entries()) {
    if (resultExistsById.has(toolCallId)) {
      continue;
    }

    errors.push(
      createIssue({
        code: "tool_call_without_result",
        index: callIndex,
        toolCallId,
        fixable: false,
        message: `Assistant tool call "${toolCallId}" is missing a matching tool result.`,
      }),
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
