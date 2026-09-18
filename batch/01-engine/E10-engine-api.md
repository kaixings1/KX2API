# E10 · API 客户端 api

- **目录**：`src/engine/api`
- **孤儿数**：1
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

| 文件 | 定性 | 处置 |
| --- | --- | --- |
| `src/engine/api/client.d.ts`（64 行） | **被同名 `client.ts` 取代的旧声明**：`client.ts` 存在且是活的（`src/engine/__tests__/e2e-all-profiles.test.ts` 从 `../api/client.ts` 导入 `sendMessageStream`、`Message`）。该 `.d.ts` 本身零引用 | **归档** |

与 X2 的两个 `.d.ts`（`shared/types.d.ts`、`shared/toolCalling.d.ts`）同一类：
判据是「**存在同名 `.ts` 实现文件** + 零引用」→ 旧声明，归档。

> 注意：本文件**不被 git 跟踪**（`.gitignore` 含 `src/**/*.d.ts`），
> 归档它是磁盘移动，不会产生 git 改动。

## 清单（1）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/api/client.d.ts` | **归档** → `legacy/src/engine/api/client.d.ts` |

## 验证记录

- 归档后 `src/engine/api/` 只剩活源码 `client.ts`
- 已随 E7~E9 一并执行 `typecheck` + `test:all`，全绿
