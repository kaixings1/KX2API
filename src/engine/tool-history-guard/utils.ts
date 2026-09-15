import {
  HistoryAdapter,
  Message,
  MessageAnalysis,
  NormalizedToolCall,
  NormalizedToolResult,
  ValidationIssue,
} from "./types";

type UnknownRecord = Record<string, unknown>;

export const defaultHistoryAdapter: HistoryAdapter = {
  getToolCalls(message) {
    const calls: NormalizedToolCall[] = [];

    if (Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        calls.push({
          id: normalizeId(toolCall?.id),
          rawId: toolCall?.id,
        });
      }
    }

    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (isRecord(block) && block.type === "tool_use") {
          calls.push({
            id: normalizeId(block.id),
            rawId: block.id,
          });
        }
      }
    }

    return calls;
  },

  getToolResults(message) {
    const results: NormalizedToolResult[] = [];

    if (message.role === "tool" || "tool_call_id" in message || "tool_use_id" in message) {
      results.push({
        id: normalizeId(message.tool_call_id ?? message.tool_use_id),
        rawId: message.tool_call_id ?? message.tool_use_id,
      });
    }

    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (isRecord(block) && block.type === "tool_result") {
          results.push({
            id: normalizeId(block.tool_use_id),
            rawId: block.tool_use_id,
          });
        }
      }
    }

    return results;
  },
};

export function createIssue(
  issue: Omit<ValidationIssue, "severity"> & { severity?: ValidationIssue["severity"] },
): ValidationIssue {
  return {
    severity: issue.severity ?? "error",
    ...issue,
  };
}

export function analyzeMessages<TMessage extends Message>(
  messages: TMessage[],
  adapter: HistoryAdapter<TMessage>,
): MessageAnalysis[] {
  return messages.map((message) => {
    const callIds = adapter.getToolCalls(message);
    const resultIds = adapter.getToolResults(message);

    return {
      callIds,
      resultIds,
      pureToolCallContainer: isPureToolCallContainer(message, callIds, resultIds),
      pureToolResultContainer: isPureToolResultContainer(message, callIds, resultIds),
    };
  });
}

export function cloneMessages<TMessage>(messages: TMessage[]): TMessage[] {
  if (typeof structuredClone === "function") {
    return structuredClone(messages);
  }

  return JSON.parse(JSON.stringify(messages)) as TMessage[];
}

export function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function stableStringify(value: unknown): string {
  if (typeof value === "undefined") {
    return "undefined";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as UnknownRecord).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  const serialized = entries.map(
    ([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
  );

  return `{${serialized.join(",")}}`;
}

export function getValidIds(
  refs: Array<NormalizedToolCall | NormalizedToolResult>,
): string[] {
  return refs.flatMap((ref) => (ref.id ? [ref.id] : []));
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function isPureToolCallContainer(
  message: Message,
  callIds: NormalizedToolCall[],
  resultIds: NormalizedToolResult[],
): boolean {
  return message.role === "assistant" && callIds.length > 0 && resultIds.length === 0;
}

function isPureToolResultContainer(
  message: Message,
  callIds: NormalizedToolCall[],
  resultIds: NormalizedToolResult[],
): boolean {
  if (callIds.length > 0 || resultIds.length === 0) {
    return false;
  }

  if (message.role === "tool") {
    return true;
  }

  if (!Array.isArray(message.content)) {
    return false;
  }

  return message.content.every((block) => isRecord(block) && block.type === "tool_result");
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
