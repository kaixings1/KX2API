# 代码接入体检报告

生成时间：2026/9/15 20:02:06

三档口径：**应用引用**（从 4 个真实入口可达）／**仅测试引用**／**孤儿**（两边都不可达）。

## 一、仓库顶层

| 顶层项 | 分类 | 文件数 | 大小 | 应用引用 | 说明 |
| --- | --- | ---: | ---: | ---: | --- |
| `legacy/` | 旧代码归档（已移出构建链路） | 2914 | 18.7MB | 0 ⚠️ | 旧代码归档：从 src/ 移出的未接入代码，保留供移植参考，不参与构建 |
| `src/` | 应用运行时 | 782 | 6.2MB | 379 | 主源码 |
| `tests/` | 测试链路 | 50 | 295.8KB | 0 ⚠️ | 测试用例（node:test / 独立脚本两套） |
| `out/` | 构建/打包 | 41 | 13.7MB | 0 ⚠️ | electron-vite 构建产物（生成物） |
| `docs/` | 文档 | 27 | 3.3MB | 0 ⚠️ | 文档 |
| `capture/` | 人工使用（脚本/参考数据） | 22 | 86.6KB | 0 ⚠️ | 抓包脚本（配合 Edge 9222 调试端口），手动运行 |
| `project/` | 人工使用（脚本/参考数据） | 17 | 23.7KB | 0 ⚠️ | 独立的小项目/示例，未被主程序引用 |
| `skills/` | 人工使用（脚本/参考数据） | 12 | 25.3KB | 0 ⚠️ | 技能样例数据（可被用户导入，非代码依赖） |
| `tools/` | 人工使用（脚本/参考数据） | 10 | 72.8KB | 0 ⚠️ | 独立工具脚本（tsx 直接运行），未被主程序引用 |
| `scripts/` | 人工使用（脚本/参考数据） | 10 | 52.8KB | 0 ⚠️ | 构建/发布/自检脚本（npm run 会用到其中部分） |
| `build/` | 构建/打包 | 9 | 1.2MB | 0 ⚠️ | 打包资源（icon 等），被 electron-builder 使用 |
| `config/` | 人工使用（脚本/参考数据） | 4 | 1.4KB | 0 ⚠️ | 配置样例/预设，未被代码读取 |
| `self-test-patch-project/` | 人工使用（脚本/参考数据） | 3 | 1.2KB | 0 ⚠️ | 自测用补丁样例项目 |
| `debug.txt` | 生成物/日志（可删） | 1 | 4.2MB | 0 ⚠️ |  |
| `dev/` | 人工使用（脚本/参考数据） | 1 | 467.9KB | 0 ⚠️ | 开发用临时脚本 |
| `package-lock.json` | 构建/打包 | 1 | 341.0KB | 0 ⚠️ | 构建/运行配置 |
| `0` | 生成物/日志（可删） | 1 | 198.8KB | 0 ⚠️ |  |
| `LICENSE` | 文档 | 1 | 173.9KB | 0 ⚠️ |  |
| `stepfun_connect_headers.json` | 一次性产物（可删） | 1 | 38.6KB | 0 ⚠️ |  |
| `stepfun_ws_frames.json` | 一次性产物（可删） | 1 | 17.2KB | 0 ⚠️ |  |
| `stepfun_session_create.json` | 一次性产物（可删） | 1 | 12.8KB | 0 ⚠️ |  |
| `stepfun_api.proto` | 一次性产物（可删） | 1 | 8.0KB | 0 ⚠️ |  |
| `TASK.md` | 文档 | 1 | 7.9KB | 0 ⚠️ |  |
| `diagnose_stepfun_auth.js` | 未分类 | 1 | 6.7KB | 0 ⚠️ |  |
| `diagnostic_tool/` | 人工使用（脚本/参考数据） | 1 | 6.3KB | 0 ⚠️ | 诊断脚本（Python） |
| `CLAUDE.md` | 文档 | 1 | 5.5KB | 0 ⚠️ |  |
| `diagnose_stepfun_auth.cjs` | 一次性产物（可删） | 1 | 5.4KB | 0 ⚠️ |  |
| `diagnose_token_expiry.cjs` | 一次性产物（可删） | 1 | 4.2KB | 0 ⚠️ |  |
| `diagnose_token_parse.cjs` | 一次性产物（可删） | 1 | 3.9KB | 0 ⚠️ |  |
| `PLANNING.md` | 文档 | 1 | 3.4KB | 0 ⚠️ |  |
| `REFACTOR_PLAN.md` | 文档 | 1 | 2.3KB | 0 ⚠️ |  |
| `stepfun_chatstream_capture.json` | 一次性产物（可删） | 1 | 2.1KB | 0 ⚠️ |  |
| `electron.vite.config.ts` | 构建/打包 | 1 | 1.6KB | 0 ⚠️ | 构建/运行配置 |
| `tool_queue_extractor/` | 人工使用（脚本/参考数据） | 1 | 1.1KB | 0 ⚠️ | 抓包用的工具队列提取器（Python） |
| `vitest.config.ts` | 构建/打包 | 1 | 1.0KB | 0 ⚠️ | 构建/运行配置 |
| `README.md` | 文档 | 1 | 731B | 0 ⚠️ |  |
| `_verify.cjs` | 一次性产物（可删） | 1 | 708B | 0 ⚠️ |  |
| `tailwind.config.ts` | 构建/打包 | 1 | 280B | 0 ⚠️ | 构建/运行配置 |
| `_scan_i18n.cjs` | 一次性产物（可删） | 1 | 279B | 0 ⚠️ |  |
| `run_prod.bat` | 构建/打包 | 1 | 185B | 0 ⚠️ | 构建/运行配置 |
| `postcss.config.cjs` | 构建/打包 | 1 | 82B | 0 ⚠️ | 构建/运行配置 |
| `run.bat` | 构建/打包 | 1 | 79B | 0 ⚠️ | 构建/运行配置 |
| `package.json` | 构建/打包 | 1 | 4.2KB | 1 | 构建/运行配置 |

## 二、src/ 各目录接入情况

| 目录 | 文件数 | 应用引用 | 仅测试 | 孤儿 |
| --- | ---: | ---: | ---: | ---: |
| `src/main` | 471 | 194 | 0 | 277 |
| `src/renderer` | 154 | 135 | 0 | 19 |
| `src/engine` | 120 | 40 | 0 | 80 |
| `src/__tests__` | 10 | 0 | 0 | 10 |
| `src/security` | 9 | 3 | 0 | 6 |
| `src/shared` | 8 | 4 | 0 | 4 |
| `src/utils` | 5 | 1 | 0 | 4 |
| `src/preload` | 3 | 1 | 0 | 2 |
| `src/memory` | 2 | 1 | 0 | 1 |

## 三、孤儿文件清单（403 个）

<details><summary><code>src/main/proxy</code> — 164 个</summary>

- `src/main/proxy/adapters/deepseek-stream.d.ts`
- `src/main/proxy/adapters/deepseek.d.ts`
- `src/main/proxy/adapters/fetch_stepfun.py`
- `src/main/proxy/adapters/glm.d.ts`
- `src/main/proxy/adapters/index.d.ts`
- `src/main/proxy/adapters/index.ts`
- `src/main/proxy/adapters/kimi.d.ts`
- `src/main/proxy/adapters/mimo.d.ts`
- `src/main/proxy/adapters/minimax.d.ts`
- `src/main/proxy/adapters/perplexity-stream.d.ts`
- `src/main/proxy/adapters/perplexity.d.ts`
- `src/main/proxy/adapters/prompt/BasePromptAdapter.d.ts`
- `src/main/proxy/adapters/prompt/BasePromptAdapter.ts`
- `src/main/proxy/adapters/prompt/CherryStudioPromptAdapter.d.ts`
- `src/main/proxy/adapters/prompt/CherryStudioPromptAdapter.ts`
- `src/main/proxy/adapters/prompt/DefaultPromptAdapter.d.ts`
- `src/main/proxy/adapters/prompt/DefaultPromptAdapter.ts`
- `src/main/proxy/adapters/prompt/index.d.ts`
- `src/main/proxy/adapters/prompt/index.ts`
- `src/main/proxy/adapters/prompt/KiloCodePromptAdapter.d.ts`
- `src/main/proxy/adapters/prompt/KiloCodePromptAdapter.ts`
- `src/main/proxy/adapters/prompt/PromptAdapterRegistry.d.ts`
- `src/main/proxy/adapters/prompt/PromptAdapterRegistry.ts`
- `src/main/proxy/adapters/providerModelOptions.d.ts`
- `src/main/proxy/adapters/qwen-ai.d.ts`
- `src/main/proxy/adapters/qwen.d.ts`
- `src/main/proxy/adapters/stepfun-stream.d.ts`
- `src/main/proxy/adapters/stepfun.d.ts`
- `src/main/proxy/adapters/stepfun_1786.js`
- `src/main/proxy/adapters/stepfun_console_tools.js`
- `src/main/proxy/adapters/stepfun_download.py`
- `src/main/proxy/adapters/stepfun_download2.py`
- `src/main/proxy/adapters/stepfun_download3.py`
- `src/main/proxy/adapters/stepfun_main_app.js`
- `src/main/proxy/adapters/transformers/anthropic.ts`
- `src/main/proxy/adapters/transformers/gemini.ts`
- `src/main/proxy/adapters/transformers/openai.ts`
- `src/main/proxy/adapters/zai.d.ts`
- `src/main/proxy/adapters/__mocks__/deepseek-stream.d.ts`
- `src/main/proxy/adapters/__mocks__/deepseek-stream.ts`
- `src/main/proxy/adapters/__mocks__/deepseek.d.ts`
- `src/main/proxy/adapters/__mocks__/deepseek.ts`
- `src/main/proxy/adapters/__mocks__/glm.d.ts`
- `src/main/proxy/adapters/__mocks__/glm.ts`
- `src/main/proxy/adapters/__mocks__/kimi.d.ts`
- `src/main/proxy/adapters/__mocks__/kimi.ts`
- `src/main/proxy/adapters/__mocks__/mimo.d.ts`
- `src/main/proxy/adapters/__mocks__/mimo.ts`
- `src/main/proxy/adapters/__mocks__/minimax.d.ts`
- `src/main/proxy/adapters/__mocks__/minimax.ts`
- `src/main/proxy/adapters/__mocks__/perplexity-stream.d.ts`
- `src/main/proxy/adapters/__mocks__/perplexity-stream.ts`
- `src/main/proxy/adapters/__mocks__/perplexity.d.ts`
- `src/main/proxy/adapters/__mocks__/perplexity.ts`
- `src/main/proxy/adapters/__mocks__/qwen-ai.d.ts`
- `src/main/proxy/adapters/__mocks__/qwen-ai.ts`
- `src/main/proxy/adapters/__mocks__/qwen.d.ts`
- `src/main/proxy/adapters/__mocks__/qwen.ts`
- `src/main/proxy/adapters/__mocks__/stepfun-stream.d.ts`
- `src/main/proxy/adapters/__mocks__/stepfun-stream.ts`
- `src/main/proxy/adapters/__mocks__/stepfun.d.ts`
- `src/main/proxy/adapters/__mocks__/stepfun.ts`
- `src/main/proxy/adapters/__mocks__/zai.d.ts`
- `src/main/proxy/adapters/__mocks__/zai.ts`
- `src/main/proxy/config/modelProfiles.d.ts`
- `src/main/proxy/config/modelProfiles.ts`
- `src/main/proxy/constants/signatures.d.ts`
- `src/main/proxy/dedup/index.d.ts`
- `src/main/proxy/dedup/index.ts`
- `src/main/proxy/forwarder.d.ts`
- `src/main/proxy/index.d.ts`
- `src/main/proxy/index.ts`
- `src/main/proxy/loadbalancer.d.ts`
- `src/main/proxy/middleware/managementAuth.d.ts`
- `src/main/proxy/modelMapper.d.ts`
- `src/main/proxy/prompt/index.d.ts`
- `src/main/proxy/prompt/index.ts`
- `src/main/proxy/prompt/types.d.ts`
- `src/main/proxy/prompt/variants/create_default.js`
- `src/main/proxy/prompt/variants/deepseek.d.ts`
- `src/main/proxy/prompt/variants/default.d.ts`
- `src/main/proxy/prompt/variants/glm.d.ts`
- `src/main/proxy/prompt/variants/index.d.ts`
- `src/main/proxy/prompt/variants/qwen.d.ts`
- `src/main/proxy/prompt/variants/xml.d.ts`
- `src/main/proxy/prompt/variantSelector.d.ts`
- `src/main/proxy/promptToolUse.d.ts`
- `src/main/proxy/routes/chat.d.ts`
- `src/main/proxy/routes/completions.d.ts`
- `src/main/proxy/routes/index.d.ts`
- `src/main/proxy/routes/management/accounts.d.ts`
- `src/main/proxy/routes/management/apiKeys.d.ts`
- `src/main/proxy/routes/management/config.d.ts`
- `src/main/proxy/routes/management/index.d.ts`
- `src/main/proxy/routes/management/modelMappings.d.ts`
- `src/main/proxy/routes/management/providers.d.ts`
- `src/main/proxy/routes/management/proxy.d.ts`
- `src/main/proxy/routes/management/sessions.d.ts`
- `src/main/proxy/routes/management/statistics.d.ts`
- `src/main/proxy/routes/management/toolCalling.d.ts`
- `src/main/proxy/routes/models.d.ts`
- `src/main/proxy/server.d.ts`
- `src/main/proxy/services/contextManagementService.d.ts`
- `src/main/proxy/services/promptGenerator.d.ts`
- `src/main/proxy/services/promptInjectionService.d.ts`
- `src/main/proxy/sessionManager.d.ts`
- `src/main/proxy/status.d.ts`
- `src/main/proxy/stream.d.ts`
- `src/main/proxy/toolCalling/browserToolExtractor.d.ts`
- `src/main/proxy/toolCalling/browserToolExtractor.ts`
- `src/main/proxy/toolCalling/clientAdapters/cherryStudioMcp.d.ts`
- `src/main/proxy/toolCalling/clientAdapters/index.d.ts`
- `src/main/proxy/toolCalling/clientAdapters/standardOpenAiTools.d.ts`
- `src/main/proxy/toolCalling/clientAdapters/types.d.ts`
- `src/main/proxy/toolCalling/diagnostics.d.ts`
- `src/main/proxy/toolCalling/historyGuard.d.ts`
- `src/main/proxy/toolCalling/promptAdapters/BasePromptAdapter.d.ts`
- `src/main/proxy/toolCalling/promptAdapters/CherryStudioPromptAdapter.d.ts`
- `src/main/proxy/toolCalling/promptAdapters/DefaultPromptAdapter.d.ts`
- `src/main/proxy/toolCalling/promptAdapters/index.d.ts`
- `src/main/proxy/toolCalling/promptAdapters/index.ts`
- `src/main/proxy/toolCalling/promptAdapters/KiloCodePromptAdapter.d.ts`
- `src/main/proxy/toolCalling/promptAdapters/PromptAdapterRegistry.d.ts`
- `src/main/proxy/toolCalling/protocols/anthropicToolUse.d.ts`
- `src/main/proxy/toolCalling/protocols/base.d.ts`
- `src/main/proxy/toolCalling/protocols/codexResponses.d.ts`
- `src/main/proxy/toolCalling/protocols/index.d.ts`
- `src/main/proxy/toolCalling/protocols/managedBracket.d.ts`
- `src/main/proxy/toolCalling/protocols/managedXml.d.ts`
- `src/main/proxy/toolCalling/protocols/shared.d.ts`
- `src/main/proxy/toolCalling/providerProfiles.d.ts`
- `src/main/proxy/toolCalling/runtimePlan.d.ts`
- `src/main/proxy/toolCalling/toolCallExtractor.d.ts`
- `src/main/proxy/toolCalling/ToolCallingEngine.d.ts`
- `src/main/proxy/toolCalling/toolChoicePolicy.d.ts`
- `src/main/proxy/toolCalling/toolChoicePolicy.ts`
- `src/main/proxy/toolCalling/ToolStreamParser.d.ts`
- `src/main/proxy/toolCalling/types.d.ts`
- `src/main/proxy/tools/streamingToolExecutor.ts`
- `src/main/proxy/tools/toolCallCache.ts`
- `src/main/proxy/tools/toolCollection.d.ts`
- `src/main/proxy/tools/toolOrchestrator.ts`
- `src/main/proxy/types.d.ts`
- `src/main/proxy/utils/accountUtils.d.ts`
- `src/main/proxy/utils/accountUtils.ts`
- `src/main/proxy/utils/asyncStore.d.ts`
- `src/main/proxy/utils/asyncStore.ts`
- `src/main/proxy/utils/cacheManager.d.ts`
- `src/main/proxy/utils/cacheManager.ts`
- `src/main/proxy/utils/clientDetector.d.ts`
- `src/main/proxy/utils/errors.d.ts`
- `src/main/proxy/utils/errors.ts`
- `src/main/proxy/utils/index.d.ts`
- `src/main/proxy/utils/index.ts`
- `src/main/proxy/utils/promptSignatures.d.ts`
- `src/main/proxy/utils/promptSignatures.ts`
- `src/main/proxy/utils/streamToolHandler.d.ts`
- `src/main/proxy/utils/toolFormatConverter.d.ts`
- `src/main/proxy/utils/toolParser/index.d.ts`
- `src/main/proxy/utils/toolParser.d.ts`
- `src/main/proxy/utils/tools.d.ts`
- `src/main/proxy/utils/unifiedToolParser.d.ts`
- `src/main/proxy/utils/unifiedToolParser.ts`
- `src/main/proxy/__tests__/apiKeyAuth.test.ts`

</details>

<details><summary><code>src/engine/__tests__</code> — 33 个</summary>

- `src/engine/__tests__/client.test.d.ts`
- `src/engine/__tests__/client.test.js`
- `src/engine/__tests__/client.test.ts`
- `src/engine/__tests__/coordinator.test.d.ts`
- `src/engine/__tests__/coordinator.test.js`
- `src/engine/__tests__/coordinator.test.ts`
- `src/engine/__tests__/e2e-all-profiles.test.d.ts`
- `src/engine/__tests__/e2e-all-profiles.test.js`
- `src/engine/__tests__/e2e-all-profiles.test.ts`
- `src/engine/__tests__/e2e-chat.test.d.ts`
- `src/engine/__tests__/e2e-chat.test.js`
- `src/engine/__tests__/e2e-chat.test.ts`
- `src/engine/__tests__/engine.test.d.ts`
- `src/engine/__tests__/engine.test.js`
- `src/engine/__tests__/engine.test.ts`
- `src/engine/__tests__/integration.test.d.ts`
- `src/engine/__tests__/integration.test.js`
- `src/engine/__tests__/integration.test.ts`
- `src/engine/__tests__/model.test.d.ts`
- `src/engine/__tests__/model.test.js`
- `src/engine/__tests__/model.test.ts`
- `src/engine/__tests__/modelscope-auth.test.d.ts`
- `src/engine/__tests__/modelscope-auth.test.js`
- `src/engine/__tests__/modelscope-auth.test.ts`
- `src/engine/__tests__/stepfun-direct.test.d.ts`
- `src/engine/__tests__/stepfun-direct.test.js`
- `src/engine/__tests__/stepfun-direct.test.ts`
- `src/engine/__tests__/task-decomposer-executor.test.d.ts`
- `src/engine/__tests__/task-decomposer-executor.test.js`
- `src/engine/__tests__/task-decomposer-executor.test.ts`
- `src/engine/__tests__/tools.test.d.ts`
- `src/engine/__tests__/tools.test.js`
- `src/engine/__tests__/tools.test.ts`

</details>

<details><summary><code>src/main/oauth</code> — 21 个</summary>

- `src/main/oauth/adapters/base.d.ts`
- `src/main/oauth/adapters/deepseek.d.ts`
- `src/main/oauth/adapters/glm.d.ts`
- `src/main/oauth/adapters/index.d.ts`
- `src/main/oauth/adapters/kimi.d.ts`
- `src/main/oauth/adapters/mimo.d.ts`
- `src/main/oauth/adapters/minimax.d.ts`
- `src/main/oauth/adapters/perplexity.d.ts`
- `src/main/oauth/adapters/qwen-ai.d.ts`
- `src/main/oauth/adapters/qwen.d.ts`
- `src/main/oauth/adapters/stepfun.d.ts`
- `src/main/oauth/adapters/zai.d.ts`
- `src/main/oauth/guides.d.ts`
- `src/main/oauth/guides.ts`
- `src/main/oauth/inAppLogin.d.ts`
- `src/main/oauth/index.d.ts`
- `src/main/oauth/index.ts`
- `src/main/oauth/kimiSessionManager.d.ts`
- `src/main/oauth/manager.d.ts`
- `src/main/oauth/tokenExtractionConfig.d.ts`
- `src/main/oauth/types.d.ts`

</details>

<details><summary><code>src/renderer/src</code> — 18 个</summary>

- `src/renderer/src/components/logs/LogDetail.tsx`
- `src/renderer/src/components/logs/LogDetailModal.tsx`
- `src/renderer/src/components/logs/LogFilter.tsx`
- `src/renderer/src/components/logs/LogList.tsx`
- `src/renderer/src/components/logs/LogRow.tsx`
- `src/renderer/src/components/logs/LogStats.tsx`
- `src/renderer/src/components/oauth/index.ts`
- `src/renderer/src/components/oauth/LoginDialog.tsx`
- `src/renderer/src/components/oauth/OAuthProgress.tsx`
- `src/renderer/src/components/oauth/TokenInput.tsx`
- `src/renderer/src/components/providers/LoginGuideDialog.tsx`
- `src/renderer/src/hooks/usePerformance.ts`
- `src/renderer/src/pages/Prompts/__tests__/PromptsManagement.test.ts`
- `src/renderer/src/stores/logsStore.ts`
- `src/renderer/src/stores/promptsStore.ts`
- `src/renderer/src/stores/__tests__/promptsStore.test.ts`
- `src/renderer/src/types/electron.d.ts`
- `src/renderer/src/vite-env.d.ts`

</details>

<details><summary><code>src/main/providers</code> — 15 个</summary>

- `src/main/providers/builtin/deepseek.d.ts`
- `src/main/providers/builtin/glm.d.ts`
- `src/main/providers/builtin/index.d.ts`
- `src/main/providers/builtin/kimi.d.ts`
- `src/main/providers/builtin/mimo.d.ts`
- `src/main/providers/builtin/minimax.d.ts`
- `src/main/providers/builtin/perplexity.d.ts`
- `src/main/providers/builtin/qwen-ai.d.ts`
- `src/main/providers/builtin/qwen.d.ts`
- `src/main/providers/builtin/stepfun.d.ts`
- `src/main/providers/builtin/zai.d.ts`
- `src/main/providers/checker.d.ts`
- `src/main/providers/custom.d.ts`
- `src/main/providers/index.d.ts`
- `src/main/providers/index.ts`

</details>

<details><summary><code>src/engine/agent</code> — 14 个</summary>

- `src/engine/agent/command-runners.d.ts`
- `src/engine/agent/command-runners.js`
- `src/engine/agent/coordinator/orchestrator.d.ts`
- `src/engine/agent/coordinator/orchestrator.js`
- `src/engine/agent/coordinator/planner.d.ts`
- `src/engine/agent/coordinator/planner.js`
- `src/engine/agent/coordinator/types.d.ts`
- `src/engine/agent/coordinator/types.js`
- `src/engine/agent/dispatcher.d.ts`
- `src/engine/agent/dispatcher.js`
- `src/engine/agent/task-decomposer.d.ts`
- `src/engine/agent/task-decomposer.js`
- `src/engine/agent/task-executor.d.ts`
- `src/engine/agent/task-executor.js`

</details>

<details><summary><code>src/main/utils</code> — 14 个</summary>

- `src/main/utils/array.ts`
- `src/main/utils/CircularBuffer.ts`
- `src/main/utils/formatBriefTimestamp.ts`
- `src/main/utils/hash.ts`
- `src/main/utils/index.ts`
- `src/main/utils/normalizeModelId.ts`
- `src/main/utils/pMap.ts`
- `src/main/utils/sequential.ts`
- `src/main/utils/set.ts`
- `src/main/utils/slashCommandParsing.ts`
- `src/main/utils/sleep.ts`
- `src/main/utils/stripAnsi.ts`
- `src/main/utils/timeouts.ts`
- `src/main/utils/withResolvers.ts`

</details>

<details><summary><code>src/engine/commands</code> — 9 个</summary>

- `src/engine/commands/impl.d.ts`
- `src/engine/commands/impl.js`
- `src/engine/commands/impl.ts`
- `src/engine/commands/importer.d.ts`
- `src/engine/commands/importer.js`
- `src/engine/commands/registry.d.ts`
- `src/engine/commands/registry.js`
- `src/engine/commands/__tests__/executeCommand.test.ts`
- `src/engine/commands/__tests__/init.test.ts`

</details>

<details><summary><code>src/main/store</code> — 9 个</summary>

- `src/main/store/accounts.d.ts`
- `src/main/store/apiKeySync.d.ts`
- `src/main/store/config.d.ts`
- `src/main/store/index.d.ts`
- `src/main/store/index.ts`
- `src/main/store/providers.d.ts`
- `src/main/store/store.d.ts`
- `src/main/store/types.d.ts`
- `src/main/store/validator.d.ts`

</details>

<details><summary><code>src/__tests__/components</code> — 9 个</summary>

- `src/__tests__/components/CommandPalette.test.tsx`
- `src/__tests__/components/ErrorRecovery.test.tsx`
- `src/__tests__/components/KanbanBoard.test.tsx`
- `src/__tests__/components/MarkdownRenderer.test.tsx`
- `src/__tests__/components/ProgressReport.test.tsx`
- `src/__tests__/components/Sandbox.test.tsx`
- `src/__tests__/components/TimeTracker.test.tsx`
- `src/__tests__/components/ToolErrorBanner.test.tsx`
- `src/__tests__/components/ToolProgressBar.test.tsx`

</details>

<details><summary><code>src/main/security</code> — 7 个</summary>

- `src/main/security/AuditLogger.ts`
- `src/main/security/CommandFilter.ts`
- `src/main/security/CredentialManager.ts`
- `src/main/security/index.ts`
- `src/main/security/InputValidator.ts`
- `src/main/security/OutputSanitizer.ts`
- `src/main/security/PathGuard.ts`

</details>

<details><summary><code>src/main/ipc</code> — 5 个</summary>

- `src/main/ipc/channels.d.ts`
- `src/main/ipc/chat-handlers.d.ts`
- `src/main/ipc/handlers.d.ts`
- `src/main/ipc/index.d.ts`
- `src/main/ipc/index.ts`

</details>

<details><summary><code>src/engine/errors</code> — 4 个</summary>

- `src/engine/errors/classifier.js.map`
- `src/engine/errors/index.js.map`
- `src/engine/errors/recovery.js.map`
- `src/engine/errors/retryHandler.js.map`

</details>

<details><summary><code>src/main/agent</code> — 4 个</summary>

- `src/main/agent/action/sampler.d.ts`
- `src/main/agent/action/types.d.ts`
- `src/main/agent/team/team.d.ts`
- `src/main/agent/team/types.d.ts`

</details>

<details><summary><code>src/main/agents</code> — 4 个</summary>

- `src/main/agents/AgentExecutor.ts`
- `src/main/agents/agentsService.ts`
- `src/main/agents/AgentStore.ts`
- `src/main/agents/index.ts`

</details>

<details><summary><code>src/main/requestLogs</code> — 4 个</summary>

- `src/main/requestLogs/manager.d.ts`
- `src/main/requestLogs/sanitizer.d.ts`
- `src/main/requestLogs/types.d.ts`
- `src/main/requestLogs/__tests__/accountTrend.test.ts`

</details>

<details><summary><code>src/main/tray</code> — 4 个</summary>

- `src/main/tray/index.d.ts`
- `src/main/tray/index.ts`
- `src/main/tray/TrayManager.d.ts`
- `src/main/tray/TrayWindow.d.ts`

</details>

<details><summary><code>src/main/window</code> — 3 个</summary>

- `src/main/window/index.d.ts`
- `src/main/window/index.ts`
- `src/main/window/manager.d.ts`

</details>

<details><summary><code>src/main/__tests__</code> — 3 个</summary>

- `src/main/__tests__/engine-bridge.test.ts`
- `src/main/__tests__/profiles.test.d.ts`
- `src/main/__tests__/profiles.test.ts`

</details>

<details><summary><code>src/engine/api</code> — 2 个</summary>

- `src/engine/api/client.d.ts`
- `src/engine/api/client.js`

</details>

<details><summary><code>src/engine/subagent</code> — 2 个</summary>

- `src/engine/subagent/config.js.map`
- `src/engine/subagent/subAgentManager.js.map`

</details>

<details><summary><code>src/engine/utils</code> — 2 个</summary>

- `src/engine/utils/exec.d.ts`
- `src/engine/utils/exec.js`

</details>

<details><summary><code>src/main/appLogs</code> — 2 个</summary>

- `src/main/appLogs/manager.d.ts`
- `src/main/appLogs/types.d.ts`

</details>

<details><summary><code>src/main/logger</code> — 2 个</summary>

- `src/main/logger/categoryFilter.ts`
- `src/main/logger/manager.d.ts`

</details>

<details><summary><code>src/main/tools</code> — 2 个</summary>

- `src/main/tools/toolsService.ts`
- `src/main/tools/__tests__/toolRuntime.test.ts`

</details>

<details><summary><code>src/main/types</code> — 2 个</summary>

- `src/main/types/ali-oss.d.ts`
- `src/main/types/electron.d.ts`

</details>

<details><summary><code>src/main/updater</code> — 2 个</summary>

- `src/main/updater/index.d.ts`
- `src/main/updater/UpdaterManager.d.ts`

</details>

<details><summary><code>src/engine/cli.d.ts</code> — 1 个</summary>

- `src/engine/cli.d.ts`

</details>

<details><summary><code>src/engine/cli.js</code> — 1 个</summary>

- `src/engine/cli.js`

</details>

<details><summary><code>src/engine/cli.ts</code> — 1 个</summary>

- `src/engine/cli.ts`

</details>

<details><summary><code>src/engine/coders</code> — 1 个</summary>

- `src/engine/coders/editBlockCoder.ts`

</details>

<details><summary><code>src/engine/codeVectorStore.ts</code> — 1 个</summary>

- `src/engine/codeVectorStore.ts`

</details>

<details><summary><code>src/engine/core.d.ts</code> — 1 个</summary>

- `src/engine/core.d.ts`

</details>

<details><summary><code>src/engine/core.js</code> — 1 个</summary>

- `src/engine/core.js`

</details>

<details><summary><code>src/engine/index.d.ts</code> — 1 个</summary>

- `src/engine/index.d.ts`

</details>

<details><summary><code>src/engine/index.js</code> — 1 个</summary>

- `src/engine/index.js`

</details>

<details><summary><code>src/engine/repoMap.ts</code> — 1 个</summary>

- `src/engine/repoMap.ts`

</details>

<details><summary><code>src/engine/services</code> — 1 个</summary>

- `src/engine/services/awaySummary.ts`

</details>

<details><summary><code>src/engine/streaming</code> — 1 个</summary>

- `src/engine/streaming/streamProcessor.js.map`

</details>

<details><summary><code>src/engine/toolGroups.ts</code> — 1 个</summary>

- `src/engine/toolGroups.ts`

</details>

<details><summary><code>src/engine/types.ts</code> — 1 个</summary>

- `src/engine/types.ts`

</details>

<details><summary><code>src/main/data</code> — 1 个</summary>

- `src/main/data/builtin-prompts.d.ts`

</details>

<details><summary><code>src/main/engine-bridge.d.ts</code> — 1 个</summary>

- `src/main/engine-bridge.d.ts`

</details>

<details><summary><code>src/main/index.d.ts</code> — 1 个</summary>

- `src/main/index.d.ts`

</details>

<details><summary><code>src/main/lib</code> — 1 个</summary>

- `src/main/lib/challenge.d.ts`

</details>

<details><summary><code>src/main/otherConfig</code> — 1 个</summary>

- `src/main/otherConfig/otherConfigService.ts`

</details>

<details><summary><code>src/main/plugins</code> — 1 个</summary>

- `src/main/plugins/pluginsService.ts`

</details>

<details><summary><code>src/main/profiles</code> — 1 个</summary>

- `src/main/profiles/manager.d.ts`

</details>

<details><summary><code>src/main/tray.d.ts</code> — 1 个</summary>

- `src/main/tray.d.ts`

</details>

<details><summary><code>src/main/tray.ts</code> — 1 个</summary>

- `src/main/tray.ts`

</details>

<details><summary><code>src/main/workflows</code> — 1 个</summary>

- `src/main/workflows/workflowsService.ts`

</details>

<details><summary><code>src/memory/memory_tool.py</code> — 1 个</summary>

- `src/memory/memory_tool.py`

</details>

<details><summary><code>src/preload/index.d.ts</code> — 1 个</summary>

- `src/preload/index.d.ts`

</details>

<details><summary><code>src/preload/index.js</code> — 1 个</summary>

- `src/preload/index.js`

</details>

<details><summary><code>src/renderer/favicon.png</code> — 1 个</summary>

- `src/renderer/favicon.png`

</details>

<details><summary><code>src/security/AuditLogger.ts</code> — 1 个</summary>

- `src/security/AuditLogger.ts`

</details>

<details><summary><code>src/security/CredentialManager.ts</code> — 1 个</summary>

- `src/security/CredentialManager.ts`

</details>

<details><summary><code>src/security/index.ts</code> — 1 个</summary>

- `src/security/index.ts`

</details>

<details><summary><code>src/security/InputValidator.ts</code> — 1 个</summary>

- `src/security/InputValidator.ts`

</details>

<details><summary><code>src/security/PermissionManager.ts</code> — 1 个</summary>

- `src/security/PermissionManager.ts`

</details>

<details><summary><code>src/security/SandboxExecutor.ts</code> — 1 个</summary>

- `src/security/SandboxExecutor.ts`

</details>

<details><summary><code>src/shared/toolCalling.d.ts</code> — 1 个</summary>

- `src/shared/toolCalling.d.ts`

</details>

<details><summary><code>src/shared/toolCalling.js</code> — 1 个</summary>

- `src/shared/toolCalling.js`

</details>

<details><summary><code>src/shared/types.d.ts</code> — 1 个</summary>

- `src/shared/types.d.ts`

</details>

<details><summary><code>src/shared/types.js</code> — 1 个</summary>

- `src/shared/types.js`

</details>

<details><summary><code>src/utils/diff.ts</code> — 1 个</summary>

- `src/utils/diff.ts`

</details>

<details><summary><code>src/utils/file.js</code> — 1 个</summary>

- `src/utils/file.js`

</details>

<details><summary><code>src/utils/format.ts</code> — 1 个</summary>

- `src/utils/format.ts`

</details>

<details><summary><code>src/utils/stringUtils.ts</code> — 1 个</summary>

- `src/utils/stringUtils.ts`

</details>

<details><summary><code>src/__tests__/main</code> — 1 个</summary>

- `src/__tests__/main/ipc-handlers.test.ts`

</details>
