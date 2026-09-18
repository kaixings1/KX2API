import test from "node:test";
import assert from "node:assert/strict";

import { resolveToolName } from "../../src/engine/toolNameResolver.ts";
import { getToolConcept, getToolNameVariants } from "../../src/engine/toolNameCompat.ts";
import { commandRunners } from "../../src/engine/agent/command-runners.ts";

/**
 * 工具名归一化的「两张表不一致」回归用例。
 *
 * 背景（真实事故）：
 *   messageLoop 判定工具是否可用时，用 `toolDefinitions`（engine-bridge 由
 *   commandRunners 构造，61 个命令）作为可用集合；而 `resolveToolName` 查的是
 *   命令注册表（registry，264 个，含 shell/cmd/grep/findstr/dir 等别名命令）。
 *
 *   两者不一致 → 模型发 `shell` 时：
 *     resolveToolName('shell') 命中返回 'shell'，
 *     但 'shell' 不在可用集合里 → 判 invalid → 整轮工具被跳过。
 *   日志表现为：[ENGINE:WARN] 1 invalid tool call(s) skipped. Valid: 0
 *
 * 修复：在「同名找不到」时按工具概念兜底（shell/cmd/powershell → bash）。
 * 本组用例锁定该兜底行为，防止回归。
 */

/** 与 messageLoop 的 pickExecutableByConcept 保持一致的口径 */
function pickExecutableByConcept(requested: string, available: Set<string>): string | null {
  if (!requested) return null;
  for (const variant of getToolNameVariants(requested)) {
    if (available.has(variant)) return variant;
  }
  const concept = getToolConcept(requested);
  const PREFERRED: Record<string, string[]> = {
    shell: ["bash", "exec", "sh"],
    list: ["ls", "dir", "tree"],
    read: ["cat", "head", "tail"],
    search: ["find", "findstr", "grep"],
    write: ["cp", "mkdir", "mv"],
    code: ["exec", "bash"],
    web: ["search"],
  };
  for (const candidate of PREFERRED[concept] ?? []) {
    if (available.has(candidate)) return candidate;
  }
  return null;
}

const availableTools = new Set([...commandRunners.keys()]);

async function resolveLikeMessageLoop(name: string): Promise<string | null> {
  if (availableTools.has(name)) return name;
  let resolved: string | null = null;
  try {
    resolved = await resolveToolName(name);
  } catch {
    resolved = null;
  }
  if (resolved && availableTools.has(resolved)) return resolved;
  return pickExecutableByConcept(name, availableTools);
}

test("两张工具表确实不一致（这是本组用例的前提）", async () => {
  // resolveToolName 能识别 shell（registry 里有），但它不在可执行命令里
  const resolved = await resolveToolName("shell");
  assert.equal(resolved, "shell", "resolveToolName 应能命中 registry 里的 shell");
  assert.equal(
    availableTools.has("shell"),
    false,
    "shell 不应出现在 commandRunners（可执行命令）里 —— 这正是事故前提",
  );
});

test("模型发 shell / cmd / powershell 时，应兜底到可执行的 bash", async () => {
  for (const name of ["shell", "cmd", "powershell", "sh"]) {
    const r = await resolveLikeMessageLoop(name);
    assert.equal(r, "bash", `${name} 应兜底到 bash，实际 ${r}`);
  }
});

test("模型发 dir / grep 时应兜底到实际存在的 ls / find", async () => {
  assert.equal(await resolveLikeMessageLoop("dir"), "ls");
  assert.equal(await resolveLikeMessageLoop("grep"), "find");
  assert.equal(await resolveLikeMessageLoop("findstr"), "find");
});

test("原本就有效的名字不应被改动", async () => {
  for (const name of ["bash", "ls", "find", "cat"]) {
    const r = await resolveLikeMessageLoop(name);
    assert.equal(r, name, `${name} 应原样保留`);
  }
});

test("完全无法识别的名字仍判为无效（不凭空造命令）", async () => {
  for (const name of ["__no_such_tool__", "definitely_not_a_tool", "xyzzy"]) {
    const r = await resolveLikeMessageLoop(name);
    assert.equal(r, null, `${name} 应判无效，实际 ${r}`);
  }
});
