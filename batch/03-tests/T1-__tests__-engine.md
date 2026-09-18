# T1 · 引擎单元测试（vitest）

- **目录**：`src/__tests__/engine`
- **孤儿数**：28
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部保留（0 个删除/归档）** —— T1~T4 同属「假孤儿：测试文件」类。

实测验证：

```bash
node ./node_modules/vitest/vitest.mjs run src/__tests__/engine
# → Test Files  28 passed (28)
#    Tests      483 passed (483)
```

28 个文件、**483 个用例全部在跑**；且 28/28 依赖完整（逐一核对了每个测试的
相对 import 能否解析到实际文件）。

覆盖的模块（对应 `src/engine/` 下的实现）：

`absorb` / `autoMemory` / `claudeMdLoader` / `compactCoordinator` / `compactPrompt` /
`coordinator` / `imageBudget` / `jsonSchemaRepair` / `loopConfig` / `memoryRecallLimits` /
`memorySurfaceBudget` / `memoryToolRecall` / `pauseAndCircuit` / `permissionRules` /
`preAnalysis` / `promptSections` / `promptSectionsMemo` / `repoMap` /
`securityEnhancerAudit` / `sessionMemory` / `sessionRecovery` / `subAgentIsolation` /
`task-decomposer-executor` / `toolErrorFormat` / `toolHistoryGuard` / `toolHooksWiring` /
`toolResultStore` / `transcript`

## 清单（28）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/__tests__/engine/absorb.test.ts` | **保留**（活跃测试） |
| [x] | `src/__tests__/engine/autoMemory.test.ts` | **保留** |
| [x] | `src/__tests__/engine/claudeMdLoader.test.ts` | **保留** |
| [x] | `src/__tests__/engine/compactCoordinator.test.ts` | **保留** |
| [x] | `src/__tests__/engine/compactPrompt.test.ts` | **保留** |
| [x] | `src/__tests__/engine/coordinator.test.ts` | **保留** |
| [x] | `src/__tests__/engine/imageBudget.test.ts` | **保留** |
| [x] | `src/__tests__/engine/jsonSchemaRepair.test.ts` | **保留** |
| [x] | `src/__tests__/engine/loopConfig.test.ts` | **保留** |
| [x] | `src/__tests__/engine/memoryRecallLimits.test.ts` | **保留** |
| [x] | `src/__tests__/engine/memorySurfaceBudget.test.ts` | **保留** |
| [x] | `src/__tests__/engine/memoryToolRecall.test.ts` | **保留** |
| [x] | `src/__tests__/engine/pauseAndCircuit.test.ts` | **保留** |
| [x] | `src/__tests__/engine/permissionRules.test.ts` | **保留** |
| [x] | `src/__tests__/engine/preAnalysis.test.ts` | **保留** |
| [x] | `src/__tests__/engine/promptSections.test.ts` | **保留** |
| [x] | `src/__tests__/engine/promptSectionsMemo.test.ts` | **保留** |
| [x] | `src/__tests__/engine/repoMap.test.ts` | **保留** |
| [x] | `src/__tests__/engine/securityEnhancerAudit.test.ts` | **保留** |
| [x] | `src/__tests__/engine/sessionMemory.test.ts` | **保留** |
| [x] | `src/__tests__/engine/sessionRecovery.test.ts` | **保留** |
| [x] | `src/__tests__/engine/subAgentIsolation.test.ts` | **保留** |
| [x] | `src/__tests__/engine/task-decomposer-executor.test.ts` | **保留** |
| [x] | `src/__tests__/engine/toolErrorFormat.test.ts` | **保留** |
| [x] | `src/__tests__/engine/toolHistoryGuard.test.ts` | **保留** |
| [x] | `src/__tests__/engine/toolHooksWiring.test.ts` | **保留** |
| [x] | `src/__tests__/engine/toolResultStore.test.ts` | **保留** |
| [x] | `src/__tests__/engine/transcript.test.ts` | **保留** |

## 验证记录

- `vitest run src/__tests__/engine` → 28 files / 483 tests passed
- 依赖完整性：28/28
- 本批**未改动任何文件**，无回归风险
