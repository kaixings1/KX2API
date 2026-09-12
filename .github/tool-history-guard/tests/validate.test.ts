import test from "node:test";
import assert from "node:assert/strict";

import { validateToolHistory } from "../src";
import type { Message } from "../src";

test("validateToolHistory accepts a valid tool call/result sequence", () => {
  const messages: Message[] = [
    { role: "user", content: "What time is it?" },
    {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "clock" } }],
    },
    {
      role: "tool",
      tool_call_id: "call_1",
      content: "{\"timezone\":\"UTC\",\"time\":\"12:00\"}",
    },
    { role: "assistant", content: "It is 12:00 UTC." },
  ];

  const result = validateToolHistory(messages);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateToolHistory flags orphan tool results", () => {
  const messages: Message[] = [
    { role: "user", content: "Ping" },
    { role: "tool", tool_call_id: "call_missing", content: "pong" },
  ];

  const result = validateToolHistory(messages);

  assert.equal(result.valid, false);
  assert.equal(result.errors[0]?.code, "tool_result_without_call");
});

test("validateToolHistory flags missing tool results", () => {
  const messages: Message[] = [
    { role: "user", content: "Search docs" },
    {
      role: "assistant",
      tool_calls: [{ id: "call_2", type: "function", function: { name: "search" } }],
    },
    { role: "assistant", content: "Trying again..." },
  ];

  const result = validateToolHistory(messages);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "tool_call_without_result"));
  assert.ok(result.errors.some((issue) => issue.code === "tool_result_ordering"));
});

test("validateToolHistory flags duplicate tool results", () => {
  const messages: Message[] = [
    {
      role: "assistant",
      tool_calls: [{ id: "call_3", type: "function", function: { name: "search" } }],
    },
    { role: "tool", tool_call_id: "call_3", content: "{\"ok\":true}" },
    { role: "tool", tool_call_id: "call_3", content: "{\"ok\":true}" },
  ];

  const result = validateToolHistory(messages);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "duplicate_tool_result"));
});

test("validateToolHistory supports Anthropic-style tool blocks", () => {
  const messages: Message[] = [
    {
      role: "assistant",
      content: [{ type: "tool_use", id: "toolu_1", name: "lookup", input: { q: "weather" } }],
    },
    {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "sunny" }],
    },
  ];

  const result = validateToolHistory(messages);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});
