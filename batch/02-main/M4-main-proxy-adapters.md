# M4 · 代理适配器 adapters（根）

- **目录**：`src/main/proxy/adapters`
- **孤儿数**：30（D:\src 可靠来源 0 个）
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

归档 29（10 个 *-stream.ts + 14 个旧 .d.ts + 4 个 .py + 零引用 barrel，已同步移除 barrel 导出）；browserToolExtractor 等活文件保留

## 清单（30）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/main/proxy/adapters/anthropic-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/coze-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/deepseek-stream.d.ts` | | — |
| [x] | `src/main/proxy/adapters/deepseek.d.ts` | | — |
| [x] | `src/main/proxy/adapters/fetch_stepfun.py` | | — |
| [x] | `src/main/proxy/adapters/glm.d.ts` | | — |
| [x] | `src/main/proxy/adapters/google-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/groq-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/index.d.ts` | | — |
| [x] | `src/main/proxy/adapters/index.ts` | | — |
| [x] | `src/main/proxy/adapters/kimi.d.ts` | | — |
| [x] | `src/main/proxy/adapters/mimo.d.ts` | | — |
| [x] | `src/main/proxy/adapters/minimax.d.ts` | | — |
| [x] | `src/main/proxy/adapters/mistral-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/ollama-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/openai-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/perplexity-stream.d.ts` | | — |
| [x] | `src/main/proxy/adapters/perplexity.d.ts` | | — |
| [x] | `src/main/proxy/adapters/providerModelOptions.d.ts` | | — |
| [x] | `src/main/proxy/adapters/qwen-ai.d.ts` | | — |
| [x] | `src/main/proxy/adapters/qwen.d.ts` | | — |
| [x] | `src/main/proxy/adapters/siliconcloud-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/stepfun-stream.d.ts` | | — |
| [x] | `src/main/proxy/adapters/stepfun.d.ts` | | — |
| [x] | `src/main/proxy/adapters/stepfun_download.py` | | — |
| [x] | `src/main/proxy/adapters/stepfun_download2.py` | | — |
| [x] | `src/main/proxy/adapters/stepfun_download3.py` | | — |
| [x] | `src/main/proxy/adapters/together-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/xai-stream.ts` | | — |
| [x] | `src/main/proxy/adapters/zai.d.ts` | | — |
