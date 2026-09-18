# X3 · 工具（顶层）

- **目录**：`src/utils`
- **孤儿数**：3（D:\src 可靠来源 3 个）
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

三个文件都是**完整实现**（非空壳），但**全仓库零引用**，且部分符号与别处重复：

| 文件 | 内容 | 判断 |
| --- | --- | --- |
| `src/utils/diff.ts`（229 行） | `structuredPatch` / `generateUnifiedDiff` / `adjustHunkLineNumbers` | 无任何使用场景（`gitContext` 走 `git blame/log`，不生成 diff）。全仓库仅此一份 diff 实现 |
| `src/utils/format.ts`（83 行） | `formatFileSize` / `formatDuration` / `formatSecondsShort` | 零引用；且 `formatDuration` 在 `src/engine/orchestrator/pipeline.ts`、`shared.ts` 各有一份**活实现** → 本文件是**未被采用的重复份** |
| `src/utils/stringUtils.ts`（31 行） | `escapeRegExp` / `capitalize` / `plural` | 零引用；`escapeRegExp` 在 `src/engine/knowledgeGraph.ts` 有活实现，`capitalize` 在 `CookieSessionPage.tsx` 有活实现 |

**统一处置：归档到 `legacy/src/utils/`**。

选择归档而非删除的理由：三者都有完整实现、且 `D:\src` 有对应源，
未来若要统一 utils 层可直接搬回；但**留在 `src/` 会持续制造"两份实现"的误导**
（后来者 grep `formatDuration` 会同时命中活实现与死实现，难以判断该改哪个）。

## 清单（3）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/utils/diff.ts` | **归档** → `legacy/src/utils/diff.ts` | `D:\src\utils\diff.ts`（high） |
| [x] | `src/utils/format.ts` | **归档** → `legacy/src/utils/format.ts` | `D:\src\utils\format.ts`（high） |
| [x] | `src/utils/stringUtils.ts` | **归档** → `legacy/src/utils/stringUtils.ts` | `D:\src\utils\stringUtils.ts`（high） |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all` → extras 841 通过 / unit 1208 通过，0 失败
- 归档后 `src/utils/` 只剩活文件：`file.ts`、`plainTextToolCallRepair.ts`、`progress-engine/`
