# E6 · LLM 工具解析 llm-tool-parser

- **目录**：`src/engine/llm-tool-parser`
- **孤儿数**：3
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部归档（模块 + 测试成对）**。

| 文件 | 内容 | 定性 |
| --- | --- | --- |
| `parser.ts`（751 行） | `parseLlmToolCalls` / `looksLikeToolCall`，支持 4 种格式解析（`[tool_calls]` 标记、内嵌 JSON、Action/Arguments 文本、XML 标签） | 零引用 |
| `index.ts`（6 行） | 该目录 barrel | 零引用 |
| `__tests__/parser.test.ts`（252 行） | 22 个用例（**vitest 在跑**） | 随模块归档 |

**归档理由：这是项目里的第 7 套工具调用解析实现，且是唯一零引用的那套。**

项目现有解析器（均已接入或服务于活路径）：

```
src/main/proxy/toolCalling/ToolStreamParser.ts
src/main/proxy/toolCalling/browserToolExtractor.ts
src/main/proxy/toolCalling/toolCallExtractor.ts
src/main/proxy/utils/toolParser.ts (+ toolParser/index.ts)
src/main/proxy/utils/unifiedToolParser.ts
src/engine/plainTextToolCallRepair.ts   ← engine 层活的那套（有工具名白名单保护）
```

`llm-tool-parser` 与 `plainTextToolCallRepair` 职责重叠（都是"从纯文本里抠出工具调用"），
但前者**没有白名单保护** —— 本项目此前正因为"不与真实工具集求交集"导致
**接口文档里的示例被当成工具调用、正文被整块剥离**（见 `plainTextToolCallRepair` 的修复记录）。
因此它不是更好的替代品，而是**已被更安全实现取代的旧版本**。

**连带处置**：`__tests__/parser.test.ts` 随模块一起归档（26 个文件里它被 vitest 收集、
22 个用例在跑 —— 但测的是已归档的模块；留着会因找不到被导入的模块而整个文件失败）。

## 清单（3）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/llm-tool-parser/parser.ts` | **归档** → `legacy/src/engine/llm-tool-parser/` |
| [x] | `src/engine/llm-tool-parser/index.ts` | **归档** |
| [x] | `src/engine/llm-tool-parser/__tests__/parser.test.ts` | **归档**（成对） |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all` → extras **843 通过 / 0 失败**；unit 通过
- 顺带删除归档后变空的 `src/engine/llm-tool-parser/`（含 `__tests__/`）目录
