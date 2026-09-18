# X6 · 生成物

- **目录**：`src/generated`
- **孤儿数**：1（D:\src 可靠来源 1 个）
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

**全部保留（0 个删除）** —— 本批是「保留」类批次的范例，说明
「体检报告标为孤儿」≠「可以删」。

| 文件 | 体检口径 | 实际情况 | 处置 |
| --- | --- | --- | --- |
| `src/generated/globals.d.ts` | 孤儿（无 import 引用） | **是生效的全局类型声明**。声明了 `MACRO` / `BUILD_ENV` / `BUILD_PLATFORM` / `jsonStringify` 等构建期注入的全局量；`tsconfig.check.json` 的 `include: ["src/**/*.ts"]` 覆盖 `.d.ts`，因此**不需要被 import 也生效**。`src/engine/bootstrap/macro.ts` 正是这些全局量的消费者 | **保留** |

**教训**：`.d.ts` 是「声明文件」而非「模块」，静态依赖追踪必然把它们判成孤儿。
凡 `.d.ts` 一律**先看它声明了什么、谁在用那些声明**，再决定。

## 清单（1）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/generated/globals.d.ts` | **保留**（生效的全局声明，非孤儿） | `D:\src\generated\globals.d.ts`（high） |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run build` → 成功
- `npm run test:all` → agent 47 / management 74 / extras 841 / unit 1208，0 失败
- 本批**未删除任何文件**，无回归风险
