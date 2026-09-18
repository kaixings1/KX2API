# M5 · 工具调用 toolCalling

- **目录**：`src/main/proxy/toolCalling`
- **孤儿数**：31（D:\src 可靠来源 0 个）
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

归档 28（24 个旧 .d.ts + 零引用 promptAdapters/index.ts）；browserToolExtractor/toolChoicePolicy/测试保留

## 清单（31）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/main/proxy/toolCalling/ToolCallingEngine.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/ToolStreamParser.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/__tests__/managedXml.toolname.test.ts` | | — |
| [x] | `src/main/proxy/toolCalling/browserToolExtractor.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/browserToolExtractor.ts` | | — |
| [x] | `src/main/proxy/toolCalling/clientAdapters/cherryStudioMcp.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/clientAdapters/index.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/clientAdapters/standardOpenAiTools.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/clientAdapters/types.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/diagnostics.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/historyGuard.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/promptAdapters/BasePromptAdapter.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/promptAdapters/CherryStudioPromptAdapter.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/promptAdapters/DefaultPromptAdapter.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/promptAdapters/KiloCodePromptAdapter.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/promptAdapters/PromptAdapterRegistry.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/promptAdapters/index.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/promptAdapters/index.ts` | | — |
| [x] | `src/main/proxy/toolCalling/protocols/anthropicToolUse.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/protocols/base.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/protocols/codexResponses.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/protocols/index.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/protocols/managedBracket.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/protocols/managedXml.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/protocols/shared.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/providerProfiles.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/runtimePlan.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/toolCallExtractor.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/toolChoicePolicy.d.ts` | | — |
| [x] | `src/main/proxy/toolCalling/toolChoicePolicy.ts` | | — |
| [x] | `src/main/proxy/toolCalling/types.d.ts` | | — |
