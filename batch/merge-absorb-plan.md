# 合并吸收计划（batch 中标注「待接线/待吸收」的项）

> 从后往前核查 54 个批次文件后，标注「待接线 / 待吸收」的有 3 处。
> 逐项给出合并吸收方案；执行顺序按**风险从低到高**排列。
> 每项执行后必须跑 `typecheck && test:all` 验证（同孤儿清理的纪律）。

---

## ✅ 项 1（已完成 2026-09-19）· `01-engine/E7` — `builtInHooks` 接线

- **现状**：`src/engine/hooks/builtInHooks.ts` 有 5 个内置安全/审计钩子工厂
  （`createSecretDetectionHook` / `createFileTypeWarningHook` / `createToolAuditLogHook` /
  `createSessionStartHook` / `createFailureTrackerHook`），**零引用、待接线**。
- **接线点**：`src/main/engine-bridge.ts:262` 的 `wireToolHooks(engine)` 已存在且被初始化调用（第 1007 行）。
- **方案**：在 `wireToolHooks` 内部，把 `builtInHooks` 的工厂 `register` 进 `engine` 的钩子机制
  （`HookManager.register({ eventType, handler })`，见 `hookManager.ts:15`）。
- **风险**：低 —— 只增不改；`src/__tests__/main/hooks.test.ts` 覆盖 `runHooks`，可加断言验证内置钩子生效。
- **验证**：`npm run typecheck` + `npm run test:all`（重点看 hooks.test.ts）+ `npm run test:unit`。

---

## ✅ 项 2（已完成 2026-09-19）· `01-engine/E12` — `absorb.ts` 接线

- **现状**：`src/engine/absorb.ts`（635 行，吸收式文本压缩，4 个上游 bug 已修）是**唯一实现**，
  34 个用例的测试（`src/__tests__/engine/absorb.test.ts`）原本持续通过。**此前零引用**。
- **接线点**：`src/engine/messageLoop.ts` 的压缩流程 —— `runIteration` 的 `AutoCompactor` 摘要之前。
- **实现**（`messageLoop.ts`）：
  1. 新增私有方法 `absorbStaleContent(messages)`：对**最旧 messages.length-10 条**、内容为纯字符串、
     且长度 ≥ 200 字符的消息，逐条调用 `absorb()`；`ratio ≥ 0.05` 才采用（否则格式稳定性优先）。
     绝对**不增删消息、不改变顺序/role/toolUseId** —— 只原地替换 content 字符串，因此
     `tool_use / tool_result` 配对天然不受影响（那是靠消息粒度与 `ensureToolResultPairing` 保证的）。
2. 在 `runIteration` 的 `budget.shouldCompact` 分支内、`coordinator.runCompact` **之前**调用：
   若吸收省下了可观的字符，重新计量 budget —— 若已回到阈值之下则跳过昂贵的 LLM 摘要。
     3. 关键顺序注释：吸收必须发生在 runCompact 之前，否则摘要已把原文重写，重复内容无从吸收。
- **风险处置**：改动仅在该分支内新增逻辑 + 一处私有方法，不触碰并发会话改动范围；
  对外行为在「无重复冗余」时逐字节不变（absorb 无重复即原样返回）。
- **验证**：`npm run typecheck` 通过；`npx vitest run src/__tests__/engine/absorb.test.ts` 34/34 通过；
  `npm run test:unit` 全量通过（见下）。

---

## 项 3（风险高，需你决策）· `05-other/X1` — 两套 `security` 合并吸收

- **现状**：`src/security/`（9 文件，活跃，被 `securityEnhancer`/`sandbox` 用）
  **与** `src/main/security/`（7 文件，被 `src/main/index.ts` 用）**两套并存、内容不同**。
  `src/main/index.ts:29-30` **同时混用两套**（29 行指向 `./security`，30 行指向 `../security`）。
- **实测差异**：
  1. 导出签名完全一致；`src/security/` 每个文件更大（多 13~51 行）。
  2. 🔴 **行为漏洞**：`src/security/OutputSanitizer` 对 `api_key = xxx` 的输出是
     `"xxx=***REDACTED***"`——**密钥本体留在了输出里**；`src/main/security/` 版正确输出 `"***REDACTED***"`。
     而 `src/security/` 正是工具输出净化的活跃版本 → **当前线上泄密**。
  3. `src/main/security/` 独有 `PermissionManager.ts`（`src/security/` 没有）。
- **方案**：把 `src/main/security/` 的修复版逐文件吸收进 `src/security/`，删除 `src/main/security/` 目录，
  `src/main/index.ts` 引用统一改指向 `src/security/`。需逐文件比对行为 + 跑 `tests/security/*`。
- **风险**：高 —— 改动 `src/main/index.ts`（并发会话也在附近活动）且涉及安全代码；
  必须先修掉 `OutputSanitizer` 的泄密缺陷再合并。
- **状态**：✅ 项 1 已完成（2026-09-19）；项 3 待你授权。

---

## 决策点

- 项 1 / 项 2 可立即执行（低风险）。
- 项 3 **需你明确授权**（涉及安全代码 + 与其他会话的改动交叉）。
