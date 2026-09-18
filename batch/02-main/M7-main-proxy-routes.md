# M7 · 代理路由 routes

- **目录**：`src/main/proxy/routes`
- **孤儿数**：14（D:\src 可靠来源 0 个）
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

全部归档 14（纯旧 .d.ts，全部有同名 .ts）

## 清单（14）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/main/proxy/routes/chat.d.ts` | | — |
| [x] | `src/main/proxy/routes/completions.d.ts` | | — |
| [x] | `src/main/proxy/routes/index.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/accounts.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/apiKeys.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/config.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/index.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/modelMappings.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/providers.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/proxy.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/sessions.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/statistics.d.ts` | | — |
| [x] | `src/main/proxy/routes/management/toolCalling.d.ts` | | — |
| [x] | `src/main/proxy/routes/models.d.ts` | | — |
