# X5 · 预加载

- **目录**：`src/preload`
- **孤儿数**：1（D:\src 可靠来源 0 个）
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

| 文件 | 判断 | 处置 |
| --- | --- | --- |
| `src/preload/index.d.ts`（27KB） | 是 `src/preload/index.ts`（68KB）的**类型声明对**：`declare const electronAPI: {...}` 描述 preload 侧暴露的 API 结构。它与渲染层的 `src/renderer/src/types/electron.d.ts`（35KB）**互补而非重复** —— 后者声明 `declare global { interface Window }`（消费侧）。二者都被根 `tsconfig.check.json` 的 `include: ["src/**/*.ts"]` 收录（`.d.ts` 匹配 `*.ts`） | **保留** |

**判据**：它声明的是**真实存在**的全局量（`src/preload/index.ts` 里就是 `electronAPI`），
且被 typecheck 收录 —— 属「生效的声明文件」，不是孤儿。
（这一点与 X6 的 `globals.d.ts` 同类：`.d.ts` 天然不会有 import 引用。）

## 清单（1）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/preload/index.d.ts` | **保留**（生效的类型声明对，非孤儿） | — |

## 验证记录

- `npm run typecheck` → 0 错误
- 本批**未改动任何文件**，无回归风险
