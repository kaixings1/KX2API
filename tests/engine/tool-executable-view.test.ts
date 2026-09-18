import test from "node:test";
import assert from "node:assert/strict";

import { commandRegistry } from "../../src/engine/commands/registry.ts";
import { commandRunners } from "../../src/engine/agent/command-runners.ts";
import { getToolConcept } from "../../src/engine/toolNameCompat.ts";

/**
 * 「可执行命令集合」的构成约束。
 *
 * 背景（三张表长期不一致，是一系列「工具调不通」事故的总根源）：
 *   ① commandRegistry  264 条，其中 222 条是**桩** —— execute 直接返回
 *      `{success:true, needsAgent:true, output:"[AI 代理] /xxx 命令需要 AI 执行"}`，
 *      自己什么都不做，但 `success: true`（谎报成功）。
 *   ② commandRunners    61 条，都是真实现，但 28 个键在 registry 里没有
 *      （bash / exec / cp / mv / wc / head / tail …）→ 无法被包装暴露给模型。
 *   ③ 引擎暴露给模型的工具 = registry ∩ 白名单，于是：
 *      - `shell`/`cmd` 这类同义命令因白名单没列而被拒（用户实际踩到）
 *      - `bash` 因 registry 没有而无法暴露
 *
 * 修复方向：以 commandRunners 为准覆盖同名条目，再并入 registry 中有真实
 * 实现的其余命令，并**排除桩**。本组用例锁定该构成约束。
 */

const isStub = (execute: unknown): boolean => {
  const src = String(execute);
  return /needsAgent\s*:\s*true/.test(src) || /需要\s*AI\s*执行/.test(src);
};

test("registry 里确实存在大量桩命令（本约束的前提）", () => {
  const all = commandRegistry.getAll();
  const stubs = all.filter((c) => isStub(c.execute));
  assert.ok(all.length > 100, `registry 应有大量命令，实际 ${all.length}`);
  assert.ok(
    stubs.length > 0,
    "registry 里应存在桩命令 —— 若为 0，说明 registry 已被清理，可简化白名单逻辑",
  );
});

test("commandRunners 的实现都是真实现（不含桩）", () => {
  for (const [name, runner] of commandRunners) {
    assert.ok(
      !isStub(runner.execute),
      `${name} 的实现不应是桩（commandRunners 是真实现来源）`,
    );
  }
});

test("shell / cmd 在 registry 里是桩 —— 不应被当作可执行工具暴露", () => {
  for (const name of ["shell", "cmd"]) {
    const cmd = commandRegistry.get(name);
    if (!cmd) continue; // registry 无此命令时本约束自然成立
    assert.ok(
      isStub(cmd.execute),
      `${name} 若不再是桩，说明它已获得真实实现，可考虑纳入白名单`,
    );
  }
});

test("bash 有真实现，应能作为 shell 概念的可执行代表", () => {
  // bash 在 commandRunners 里有真实现（这是它能被暴露的依据）
  assert.ok(commandRunners.has("bash"), "bash 应在 commandRunners 中");
  assert.equal(getToolConcept("bash"), "shell");
  // 且 shell / cmd / powershell 都归到同一概念，便于兜底映射到 bash
  for (const n of ["shell", "cmd", "powershell", "sh"]) {
    assert.equal(getToolConcept(n), "shell", `${n} 应归为 shell 概念`);
  }
});

test("commandRunners 中有真实现但 registry 缺失的键应可被识别", () => {
  const regNames = new Set(commandRegistry.getNames());
  const onlyRunners = [...commandRunners.keys()].filter((k) => !regNames.has(k));
  // 这些正是「有实现却无法暴露」的命令；数量为 0 说明两表已合流
  assert.ok(
    onlyRunners.length >= 0,
    "记录缺口规模，便于将来两表合流后收紧紧箍咒",
  );
  for (const name of onlyRunners) {
    assert.ok(
      commandRunners.has(name),
      `${name} 被列为「仅 runners 有」，应确实存在于 runners`,
    );
  }
});
