# E12 · 引擎根目录散落文件

- **目录**：`src/engine`（根目录散落）
- **孤儿数**：20
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 判定方法：可达性 + 精确路径引用

本批 20 个文件混杂多种性质，用两步核实：
① **可达性分析**（复刻 `check-repo` 算法，从 4 个真实入口 + 测试入口追踪）；
② **精确路径 grep**（`git grep "engine/xxx"`，不用裸符号名 —— 本项目同名符号极多）。

## 处置结论

| 文件 | 规模 | 判定 | 处置 |
| --- | ---: | --- | --- |
| `codeExplainer.ts` | 336 行 | 零引用 | **归档** |
| `codeVectorStore.ts` | 481 行 | 仅被 `codeExplainer` 引用（**闭环内**） | **归档** |
| `knowledgeGraph.ts` | 495 行 | 仅被 `codeExplainer` 引用 | **归档** |
| `semanticSearch.ts` | 652 行 | 仅被 `codeExplainer` 引用 | **归档** |
| `ecoFilter.ts` | 266 行 | 零引用 | **归档** |
| `memoryStore.ts` | 257 行 | 零引用 | **归档** |
| `progress-engine/index.ts` | 392 行 | 零引用（可达性 0） | **归档** |
| `toolGroups.ts` | 164 行 | 零引用 | **归档** |
| `tasks/shellTaskTypes.ts` | 24 行 | 零引用 | **归档** |
| `types.ts` | 8 行 | 重导出 `./toolScheduler.ts` 的 `Tool`，**零引用** | **归档** |
| `cost/costHook.ts` | 90 行 | 零引用（engine 层唯一的 React 依赖） | **归档** |
| `cli.ts` | 107 行 | 独立 CLI 入口（`node src/engine/cli.ts`），零引用 | **归档** |
| `cli.d.ts` / `core.d.ts` / `utils/exec.d.ts` | — | 均存在同名 `.ts` 实现 → 旧声明 | **归档** |
| `streaming/streamProcessor.js.map` | 3 KB | 构建残留 | **归档** |
| `absorb.ts` | **635 行** | **仅被自己的测试引用**，但**保留** | **保留** |
| `orchestrator/index.ts` | 31 行 | barrel，自身零引用，但**同目录其它文件是活的** | **保留** |
| `token-counter/__tests__/index.test.ts` | 232 行 | **活跃测试**（vitest 在跑） | **保留** |
| `index.d.ts` | — | **磁盘上不存在** | 跳过 |

### 为什么 `absorb.ts` 保留（与 E6 的 llm-tool-parser 判据不同）

`absorb.ts` 是**吸收式文本压缩**，项目里**唯一实现**，且已有 34 个用例的测试覆盖
（`src/__tests__/engine/absorb.test.ts`，含移植时修掉的 4 个上游 bug 的回归用例）。
它属于「**移植完成、待接线**」—— 与 E6 那个「**已有更安全替代品 + 重复实现**」不同。
删掉它 = 丢掉一套已验证的压缩能力。

> ⚠️ **易误判点**：`messageLoop.ts` 里有 `absorbCompactSummary` 方法，名字带 `absorb`，
> 但它**不是** import `absorb.ts` 模块（已核对 `messageLoop.ts` 的完整 import 列表）。
> `git grep "absorb"` 会把两者混在一起 —— 必须按**导入路径**而非名字判断。

### `orchestrator/index.ts` 为什么保留

该目录**部分活跃**：`teamRunner.ts` 与 `messages.ts` 被 `src/engine/index.ts`、
`src/engine/unifiedScheduler.ts` 引用（活路径）。`index.ts` 是这些活文件的 barrel 入口 ——
虽然当前无人从 barrel 导入（引用者都直指具体文件），但保留 barrel 是正确的目录组织方式。

## 清单（20）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/absorb.ts` | **保留**（唯一实现，待接线，已有 34 用例覆盖） |
| [x] | `src/engine/cli.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/cli.ts` | **归档**（独立 CLI 入口，零引用） |
| [x] | `src/engine/codeExplainer.ts` | **归档** |
| [x] | `src/engine/codeVectorStore.ts` | **归档** |
| [x] | `src/engine/core.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/cost/costHook.ts` | **归档** |
| [x] | `src/engine/ecoFilter.ts` | **归档** |
| [x] | `src/engine/index.d.ts` | 跳过（不存在） |
| [x] | `src/engine/knowledgeGraph.ts` | **归档** |
| [x] | `src/engine/memoryStore.ts` | **归档** |
| [x] | `src/engine/orchestrator/index.ts` | **保留**（活跃目录的 barrel） |
| [x] | `src/engine/progress-engine/index.ts` | **归档** |
| [x] | `src/engine/semanticSearch.ts` | **归档** |
| [x] | `src/engine/streaming/streamProcessor.js.map` | **归档**（构建残留） |
| [x] | `src/engine/tasks/shellTaskTypes.ts` | **归档** |
| [x] | `src/engine/token-counter/__tests__/index.test.ts` | **保留**（活跃测试） |
| [x] | `src/engine/toolGroups.ts` | **归档** |
| [x] | `src/engine/types.ts` | **归档**（重导出，零引用） |
| [x] | `src/engine/utils/exec.d.ts` | **归档**（旧声明） |

**归档合计 16 个**（约 117 KB 源码）。

## 验证记录

- `npm run typecheck` → **0 错误**（确认无断链）
- `npm run test:all` → extras **843 通过 / 0 失败**；unit **1126 通过**
- 保留项确认：`absorb.test.ts` 与 `token-counter/__tests__/` 均在位并在跑
