import test from "node:test";
import assert from "node:assert/strict";

import { fixToolHistory } from "../../src/engine/tool-history-guard/index.ts";
import type { Message } from "../../src/engine/tool-history-guard/index.ts";

/**
 * fixToolHistory —— 工具历史的修复器。
 *
 * 与 validateToolHistory（只报告不改）互补：上游对 tool_calls 与 tool 结果
 * 要求严格配对且顺序一致，违反时直接 400「tool calls and tool results do not
 * match」。本组用例锁定三类修复各自的行为。
 */

test("fixToolHistory reorders an adjacent misplaced tool result", () => {
  // 结果出现在调用之后、但中间夹了别的消息 → 属于「顺序错位」，应被挪回紧邻位置。
  // （若结果出现在调用**之前**，那是时序语义问题，见本文件最后一组用例。）
  const messages: Message[] = [
    {
      role: "assistant",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "search" } }],
    },
    { role: "user", content: "继续" },
    { role: "tool", tool_call_id: "call_1", content: '{"ok":true}' },
  ];

  const result = fixToolHistory(messages);

  assert.equal(result.valid, true);
  const assistantIdx = result.fixedMessages.findIndex((m) => m.role === "assistant");
  assert.ok(assistantIdx >= 0, "assistant 消息应保留");
  assert.equal(result.fixedMessages[assistantIdx + 1]?.role, "tool", "结果应紧邻其调用");
  assert.ok(
    result.warnings.some((issue) => issue.code === "applied_reorder_adjacent_tool_result"),
    "应记录重排警告",
  );
});

test("fixToolHistory removes orphan tool results", () => {
  const messages: Message[] = [
    { role: "user", content: "Ping" },
    { role: "tool", tool_call_id: "call_missing", content: "pong" },
  ];

  const result = fixToolHistory(messages);

  assert.equal(result.fixedMessages.length, 1, "孤立结果应被移除");
  assert.equal(result.fixedMessages[0]?.role, "user");
  assert.ok(
    result.warnings.some((issue) => issue.code === "applied_remove_orphan_tool_result"),
    "应记录移除警告",
  );
});

test("fixToolHistory dedupes repeated tool results", () => {
  const messages: Message[] = [
    {
      role: "assistant",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "search" } }],
    },
    { role: "tool", tool_call_id: "call_1", content: "first" },
    { role: "tool", tool_call_id: "call_1", content: "second" },
  ];

  const result = fixToolHistory(messages);

  const toolMsgs = result.fixedMessages.filter((m) => m.role === "tool");
  assert.equal(toolMsgs.length, 1, "重复结果应只保留一条");
  assert.equal(toolMsgs[0]?.content, "first", "应保留第一条");
  assert.ok(
    result.warnings.some((issue) => issue.code === "applied_dedupe_tool_result"),
    "应记录去重警告",
  );
});

test("fixToolHistory keeps already-valid history untouched", () => {
  const messages: Message[] = [
    { role: "user", content: "现在几点？" },
    {
      role: "assistant",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "clock" } }],
    },
    { role: "tool", tool_call_id: "call_1", content: '{"time":"12:00"}' },
    { role: "assistant", content: "12:00。" },
  ];

  const result = fixToolHistory(messages);

  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 0, "合法历史不应产生任何修复动作");
  assert.deepEqual(
    result.fixedMessages,
    messages,
    "合法历史应保持原样（顺序与条数都不变）",
  );
});

test("fixToolHistory 不搬动「结果先于调用」的消息", () => {
  // 结果出现在调用之前 → 属于时序语义问题，重排会改动对话含义，
  // 修复器刻意不擅自搬动（交由上游/人工），但应通过 errors 暴露出来。
  const messages: Message[] = [
    { role: "user", content: "hi" },
    { role: "tool", tool_call_id: "call_1", content: "early" },
    {
      role: "assistant",
      tool_calls: [{ id: "call_1", type: "function", function: { name: "clock" } }],
    },
  ];

  const result = fixToolHistory(messages, { removeOrphanToolResults: false });

  // 该结果被识别为「先于调用」，修复器只报告不搬动
  assert.ok(
    result.errors.some((issue) => issue.code === "tool_result_before_call"),
    "应报出「结果先于调用」",
  );
  assert.ok(
    result.fixedMessages.some((m) => m.role === "tool"),
    "不应删除该结果（调用确实存在）",
  );
});

test("fixToolHistory 可用开关关闭单项修复", () => {
  const messages: Message[] = [
    { role: "user", content: "Ping" },
    { role: "tool", tool_call_id: "call_missing", content: "pong" },
  ];

  const result = fixToolHistory(messages, { removeOrphanToolResults: false });

  assert.equal(result.fixedMessages.length, 2, "关闭开关后不应移除孤立结果");
});
