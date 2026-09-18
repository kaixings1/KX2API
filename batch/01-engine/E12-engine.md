# E12 · 引擎根目录散落文件

- **目录**：`src/engine`
- **孤儿数**：20（D:\src 可靠来源 9 个）
- **状态**：⬜ 未开始
- **完成时间**：—

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

## 清单（20）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [ ] | `src/engine/absorb.ts` | | — |
| [ ] | `src/engine/cli.d.ts` | | — |
| [ ] | `src/engine/cli.ts` | | — |
| [ ] | `src/engine/codeExplainer.ts` | | `D:\src\engine\\codeExplainer.ts`（high） |
| [ ] | `src/engine/codeVectorStore.ts` | | `D:\src\engine\\codeVectorStore.ts`（high） |
| [ ] | `src/engine/core.d.ts` | | — |
| [ ] | `src/engine/cost/costHook.ts` | | — |
| [ ] | `src/engine/ecoFilter.ts` | | `D:\src\engine\\ecoFilter.ts`（high） |
| [ ] | `src/engine/index.d.ts` | | — |
| [ ] | `src/engine/knowledgeGraph.ts` | | `D:\src\engine\\knowledgeGraph.ts`（high） |
| [ ] | `src/engine/memoryStore.ts` | | `D:\src\engine\\memoryStore.ts`（high） |
| [ ] | `src/engine/orchestrator/index.ts` | | `D:\src\engine\\orchestrator\\index.ts`（high） |
| [ ] | `src/engine/progress-engine/index.ts` | | — |
| [ ] | `src/engine/semanticSearch.ts` | | `D:\src\engine\\semanticSearch.ts`（high） |
| [ ] | `src/engine/streaming/streamProcessor.js.map` | | — |
| [ ] | `src/engine/tasks/shellTaskTypes.ts` | | — |
| [ ] | `src/engine/token-counter/__tests__/index.test.ts` | | `D:\src\commands\\brain-sync\\__tests__\\index.test.ts`（medium） |
| [ ] | `src/engine/toolGroups.ts` | | — |
| [ ] | `src/engine/types.ts` | | `D:\src\engine\\types.ts`（high） |
| [ ] | `src/engine/utils/exec.d.ts` | | — |
