# E3 · 流程引擎 flow

- **目录**：`src/engine/flow`
- **孤儿数**：4
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部归档（4/4）** —— 整个目录零外部引用，且是项目里**第三套**计划/DAG 实现。

| 文件 | 行数 | 导出 |
| --- | ---: | --- |
| `base.ts` | 82 | `FlowAgent` / `FlowContext` / `FlowResult` |
| `factory.ts` | 36 | `FlowType` / `FlowFactoryOptions` / `FlowFactory` |
| `index.ts` | 8 | barrel |
| `planning.ts` | 280 | `PlanningFlow` / `DAGDecomposer` / `PlanStep` / `getAllPlans` 等 |

**重复性核实**（`git grep` 确认）：

| 符号 | flow 内 | 项目其它实现（活的） |
| --- | --- | --- |
| `PlanStep` / `getAllPlans` | `flow/planning.ts` | `src/main/plans/plansService.ts`（被 `planScheduler` 用、接 UI 的 `PlanDetailPage`） |
| DAG / 任务图能力 | `flow/planning.ts` 的 `DAGDecomposer` | `src/engine/orchestrator/taskGraph.ts`（活） |
| 计划生成 | `flow/planning.ts` | `src/engine/agent/coordinator/planner.ts`（活） |

即：**计划管理**已有 `main/plans/`（接 UI）、**DAG 调度**已有 `orchestrator/taskGraph.ts`、
**计划生成**已有 `agent/coordinator/planner.ts` —— `engine/flow/` 是第四套、且零引用。

## 清单（4）

| 完成 | 路径 | 处置 | D:\src 来源 |
| :---: | --- | --- | --- |
| [x] | `src/engine/flow/base.ts` | **归档** → `legacy/src/engine/flow/` | `D:\src\engine\flow\base.ts`（high） |
| [x] | `src/engine/flow/factory.ts` | **归档** | `D:\src\engine\flow\factory.ts`（high） |
| [x] | `src/engine/flow/index.ts` | **归档** | `D:\src\engine\flow\index.ts`（high） |
| [x] | `src/engine/flow/planning.ts` | **归档** | `D:\src\engine\flow\planning.ts`（high） |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all` → 全通过
- 顺带删除归档后变空的 `src/engine/flow/` 目录
