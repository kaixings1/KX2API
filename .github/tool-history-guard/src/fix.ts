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
  stableStringify,
  uniqueIds,
} from "./utils";
import { validateToolHistory } from "./validate";

export function fixToolHistory<TMessage extends Message>(
  messages: TMessage[],
  options: FixOptions<TMessage> = {},
): FixResult<TMessage> {
  const adapter = (options.adapter ?? defaultHistoryAdapter) as HistoryAdapter<TMessage>;
  const fixedMessages = cloneMessages(messages);
  const warnings: ValidationIssue[] = [];

  const reorderAdjacentToolResults = options.reorderAdjacentToolResults ?? true;
  const dedupeToolResults = options.dedupeToolResults ?? true;
  const removeOrphanToolResults = options.removeOrphanToolResults ?? false;

  let changed = true;
  while (changed) {
    changed = false;

    if (reorderAdjacentToolResults) {
      const analysis = analyzeMessages(fixedMessages, adapter);

      for (let index = 0; index < fixedMessages.length - 1; index += 1) {
        if (!canSwapAdjacentMessages(analysis[index], analysis[index + 1])) {
          continue;
        }

        const current = fixedMessages[index];
        fixedMessages[index] = fixedMessages[index + 1];
        fixedMessages[index + 1] = current;

        warnings.push(
          createIssue({
            code: "applied_reorder_adjacent_tool_result",
            severity: "warning",
            index,
            relatedIndex: index + 1,
            fixable: true,
            message: "Reordered an adjacent tool result so it follows its matching assistant tool call.",
          }),
        );

        changed = true;
        break;
      }

      if (changed) {
        continue;
      }
    }

    if (dedupeToolResults) {
      const analysis = analyzeMessages(fixedMessages, adapter);

      for (let index = 1; index < fixedMessages.length; index += 1) {
        if (!canRemoveDuplicateResultMessage(fixedMessages[index - 1], fixedMessages[index], analysis[index - 1], analysis[index])) {
          continue;
        }

        fixedMessages.splice(index, 1);

        warnings.push(
          createIssue({
            code: "applied_dedupe_tool_result",
            severity: "warning",
            index,
            fixable: true,
            message: "Removed an identical duplicate tool result message.",
          }),
        );

        changed = true;
        break;
      }

      if (changed) {
        continue;
      }
    }

    if (removeOrphanToolResults) {
      const analysis = analyzeMessages(fixedMessages, adapter);
      const allCallIds = new Set(
        analysis.flatMap((entry) => getValidIds(entry.callIds)),
      );

      for (let index = 0; index < fixedMessages.length; index += 1) {
        if (!isSafeOrphanResultMessage(analysis[index], allCallIds)) {
          continue;
        }

        fixedMessages.splice(index, 1);

        warnings.push(
          createIssue({
            code: "applied_remove_orphan_tool_result",
            severity: "warning",
            index,
            fixable: true,
            message: "Removed an orphan tool result message with no matching tool call anywhere in history.",
          }),
        );

        changed = true;
        break;
      }
    }
  }

  const validation = validateToolHistory(fixedMessages, { adapter });

  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: [...warnings, ...validation.warnings],
    fixedMessages,
  };
}

function canSwapAdjacentMessages(
  left: ReturnType<typeof analyzeMessages>[number],
  right: ReturnType<typeof analyzeMessages>[number],
): boolean {
  if (!left.pureToolResultContainer || !right.pureToolCallContainer) {
    return false;
  }

  const resultIds = uniqueIds(getValidIds(left.resultIds));
  const callIds = uniqueIds(getValidIds(right.callIds));

  if (resultIds.length === 0 || resultIds.length !== left.resultIds.length) {
    return false;
  }

  if (callIds.length === 0 || callIds.length !== right.callIds.length) {
    return false;
  }

  if (resultIds.length !== callIds.length) {
    return false;
  }

  return resultIds.every((id) => callIds.includes(id));
}

function canRemoveDuplicateResultMessage<TMessage extends Message>(
  previousMessage: TMessage,
  currentMessage: TMessage,
  previous: ReturnType<typeof analyzeMessages>[number],
  current: ReturnType<typeof analyzeMessages>[number],
): boolean {
  if (!previous.pureToolResultContainer || !current.pureToolResultContainer) {
    return false;
  }

  const previousIds = uniqueIds(getValidIds(previous.resultIds));
  const currentIds = uniqueIds(getValidIds(current.resultIds));

  if (
    previousIds.length === 0 ||
    previousIds.length !== previous.resultIds.length ||
    currentIds.length !== current.resultIds.length ||
    previousIds.length !== currentIds.length
  ) {
    return false;
  }

  const idsMatch = previousIds.every((id) => currentIds.includes(id));
  if (!idsMatch) {
    return false;
  }

  return stableStringify(previousMessage) === stableStringify(currentMessage);
}

function isSafeOrphanResultMessage(
  entry: ReturnType<typeof analyzeMessages>[number],
  allCallIds: Set<string>,
): boolean {
  if (!entry.pureToolResultContainer) {
    return false;
  }

  const resultIds = getValidIds(entry.resultIds);
  if (resultIds.length === 0 || resultIds.length !== entry.resultIds.length) {
    return false;
  }

  return resultIds.every((toolCallId) => !allCallIds.has(toolCallId));
}
