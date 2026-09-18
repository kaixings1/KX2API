# E2 · 子代理与协调器 agent

- **目录**：`src/engine/agent`
- **孤儿数**：9
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部归档（9/9）**，分两类：

### 一、7 个「被同名 `.ts` 取代的旧声明」

| 文件 | 同名实现 | 状态 |
| --- | --- | --- |
| `command-runners.d.ts` | `command-runners.ts` | ✅ 活（被 `dispatcher` 等引用） |
| `coordinator/orchestrator.d.ts` | `coordinator/orchestrator.ts` | ✅ 活 |
| `coordinator/planner.d.ts` | `coordinator/planner.ts` | ✅ 活 |
| `coordinator/types.d.ts` | `coordinator/types.ts` | ✅ 活 |
| `dispatcher.d.ts` | `dispatcher.ts` | ✅ 活 |
| `task-decomposer.d.ts` | `task-decomposer.ts` | ✅ 活 |
| `task-executor.d.ts` | `task-executor.ts` | ✅ 活 |

判据同 X2 / E10：**存在同名 `.ts` 实现 + 零引用 → 旧声明，归档**。

### 二、2 个「零引用的功能模块」

| 文件 | 行数 | 内容 | 定性 |
| --- | ---: | --- | --- |
| `subagent/forkMessages.ts` | 105 | `buildForkedMessages` / `buildWorktreeNotice` / `isInForkChild` —— Fork 子代理的消息模板（移植自 `D:\src\tools\AgentTool\forkSubagent.ts`） | 零引用。项目的子代理隔离走的是**另一条路**：`SubAgentManager` 为每个子代理建**独立引擎 + 独立 apiClient**（见 `engine/memory` 的相关记录），不需要 fork 消息模板 |
| `subagent/worktree.ts` | 136 | `createAgentWorktree` / `hasWorktreeChanges` / `removeAgentWorktree` —— git worktree 隔离（移植自 `D:\src`） | 零引用。worktree 是**CLI 版并行 agent** 的隔离手段（多个 agent 各占一个工作树）；Electron 桌面端没有对应场景 |

**额外发现**：整个 `src/engine/agent/subagent/` 目录（6 文件）**零引用** ——
`definitions.ts` / `executor.ts` / `toolFilter.ts` / `types.ts` 也都是孤儿。
但**它们不在本批次清单内**，故本轮不动（避免越界；若需要可另开批次）。
本批只处置清单内的 2 个文件。

## 清单（9）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/agent/command-runners.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/agent/coordinator/orchestrator.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/agent/coordinator/planner.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/agent/coordinator/types.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/agent/dispatcher.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/agent/subagent/forkMessages.ts` | **归档**（零引用，隔离走 SubAgentManager 独立引擎） |
| [x] | `src/engine/agent/subagent/worktree.ts` | **归档**（零引用，worktree 是 CLI 场景） |
| [x] | `src/engine/agent/task-decomposer.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/agent/task-executor.d.ts` | **归档**（旧声明） |

## 验证记录

- `npm run typecheck` → 0 错误（确认旧声明归档不影响类型）
- `npm run test:all` → 全通过
- 无 barrel 断链风险（`agent/` 与 `agent/subagent/` 均无 `index.ts`）
