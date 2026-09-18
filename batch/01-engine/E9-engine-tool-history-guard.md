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
| `fix.ts` | **归档** → `legacy/src/engine/tool-history-guard/fix.ts` | 零引用。`tests/engine/toolHistoryGuard.test.ts` 的注释写明设计意图：「（engine 的 validate 与 main 的）…**不重复接入执行路径**」—— 即**修复路径明确不接入**（顺序修复靠重排消息，会打乱对话时序，风险高于收益，`requestBuilder.ts:128` 有说明）。同时 `src/main/proxy/toolCalling/historyGuard.ts` 另有一份 `fixToolHistory`，属重复 |
| `index.ts` | **保留**（已同步移除 `fixToolHistory` 导出） | barrel 仍导出活的 `validateToolHistory` / `defaultHistoryAdapter` / 类型 |

**连带处置**：`tests/engine/tool-history-guard-fix.test.ts`（测 `fixToolHistory`）
**随 `fix.ts` 一起归档** —— 归档被测模块必须同步处置测试，否则测试会因
"找不到被导入的模块"而整个文件失败（本轮实测确认过这个失败）。

## 清单（2）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/tool-history-guard/fix.ts` | **归档** → `legacy/src/engine/tool-history-guard/` |
| [x] | `src/engine/tool-history-guard/index.ts` | **保留**（barrel，已移除 fix 导出） |

**连带归档**：`tests/engine/tool-history-guard-fix.test.ts` → `legacy/tests/engine/`

## 验证记录

- `npm run typecheck` → 0 错误（确认 barrel 移除导出后无断链）
- `npm run test:all` → extras **837 通过 / 0 失败**（较 841 少 4，正是随 `fix.ts`
  归档的 `tool-history-guard-fix.test.ts` 的用例数）；unit **1148 通过**
- 归档后 `src/engine/tool-history-guard/` 只剩：`index.ts`、`types.ts`、`utils.ts`、`validate.ts`
