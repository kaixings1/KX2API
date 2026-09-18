# E7 · 钩子 hooks（engine 侧）

- **目录**：`src/engine/hooks`
- **孤儿数**：2
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 关键辨析：该目录**不能整体处理**

`src/engine/hooks/` 有 3 个文件，其中 **`hookManager.ts` 是活的**：

```
src/engine/index.ts:26    import { HookManager } from "./hooks/hookManager.ts"
src/engine/toolScheduler.ts:11  import type { HookManager } from "./hooks/hookManager.ts"
```

所以本批只涉及清单里的 2 个文件（`builtInHooks.ts`、`index.ts`）。

## 处置结论

**全部保留（0 个归档）** —— 理由如下：

| 文件 | 引用情况 | 定性 | 处置 |
| --- | --- | --- | --- |
| `hooks/builtInHooks.ts`（5 个内置钩子工厂） | 只被同目录 `index.ts` 引用 | 提供 `createSecretDetectionHook`（密钥检测）/`createFileTypeWarningHook`（文件类型告警）/`createToolAuditLogHook`（工具审计）/`createSessionStartHook`/`createFailureTrackerHook` —— **安全与审计能力，且是唯一实现** | **保留** |
| `hooks/index.ts`（barrel） | 零外部引用 | 该目录的导出入口；导出 `HookManager`（活）与上述 5 个工厂 | **保留** |

**为什么与 X1 的 `SandboxExecutor` 处置不同**（那个归档了）：
- `SandboxExecutor` 与 `src/engine/sandbox/index.ts` **功能重复**，留着会让人用错 → 归档
- `builtInHooks` 与 `src/main/hooks/` **不重复**：后者是**用户自定义钩子的执行框架**
  （`hookConfig` 读配置 + `hookRunner` 跑命令），前者是**内置的安全/审计处理器**。
  删掉它等于把"密钥检测、工具审计"这些能力从代码库移除 —— 不该为清理数字好看而做。

**现状记录**：`HookManager` 是活的基础设施（`engine.setHookManager()` 可注入，
由 `main/engine-bridge` 注入用户钩子），但这 5 个内置工厂**当前无人注册**，
属「有能力、待接线」。若将来要启用，直接从 `src/engine/hooks/` 引入即可。

## 清单（2）

| 完成 | 路径 | 处置 | D:\src 来源 |
| :---: | --- | --- | --- |
| [x] | `src/engine/hooks/builtInHooks.ts` | **保留**（安全能力，唯一实现，待接线） | `D:\src\engine\hooks\builtInHooks.ts`（high） |
| [x] | `src/engine/hooks/index.ts` | **保留**（barrel，导出活的 HookManager） | `D:\src\commands\hooks\index.ts`（medium） |

## 验证记录

- 本批**未改动任何文件**，无回归风险
- 同目录的 `hookManager.ts` 是活文件，已确认被 `engine/index.ts`、`engine/toolScheduler.ts` 引用
