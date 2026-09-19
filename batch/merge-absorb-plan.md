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

---

## ✅ 项 3（已完成 2026-09-19）· `05-other/X1` — 两套 `security` 合并

- **现状**：`src/security/`（8 文件，活跃，被 `securityEnhancer`/`sandbox` 用）
  **与** `src/main/security/`（8 文件，被 `src/main/index.ts` 用）两套并存、内容不同。
- **实测差异**（逐文件比对）：
  1. 6 个同名文件（AuditLogger/CommandFilter/CredentialManager/InputValidator/PathGuard/OutputSanitizer）
     除分号/注释风格外，逻辑一致；**AuditLogger 与 OutputSanitizer 有实质行为分歧**。
  2. 🔴 `src/security/OutputSanitizer` 对 `api_key/password/secret/token` 用 `$1` 捕获组做替换，
     明文留在输出（`xxx=***REDACTED***`）→ **线上泄密**；`src/main/security` 版正确整体替换。
  3. 🔴 `src/security/AuditLogger` 三个隐藏 bug：`sensitiveKeys` 用驼峰 `'apiKey'`（经
     `toLowerCase().includes()` 恒匹配不上→apiKey 明文落盘）；`query()` 无 try/catch（读不到文件
     抛 ENOENT）；`stop()` 同步不 flush（丢失缓冲）。`src/main/security` 版均已修复。
- **方案执行**：
  1. 保留 `src/security/` 为唯一归属（其 index 为全量 `export *`，含 PermissionManager）。
  2. 修复 `src/security/OutputSanitizer.ts` 3 处 `$1` 泄漏 → 纯 `'***REDACTED***'` 替换。
  3. 修复 `src/security/AuditLogger.ts`：sensitiveKeys 改全小写 `'apikey'`；query 加 try/catch 容错；
     补 `stopFlushTimer()` + `stop()` 改 async 落盘。
  4. `src/main/index.ts` 两行 security import 合并为 `from '../security/index.ts'`。
  5. 删除 `src/main/security/`（git rm），`tests/security/*.test.ts` 4 处 import 改指 `src/security/`。
- **验证**：typecheck 通过；`tests/security` 三文件全过（audit 8/8、credential 9/9、path-guard 38/38，
  含「API key 不泄露明文」断言）；`textRuntimeLimits`(vitest) 8/8；`npm run test:all` 全量见下。
- **风险处置**：改动点均在 active 目录（未被其它会话引用）；删目录经 git rm 保留历史可回滚。

---

## 决策点

- 项 1 / 项 2 可立即执行（低风险）。
- 项 3 **需你明确授权**（涉及安全代码 + 与其他会话的改动交叉）。
