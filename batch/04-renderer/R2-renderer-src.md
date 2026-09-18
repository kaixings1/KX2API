# R2 · 渲染层其它

- **目录**：`src/renderer/src`
- **孤儿数**：9
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

| 文件 | 定性依据 | 处置 |
| --- | --- | --- |
| `hooks/usePerformance.ts`（118 行） | 提供 `debounce`/`throttle`/`useDebounce` 等。全仓库 **grep 仅命中自身** —— 渲染层各组件都是自己处理，从未使用 | **归档** |
| `stores/promptsStore.ts`（95 行） | zustand store，**只被自己的测试引用**。`PromptsManagement.tsx` 实际用 `window.electronAPI.prompts` 直调 —— store 是**未被采用的抽象层** | **归档**（+ 测试成对） |
| `stores/__tests__/promptsStore.test.ts` | 测上面那个 store | **归档**（成对） |
| `types/electron.d.ts`（970 行） | **被 4+ 文件引用**（`main/ipc/channels.ts`、`main/store/types.ts`、`main/window/manager.ts`、`AgentCardBody.tsx`） | **保留**（活声明） |
| `vite-env.d.ts`（17 行） | `/// <reference types="vite/client" />` —— Vite 标准环境声明 | **保留** |
| `pages/McpManagement/__tests__/McpManagement.test.ts` | **活跃测试** | **保留** |
| `pages/Prompts/__tests__/PromptsManagement.test.ts` | 同上 | **保留** |
| `pages/TaskManagement/__tests__/TaskManagement.test.ts` | 同上 | **保留** |
| `pages/ToolManagement/__tests__/ToolManagement.test.ts` | 同上 | **保留** |

**4 个页面测试的实测**（vitest 自动收集，走 `include: src/**/__tests__/**`）：

```bash
node ./node_modules/vitest/vitest.mjs run src/renderer/src/pages/*/__tests__ src/renderer/src/stores/__tests__
# → Test Files  5 passed (5)
#    Tests      176 passed (176)
```

（当时 5 个文件含 `promptsStore.test.ts`；归档后剩 4 个。）

## 顺带修复：一个脆弱测试（时序抖动）

执行本批次时，`npm run test:all` 的 extras 段出现一次失败：

```
✖ 同一波内的节点并发执行（总耗时 < 串行累加）
  AssertionError: 应为并发执行（约150ms），实际 339ms（疑似串行）
```

**根因不是代码回归**：单独跑该测试 3 次全部通过（6/0）。`tests/run-all.mjs` 并行
跑 61 个文件时 CPU 争抢，把 50ms 的模拟延迟实测成 339ms。
**问题在测试本身**：用「绝对耗时」断言并发性是脆弱设计。

**修法**：改为观察**并发峰值**（`inFlight` 计数）——这是并发的定义，
不受机器负载影响；若退化回串行则峰值恒为 1，断言照样失败。

```ts
// 旧（脆弱）：assert.ok(elapsed < 320, ...)
// 新（稳健）：assert.ok(maxConcurrent >= 2, '应观察到并发（峰值 >= 2）')
```

改后：单跑 3 次稳定通过；全量 extras 841 通过、0 失败。

## 清单（9）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/renderer/src/hooks/usePerformance.ts` | **归档** → `legacy/.../hooks/usePerformance.ts`（零引用） |
| [x] | `src/renderer/src/pages/McpManagement/__tests__/McpManagement.test.ts` | **保留**（活跃测试） |
| [x] | `src/renderer/src/pages/Prompts/__tests__/PromptsManagement.test.ts` | **保留** |
| [x] | `src/renderer/src/pages/TaskManagement/__tests__/TaskManagement.test.ts` | **保留** |
| [x] | `src/renderer/src/pages/ToolManagement/__tests__/ToolManagement.test.ts` | **保留** |
| [x] | `src/renderer/src/stores/__tests__/promptsStore.test.ts` | **归档**（随 store） |
| [x] | `src/renderer/src/stores/promptsStore.ts` | **归档**（未被采用的 store） |
| [x] | `src/renderer/src/types/electron.d.ts` | **保留**（被 4+ 文件引用的活声明） |
| [x] | `src/renderer/src/vite-env.d.ts` | **保留**（Vite 标准声明） |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all` → extras **841 通过 / 0 失败**；unit 通过
- 归档后：`hooks/` 剩 4 个（`use-toast`/`useAgentExecution`/`useAgents`/`useTheme`）；
  `stores/` 剩 6 个（`dashboardStore`/`logsStore`/`navigationStore`/`providersStore`/
  `proxyStore`/`settingsStore`）
