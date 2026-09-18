# M6 · 代理工具函数 utils

- **目录**：`src/main/proxy/utils`
- **孤儿数**：21（D:\src 可靠来源 2 个）
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

归档 20（13 个旧 .d.ts + 7 个零引用 .ts）；streamToolHandler/tools/toolParser/clientDetector 等被 adapters 引用，保留

## 清单（21）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/main/proxy/utils/__tests__/streamQueueDetector.smoke.ts` | | — |
| [x] | `src/main/proxy/utils/accountUtils.d.ts` | | — |
| [x] | `src/main/proxy/utils/accountUtils.ts` | | — |
| [x] | `src/main/proxy/utils/asyncStore.d.ts` | | — |
| [x] | `src/main/proxy/utils/asyncStore.ts` | | — |
| [x] | `src/main/proxy/utils/cacheManager.d.ts` | | — |
| [x] | `src/main/proxy/utils/cacheManager.ts` | | — |
| [x] | `src/main/proxy/utils/clientDetector.d.ts` | | — |
| [x] | `src/main/proxy/utils/errors.d.ts` | | — |
| [x] | `src/main/proxy/utils/errors.ts` | | `D:\src\utils\\errors.ts`（high） |
| [x] | `src/main/proxy/utils/index.d.ts` | | — |
| [x] | `src/main/proxy/utils/index.ts` | | `D:\src\__tests__\\utils\\index.ts`（high） |
| [x] | `src/main/proxy/utils/promptSignatures.d.ts` | | — |
| [x] | `src/main/proxy/utils/promptSignatures.ts` | | — |
| [x] | `src/main/proxy/utils/streamToolHandler.d.ts` | | — |
| [x] | `src/main/proxy/utils/toolFormatConverter.d.ts` | | — |
| [x] | `src/main/proxy/utils/toolParser.d.ts` | | — |
| [x] | `src/main/proxy/utils/toolParser/index.d.ts` | | — |
| [x] | `src/main/proxy/utils/tools.d.ts` | | — |
| [x] | `src/main/proxy/utils/unifiedToolParser.d.ts` | | — |
| [x] | `src/main/proxy/utils/unifiedToolParser.ts` | | — |
