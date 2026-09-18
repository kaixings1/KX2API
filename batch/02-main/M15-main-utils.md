# M15 · 主进程工具函数 utils

- **目录**：`src/main/utils`
- **孤儿数**：14（D:\src 可靠来源 12 个）
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

归档 3（零引用 barrel index.ts + pMap.ts + stripAnsi.ts）；其余 12 个工具被 tests/utils 直接引用，保留

## 清单（14）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/main/utils/CircularBuffer.ts` | | `D:\src\utils\\CircularBuffer.ts`（high） |
| [x] | `src/main/utils/array.ts` | | `D:\src\utils\\array.ts`（high） |
| [x] | `src/main/utils/formatBriefTimestamp.ts` | | `D:\src\utils\\formatBriefTimestamp.ts`（high） |
| [x] | `src/main/utils/hash.ts` | | `D:\src\utils\\hash.ts`（high） |
| [x] | `src/main/utils/index.ts` | | `D:\src\__tests__\\utils\\index.ts`（high） |
| [x] | `src/main/utils/normalizeModelId.ts` | | `D:\src\utils\\normalizeModelId.ts`（high） |
| [x] | `src/main/utils/pMap.ts` | | — |
| [x] | `src/main/utils/sequential.ts` | | `D:\src\utils\\sequential.ts`（high） |
| [x] | `src/main/utils/set.ts` | | `D:\src\utils\\set.ts`（high） |
| [x] | `src/main/utils/slashCommandParsing.ts` | | `D:\src\utils\\slashCommandParsing.ts`（high） |
| [x] | `src/main/utils/sleep.ts` | | `D:\src\utils\\sleep.ts`（high） |
| [x] | `src/main/utils/stripAnsi.ts` | | — |
| [x] | `src/main/utils/timeouts.ts` | | `D:\src\utils\\timeouts.ts`（high） |
| [x] | `src/main/utils/withResolvers.ts` | | `D:\src\utils\\withResolvers.ts`（high） |
