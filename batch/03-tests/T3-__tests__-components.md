# T3 · 组件测试

- **目录**：`src/__tests__/components`
- **孤儿数**：10
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用（含动态 import、字符串路径、配置引用）
# 2) 三选一处置：
#    - 确认无引用        → git rm 具体文件（勿按后缀批量删）
#    - 有参考价值        → 移动到 legacy/ 对应目录
#    - 其实有用只是没接线 → 接线并补测试
# 3) 验证（必须全过才能勾选）
npm run typecheck && npm run build && npm run test:all
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪，
> 按后缀删会误伤手写声明（如 `src/renderer/src/types/electron.d.ts`）。

## 处置结论

**全部保留（0 个删除/归档）** —— 这是一类必须整体排除的「假孤儿」：**测试文件**。

测试是**终端消费者**：没有任何生产代码会 import 它们，所以按「静态依赖追踪」
口径它们必然被标成孤儿。但它们由 **vitest 自动收集执行**，删掉等于**销毁测试覆盖**。

实测验证（本批次实际执行）：

```bash
node ./node_modules/vitest/vitest.mjs run src/__tests__/components
# → Test Files  10 passed (10)
#    Tests      120 passed (120)
```

10 个文件、**120 个用例全部在跑**，且各自 import 的组件均存在（无失效依赖）。

| 文件 | 状态 | 依赖 |
| --- | --- | --- |
| `CommandPalette.test.tsx` | 运行中 | 完整 |
| `ErrorRecovery.test.tsx` | 运行中 | 完整 |
| `KanbanBoard.test.tsx` | 运行中 | 完整 |
| `LogsPageIntegration.test.ts` | 运行中 | 完整 |
| `MarkdownRenderer.test.tsx` | 运行中 | 完整 |
| `ProgressReport.test.tsx` | 运行中 | 完整 |
| `Sandbox.test.tsx` | 运行中 | 完整 |
| `TimeTracker.test.tsx` | 运行中 | 完整 |
| `ToolErrorBanner.test.tsx` | 运行中 | 完整 |
| `ToolProgressBar.test.tsx` | 运行中 | 完整 |

> 📌 **重要口径**：`src/__tests__/**`（T1~T4）与 `tests/**` 下的文件在体检报告里
> 都会被列为孤儿，因为无人 import。**判断测试是否为孤儿的正确方法**：
> ① 是否被测试运行器收集（vitest 收 `src/**/__tests__/**`；node:test 收 `tests/`）；
> ② 它 import 的模块是否还存在。**两条都成立就必须保留。**
> 仅当**被测模块本身已被删除/归档**时，测试才同步处置（如 T4 的 textTruncate）。

## 清单（10）

| 完成 | 路径 | 处置 | D:\src 来源 |
| :---: | --- | --- | --- |
| [x] | `src/__tests__/components/CommandPalette.test.tsx` | **保留**（活跃测试） | — |
| [x] | `src/__tests__/components/ErrorRecovery.test.tsx` | **保留** | — |
| [x] | `src/__tests__/components/KanbanBoard.test.tsx` | **保留** | — |
| [x] | `src/__tests__/components/LogsPageIntegration.test.ts` | **保留** | — |
| [x] | `src/__tests__/components/MarkdownRenderer.test.tsx` | **保留** | — |
| [x] | `src/__tests__/components/ProgressReport.test.tsx` | **保留** | — |
| [x] | `src/__tests__/components/Sandbox.test.tsx` | **保留** | — |
| [x] | `src/__tests__/components/TimeTracker.test.tsx` | **保留** | — |
| [x] | `src/__tests__/components/ToolErrorBanner.test.tsx` | **保留** | — |
| [x] | `src/__tests__/components/ToolProgressBar.test.tsx` | **保留** | — |

## 验证记录

- `vitest run src/__tests__/components` → 10 files / 120 tests passed
- 本批**未改动任何文件**，无回归风险
