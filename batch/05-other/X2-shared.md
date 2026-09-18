# X2 · 共享层

- **目录**：`src/shared`
- **孤儿数**：4（D:\src 可靠来源 0 个）
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用（含动态 import、字符串路径、配置引用）
#    逐文件查：grep -rn "<文件名去掉后缀>" src tests scripts
# 2) 三选一处置：
#    - 确认无引用        → git rm 具体文件（勿按后缀批量删）
#    - 有参考价值        → 移动到 legacy/ 对应目录
#    - 其实有用只是没接线 → 接线并补测试
# 3) 验证（必须全过才能勾选）
npm run typecheck && npm run build && npm run test:all
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪，
> 按后缀删会误伤手写声明（如 `src/renderer/src/types/electron.d.ts`）。
> 只删本文件清单里逐个确认过的具体文件。

## 处置结论

| 文件 | 定性 | 处置 |
| --- | --- | --- |
| `src/shared/types.d.ts`（8.7KB） | **旧声明，已被同名 `types.ts`（17.5KB）取代**。零引用 | **归档** |
| `src/shared/toolCalling.d.ts`（1.5KB） | 同上 —— 同名 `toolCalling.ts`（6.1KB）才是活的 | **归档** |
| `src/shared/textTruncate.ts`（7.4KB） | "按显示宽度截断"（East Asian Width + 字素簇），面向**终端等宽场景**。渲染层用的是 CSS `truncate` 类（Tailwind），**Electron 无 JS 截断需求**。仅被自己的测试引用 | **归档**（测试一并归档） |
| `src/shared/types/agents.ts`（587B） | 零引用类型定义 | **归档** |

**关于 `.d.ts` 的重要辨析（本轮踩坑记录）**：
- `src/preload/index.d.ts`、`src/generated/globals.d.ts` 是**生效的声明**（X5/X6 已判保留）
- 而本批的两个 `.d.ts` 是**被同名 `.ts` 取代的旧声明** —— 判据是：
  **存在同名 `.ts` 实现文件** + 零引用。
- 我一度误判"报告的孤儿清单有大量误报"，错误地拿 `tsc --listFiles` 当权威判据。
  **它不可用于此用途**：`tsc` 会全量加载 tsconfig `include` 范围内的文件
  （实测加载 651 个 ≈ src 下 646 个 `.ts/.tsx`），加载 ≠ 被 import。
  **正确判据仍是 `check-repo.mjs` 的静态 import 追踪。**

## 清单（4）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/shared/types.d.ts` | **归档** → `legacy/src/shared/types.d.ts` | — |
| [x] | `src/shared/toolCalling.d.ts` | **归档** → `legacy/src/shared/toolCalling.d.ts` | — |
| [x] | `src/shared/textTruncate.ts` | **归档**（+ 测试）→ `legacy/src/shared/textTruncate.ts` | — |
| [x] | `src/shared/types/agents.ts` | **归档** → `legacy/src/shared/types/agents.ts` | — |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all` → extras 841 通过；unit **1162** 通过（原 1208，减少 46 = 随
  `textTruncate.test.ts` 一起归档的用例数，符合预期）
- 顺带删除归档后变空的 `src/shared/types/`、`src/__tests__/shared/` 目录
- 归档后 `src/shared/` 只剩活文件：`errorMessages.ts`、`formatError.ts`、`loopConfig.ts`、`toolCalling.ts`、`types.ts`
