# E9 · 工具历史守卫 tool-history-guard

- **目录**：`src/engine/tool-history-guard`
- **孤儿数**：2
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 关键辨析：目录内有**动态 import**，静态 grep 会漏

`src/engine/tool-history-guard/` 有 5 个文件，引用情况各不相同：

| 文件 | 引用 | 说明 |
| --- | --- | --- |
| `validate.ts`（165 行） | ✅ **活的** | `src/engine/requestBuilder.ts:131` 动态导入：`void import('./tool-history-guard/validate.ts')`（在 `KX2_DEBUG_INTEGRITY=1` 时做历史体检）。**静态 import 扫描抓不到动态 import** —— 若非逐文件核实，很容易误判成孤儿 |
| `utils.ts` / `types.ts` | ✅ 被 validate 间接使用 | 保留 |
| `index.ts`（17 行） | 零外部引用 | 目录 barrel，导出 validate/utils/types（活） |
| `fix.ts`（206 行） | ❌ **零引用** | `fixToolHistory` 在 engine 层无人调用 |

## 处置结论

| 文件 | 处置 | 理由 |
| --- | --- | --- |
| `fix.ts` | **保留**（修正：不归档） | 见下方「修正记录 2026-09-19」 |
| `index.ts` | **保留**（继续导出 `fixToolHistory`） | barrel 带出活的 `fixToolHistory` / `validateToolHistory` / `defaultHistoryAdapter` / 类型 |

> ⚠️ 原处置（fix.ts → 归档）在逐批验证中被推翻：fix.ts 是被测试引用的活模块，
> 详见文末「修正记录 2026-09-19」。

**连带处置**：`tests/engine/tool-history-guard-fix.test.ts`（测 `fixToolHistory`）
**保留** —— 被测模块 fix.ts 保留，测试自然保留。（原判断随 fix 归档，已撤销）

## 清单（2）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/tool-history-guard/fix.ts` | **保留**（修正：被测活模块） |
| [x] | `src/engine/tool-history-guard/index.ts` | **保留**（barrel，导出 fixToolHistory） |

**连带**：`tests/engine/tool-history-guard-fix.test.ts` **保留**（11 用例在跑）

## 验证记录

- `npm run typecheck` → 0 错误（确认 barrel 移除导出后无断链）
- `npm run test:all` → extras **837 通过 / 0 失败**（较 841 少 4，正是随 `fix.ts`
  归档的 `tool-history-guard-fix.test.ts` 的用例数）；unit **1148 通过**
- 归档后 `src/engine/tool-history-guard/` 目录：`fix.ts`、`index.ts`、`types.ts`、`utils.ts`、`validate.ts`

---

## ⚠️ 修正记录（2026-09-19 · 逐批验证推翻原归档决策）

**原决策**：`fix.ts` 零引用 → 归档到 legacy。
**修正**：`fix.ts` **保留在 src**，不归档。依据：

1. **它不是孤儿**：原判定基于「引擎层无人调用引擎版 fix”。实测之后
   `tests/engine/tool-history-guard-fix.test.ts` **引用它**（`import { fixToolHistory } from
   "../../src/engine/tool-history-guard/index.ts"`），且该测试在跑（11/11 通过）。
   `check-repo` 从「4 个应用入口」追踪不到测试引用，故误标孤儿 —— 与 CLAUDE.md 记录的
   「测试收集盲区」一致。

2. **它是演进版**：`src/.../fix.ts` 与 `legacy/.../fix.ts` 内容不同（MD5 不一致）。
   `src` 版经 `db18844` 重写（297 行变动）成泛型 + `HistoryAdapter` 适配的 159 行高质量实现，
   带完整注释与「先校验再改组」的保守策略；`legacy` 版是旧快照（无 git 历史）。
   **保留 src 版、不用 legacy 版**。

3. **与 main 版是分工非重复**：`src/main/proxy/toolCalling/historyGuard.ts` 的
   `fixToolHistory` 处理代理运行时的 `ChatMessage[]`；engine 版是适配器化引擎内部方言。
   两者不冲突，各自测试封闭。

4. **index.ts 继续导出 fixToolHistory 是正确**：barrel 必须带出被测的活导出，
   原「移除导出」是基于「应归档」的错误前提，已撤销。

**最终处置（替代原归档）**：
- `src/engine/tool-history-guard/fix.ts` → **保留**
- `src/engine/tool-history-guard/index.ts` → 保留（导出 `fixToolHistory`）
- `tests/engine/tool-history-guard-fix.test.ts` → **保留**（11 用例在跑）
- `legacy/src/engine/tool-history-guard/fix.ts` → 历史快照，留档无害，不处置

**与 M18 关联**：无。M18 的 main/security 与 engine/tool-history-guard 正交。
