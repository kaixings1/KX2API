# 代码接入体检报告

生成时间：2026/9/19 11:02:24

三档口径：**应用引用**（从 4 个真实入口可达）／**仅测试引用**／**孤儿**（两边都不可达）。

## 一、仓库顶层

| 顶层项 | 分类 | 文件数 | 大小 | 应用引用 | 说明 |
| --- | --- | ---: | ---: | ---: | --- |
| `legacy/` | 旧代码归档（已移出构建链路） | 3236 | 19.4MB | 0 ⚠️ | 旧代码归档：从 src/ 移出的未接入代码，保留供移植参考，不参与构建 |
| `src/` | 应用运行时 | 632 | 6.1MB | 526 | 主源码 |
| `tests/` | 测试链路 | 81 | 488.6KB | 0 ⚠️ | 测试用例（node:test / 独立脚本两套） |
| `plan/` | 未分类 | 75 | 95.3KB | 0 ⚠️ |  |
| `out/` | 构建/打包 | 62 | 14.1MB | 0 ⚠️ | electron-vite 构建产物（生成物） |
| `batch/` | 未分类 | 59 | 166.8KB | 0 ⚠️ |  |
| `scripts/` | 人工使用（脚本/参考数据） | 28 | 85.3KB | 0 ⚠️ | 构建/发布/自检脚本（npm run 会用到其中部分） |
| `docs/` | 文档 | 27 | 3.3MB | 0 ⚠️ | 文档 |
| `capture/` | 人工使用（脚本/参考数据） | 22 | 86.6KB | 0 ⚠️ | 抓包脚本（配合 Edge 9222 调试端口），手动运行 |
| `tools/` | 人工使用（脚本/参考数据） | 20 | 101.3KB | 0 ⚠️ | 独立工具脚本（tsx 直接运行），未被主程序引用 |
| `project/` | 人工使用（脚本/参考数据） | 17 | 23.7KB | 0 ⚠️ | 独立的小项目/示例，未被主程序引用 |
| `skills/` | 人工使用（脚本/参考数据） | 12 | 25.3KB | 0 ⚠️ | 技能样例数据（可被用户导入，非代码依赖） |
| `build/` | 构建/打包 | 9 | 1.2MB | 0 ⚠️ | 打包资源（icon 等），被 electron-builder 使用 |
| `config/` | 人工使用（脚本/参考数据） | 4 | 1.4KB | 0 ⚠️ | 配置样例/预设，未被代码读取 |
| `self-test-patch-project/` | 人工使用（脚本/参考数据） | 3 | 1.2KB | 0 ⚠️ | 自测用补丁样例项目 |
| `debug.txt` | 生成物/日志（可删） | 1 | 5.5MB | 0 ⚠️ |  |
| `latest` | 生成物/日志（可删） | 1 | 5.5MB | 0 ⚠️ |  |
| `dev/` | 人工使用（脚本/参考数据） | 1 | 990.4KB | 0 ⚠️ | 开发用临时脚本 |
| `package-lock.json` | 构建/打包 | 1 | 356.1KB | 0 ⚠️ | 构建/运行配置 |
| `LICENSE` | 文档 | 1 | 173.9KB | 0 ⚠️ |  |
| `TASK.md` | 文档 | 1 | 95.6KB | 0 ⚠️ |  |
| `stepfun_connect_headers.json` | 一次性产物（可删） | 1 | 38.6KB | 0 ⚠️ |  |
| `stepfun_ws_frames.json` | 一次性产物（可删） | 1 | 17.2KB | 0 ⚠️ |  |
| `loop-response-task-5.json` | 一次性产物（可删） | 1 | 16.2KB | 0 ⚠️ |  |
| `dev.txt` | 未分类 | 1 | 16.2KB | 0 ⚠️ |  |
| `stepfun_session_create.json` | 一次性产物（可删） | 1 | 12.8KB | 0 ⚠️ |  |
| `执行日志.txt` | 未分类 | 1 | 9.8KB | 0 ⚠️ |  |
| `loop-request-task-2-repair-1.json` | 一次性产物（可删） | 1 | 8.5KB | 0 ⚠️ |  |
| `stepfun_api.proto` | 一次性产物（可删） | 1 | 8.0KB | 0 ⚠️ |  |
| `fix_teamtask3.py` | 未分类 | 1 | 7.3KB | 0 ⚠️ |  |
| `CLAUDE.md` | 文档 | 1 | 6.8KB | 0 ⚠️ |  |
| `diagnose_stepfun_auth.js` | 未分类 | 1 | 6.7KB | 0 ⚠️ |  |
| `diagnostic_tool/` | 人工使用（脚本/参考数据） | 1 | 6.3KB | 0 ⚠️ | 诊断脚本（Python） |
| `diagnose_stepfun_auth.cjs` | 一次性产物（可删） | 1 | 5.4KB | 0 ⚠️ |  |
| `loop-request-task-1.json` | 一次性产物（可删） | 1 | 4.7KB | 0 ⚠️ |  |
| `diagnose_token_expiry.cjs` | 一次性产物（可删） | 1 | 4.2KB | 0 ⚠️ |  |
| `check-repo-result.txt` | 未分类 | 1 | 4.0KB | 0 ⚠️ |  |
| `diagnose_token_parse.cjs` | 一次性产物（可删） | 1 | 3.9KB | 0 ⚠️ |  |
| `fix_teamtask2.py` | 未分类 | 1 | 3.9KB | 0 ⚠️ |  |
| `fix_teamtask.py` | 未分类 | 1 | 3.9KB | 0 ⚠️ |  |
| `PLANNING.md` | 文档 | 1 | 3.4KB | 0 ⚠️ |  |
| `REFACTOR_PLAN.md` | 文档 | 1 | 2.3KB | 0 ⚠️ |  |
| `stepfun_chatstream_capture.json` | 一次性产物（可删） | 1 | 2.1KB | 0 ⚠️ |  |
| `electron.vite.config.ts` | 构建/打包 | 1 | 1.8KB | 0 ⚠️ | 构建/运行配置 |
| `check-result.txt` | 未分类 | 1 | 1.2KB | 0 ⚠️ |  |
| `tsconfig.check.json` | 未分类 | 1 | 1.1KB | 0 ⚠️ |  |
| `tool_queue_extractor/` | 人工使用（脚本/参考数据） | 1 | 1.1KB | 0 ⚠️ | 抓包用的工具队列提取器（Python） |
| `vitest.config.ts` | 构建/打包 | 1 | 1.0KB | 0 ⚠️ | 构建/运行配置 |
| `check-index.mjs` | 未分类 | 1 | 920B | 0 ⚠️ |  |
| `README.md` | 文档 | 1 | 731B | 0 ⚠️ |  |
| `tailwind.config.ts` | 构建/打包 | 1 | 581B | 0 ⚠️ | 构建/运行配置 |
| `__search_tmp.py` | 一次性产物（可删） | 1 | 365B | 0 ⚠️ |  |
| `check-utils-orphan.mjs` | 未分类 | 1 | 327B | 0 ⚠️ |  |
| `check-utils.mjs` | 未分类 | 1 | 317B | 0 ⚠️ |  |
| `run_prod.bat` | 构建/打包 | 1 | 185B | 0 ⚠️ | 构建/运行配置 |
| `test-invoke.mjs` | 未分类 | 1 | 149B | 0 ⚠️ |  |
| `test-invoke.ts` | 未分类 | 1 | 149B | 0 ⚠️ |  |
| `run.bat` | 构建/打包 | 1 | 132B | 0 ⚠️ | 构建/运行配置 |
| `postcss.config.cjs` | 构建/打包 | 1 | 82B | 0 ⚠️ | 构建/运行配置 |
| `0` | 生成物/日志（可删） | 1 | 0B | 0 ⚠️ |  |
| `package.json` | 构建/打包 | 1 | 5.1KB | 1 | 构建/运行配置 |

## 二、src/ 各目录接入情况

| 目录 | 文件数 | 应用引用 | 仅测试 | 孤儿 |
| --- | ---: | ---: | ---: | ---: |
| `src/main` | 242 | 211 | 0 | 31 |
| `src/renderer` | 166 | 159 | 0 | 7 |
| `src/engine` | 155 | 139 | 0 | 16 |
| `src/__tests__` | 49 | 0 | 0 | 49 |
| `src/security` | 8 | 8 | 0 | 0 |
| `src/shared` | 5 | 5 | 0 | 0 |
| `src/preload` | 2 | 1 | 0 | 1 |
| `src/utils` | 2 | 2 | 0 | 0 |
| `src/generated` | 1 | 0 | 0 | 1 |
| `src/globals.d.ts` | 1 | 0 | 0 | 1 |
| `src/memory` | 1 | 1 | 0 | 0 |

## 三、孤儿文件清单（106 个）

<details><summary><code>src/__tests__/engine</code> — 28 个</summary>

- `src/__tests__/engine/absorb.test.ts`
- `src/__tests__/engine/autoMemory.test.ts`
- `src/__tests__/engine/claudeMdLoader.test.ts`
- `src/__tests__/engine/compactCoordinator.test.ts`
- `src/__tests__/engine/compactPrompt.test.ts`
- `src/__tests__/engine/coordinator.test.ts`
- `src/__tests__/engine/imageBudget.test.ts`
- `src/__tests__/engine/jsonSchemaRepair.test.ts`
- `src/__tests__/engine/loopConfig.test.ts`
- `src/__tests__/engine/memoryRecallLimits.test.ts`
- `src/__tests__/engine/memorySurfaceBudget.test.ts`
- `src/__tests__/engine/memoryToolRecall.test.ts`
- `src/__tests__/engine/pauseAndCircuit.test.ts`
- `src/__tests__/engine/permissionRules.test.ts`
- `src/__tests__/engine/preAnalysis.test.ts`
- `src/__tests__/engine/promptSections.test.ts`
- `src/__tests__/engine/promptSectionsMemo.test.ts`
- `src/__tests__/engine/repoMap.test.ts`
- `src/__tests__/engine/securityEnhancerAudit.test.ts`
- `src/__tests__/engine/sessionMemory.test.ts`
- `src/__tests__/engine/sessionRecovery.test.ts`
- `src/__tests__/engine/subAgentIsolation.test.ts`
- `src/__tests__/engine/task-decomposer-executor.test.ts`
- `src/__tests__/engine/toolErrorFormat.test.ts`
- `src/__tests__/engine/toolHistoryGuard.test.ts`
- `src/__tests__/engine/toolHooksWiring.test.ts`
- `src/__tests__/engine/toolResultStore.test.ts`
- `src/__tests__/engine/transcript.test.ts`

</details>

<details><summary><code>src/main/utils</code> — 11 个</summary>

- `src/main/utils/array.ts`
- `src/main/utils/CircularBuffer.ts`
- `src/main/utils/formatBriefTimestamp.ts`
- `src/main/utils/hash.ts`
- `src/main/utils/normalizeModelId.ts`
- `src/main/utils/sequential.ts`
- `src/main/utils/set.ts`
- `src/main/utils/slashCommandParsing.ts`
- `src/main/utils/sleep.ts`
- `src/main/utils/timeouts.ts`
- `src/main/utils/withResolvers.ts`

</details>

<details><summary><code>src/__tests__/main</code> — 11 个</summary>

- `src/__tests__/main/defaultData.test.ts`
- `src/__tests__/main/hooks.test.ts`
- `src/__tests__/main/ipc-handlers.test.ts`
- `src/__tests__/main/ipcChannelConsistency.test.ts`
- `src/__tests__/main/loadBalancerConfig.test.ts`
- `src/__tests__/main/permissionConfig.test.ts`
- `src/__tests__/main/preloadChannelGuard.test.ts`
- `src/__tests__/main/proxyRuntimeLimits.test.ts`
- `src/__tests__/main/textRuntimeLimits.test.ts`
- `src/__tests__/main/toolSessionStore.test.ts`
- `src/__tests__/main/variantSelector.test.ts`

</details>

<details><summary><code>src/__tests__/components</code> — 10 个</summary>

- `src/__tests__/components/CommandPalette.test.tsx`
- `src/__tests__/components/ErrorRecovery.test.tsx`
- `src/__tests__/components/KanbanBoard.test.tsx`
- `src/__tests__/components/LogsPageIntegration.test.ts`
- `src/__tests__/components/MarkdownRenderer.test.tsx`
- `src/__tests__/components/ProgressReport.test.tsx`
- `src/__tests__/components/Sandbox.test.tsx`
- `src/__tests__/components/TimeTracker.test.tsx`
- `src/__tests__/components/ToolErrorBanner.test.tsx`
- `src/__tests__/components/ToolProgressBar.test.tsx`

</details>

<details><summary><code>src/engine/__tests__</code> — 9 个</summary>

- `src/engine/__tests__/client.test.ts`
- `src/engine/__tests__/e2e-all-profiles.test.ts`
- `src/engine/__tests__/e2e-chat.test.ts`
- `src/engine/__tests__/engine.test.ts`
- `src/engine/__tests__/integration.test.ts`
- `src/engine/__tests__/model.test.ts`
- `src/engine/__tests__/modelscope-auth.test.ts`
- `src/engine/__tests__/stepfun-direct.test.ts`
- `src/engine/__tests__/tools.test.ts`

</details>

<details><summary><code>src/main/tools</code> — 6 个</summary>

- `src/main/tools/toolExecutor.ts`
- `src/main/tools/toolFileStoreManager.ts`
- `src/main/tools/__tests__/toolFileStore.test.ts`
- `src/main/tools/__tests__/toolManager.test.ts`
- `src/main/tools/__tests__/toolRuntime.test.ts`
- `src/main/tools/__tests__/toolRuntimeV2.test.ts`

</details>

<details><summary><code>src/renderer/src</code> — 6 个</summary>

- `src/renderer/src/pages/McpManagement/__tests__/McpManagement.test.ts`
- `src/renderer/src/pages/Prompts/__tests__/PromptsManagement.test.ts`
- `src/renderer/src/pages/TaskManagement/__tests__/TaskManagement.test.ts`
- `src/renderer/src/pages/ToolManagement/__tests__/ToolManagement.test.ts`
- `src/renderer/src/types/electron.d.ts`
- `src/renderer/src/vite-env.d.ts`

</details>

<details><summary><code>src/main/proxy</code> — 5 个</summary>

- `src/main/proxy/toolCalling/browserToolExtractor.ts`
- `src/main/proxy/toolCalling/toolChoicePolicy.ts`
- `src/main/proxy/toolCalling/__tests__/managedXml.toolname.test.ts`
- `src/main/proxy/utils/__tests__/streamQueueDetector.smoke.ts`
- `src/main/proxy/__tests__/apiKeyAuth.test.ts`

</details>

<details><summary><code>src/main/types</code> — 3 个</summary>

- `src/main/types/ali-oss.d.ts`
- `src/main/types/electron.d.ts`
- `src/main/types/zstd-codec.d.ts`

</details>

<details><summary><code>src/engine/commands</code> — 2 个</summary>

- `src/engine/commands/__tests__/executeCommand.test.ts`
- `src/engine/commands/__tests__/init.test.ts`

</details>

<details><summary><code>src/engine/tool-history-guard</code> — 2 个</summary>

- `src/engine/tool-history-guard/fix.ts`
- `src/engine/tool-history-guard/index.ts`

</details>

<details><summary><code>src/main/requestLogs</code> — 2 个</summary>

- `src/main/requestLogs/sanitizer.d.ts`
- `src/main/requestLogs/__tests__/accountTrend.test.ts`

</details>

<details><summary><code>src/main/__tests__</code> — 2 个</summary>

- `src/main/__tests__/engine-bridge.test.ts`
- `src/main/__tests__/profiles.test.ts`

</details>

<details><summary><code>src/engine/hooks</code> — 1 个</summary>

- `src/engine/hooks/index.ts`

</details>

<details><summary><code>src/engine/orchestrator</code> — 1 个</summary>

- `src/engine/orchestrator/index.ts`

</details>

<details><summary><code>src/engine/token-counter</code> — 1 个</summary>

- `src/engine/token-counter/__tests__/index.test.ts`

</details>

<details><summary><code>src/generated/globals.d.ts</code> — 1 个</summary>

- `src/generated/globals.d.ts`

</details>

<details><summary><code>src/globals.d.ts</code> — 1 个</summary>

- `src/globals.d.ts`

</details>

<details><summary><code>src/main/logger</code> — 1 个</summary>

- `src/main/logger/categoryFilter.ts`

</details>

<details><summary><code>src/main/oauth</code> — 1 个</summary>

- `src/main/oauth/__tests__/stepfun-session-token.test.ts`

</details>

<details><summary><code>src/preload/index.d.ts</code> — 1 个</summary>

- `src/preload/index.d.ts`

</details>

<details><summary><code>src/renderer/favicon.png</code> — 1 个</summary>

- `src/renderer/favicon.png`

</details>
