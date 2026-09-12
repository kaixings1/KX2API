import test from "node:test";
import assert from "node:assert/strict";

import { fixToolHistory } from "../src";
import type { Message } from "../src";

test("fixToolHistory reorders an adjacent misplaced tool result", () => {
  const messages: Message[] = [
    { role: "tool", tool_call_id: "call_1", content: "{\"ok\":true}" },
    {
      role: "assistant",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "search" } }],
    },
  ];

  const result = fixToolHistory(messages);

  assert.equal(result.valid, true);
  assert.equal(result.fixedMessages[0]?.role, "assistant");
  assert.equal(result.fixedMessages[1]?.role, "tool");
  assert.ok(
    result.warnings.some((issue) => issue.code === "applied_reorder_adjacent_tool_result"),
  );
});

test("fixToolHistory removes an orphan tool result when enabled", () => {
  const messages: Message[] = [
    { role: "user", content: "Hello" },
    { role: "tool", tool_call_id: "call_orphan", content: "orphan" },
  ];

  const result = fixToolHistory(messages, { removeOrphanToolResults: true });

  assert.equal(result.valid, true);
  assert.equal(result.fixedMessages.length, 1);
  assert.ok(
    result.warnings.some((issue) => issue.code === "applied_remove_orphan_tool_result"),
  );
});

test("fixToolHistory dedupes identical adjacent tool results", () => {
  const messages: Message[] = [
    {
      role: "assistant",
      tool_calls: [{ id: "call_2", type: "function", function: { name: "search" } }],
    },
    { role: "tool", tool_call_id: "call_2", content: "{\"ok\":true}" },
    { role: "tool", tool_call_id: "call_2", content: "{\"ok\":true}" },
  ];

  const result = fixToolHistory(messages);

  assert.equal(result.valid, true);
  assert.equal(result.fixedMessages.length, 2);
  assert.ok(result.warnings.some((issue) => issue.code === "applied_dedupe_tool_result"));
});

test("fixToolHistory leaves unsafe missing-result cases invalid", () => {
  const messages: Message[] = [
    {
      role: "assistant",
      tool_calls: [{ id: "call_3", type: "function", function: { name: "search" } }],
    },
    { role: "assistant", content: "No tool result was added." },
  ];

  const result = fixToolHistory(messages);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "tool_call_without_result"));
});
