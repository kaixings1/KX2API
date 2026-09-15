# 代码接入体检报告

生成时间：2026/9/15 19:13:53

三档口径：**应用引用**（从 4 个真实入口可达）／**仅测试引用**／**孤儿**（两边都不可达）。

## 一、仓库顶层

| 顶层项 | 分类 | 文件数 | 大小 | 应用引用 | 说明 |
| --- | --- | ---: | ---: | ---: | --- |
| `src2026/` | 历史副本（可删） | 3742 | 25.4MB | 0 ⚠️ | 历史备份副本（旧版本源码） |
| `src--/` | 历史副本（可删） | 3741 | 25.3MB | 0 ⚠️ | 历史备份副本（旧版本源码） |
| `src20260914/` | 历史副本（可删） | 3740 | 25.3MB | 0 ⚠️ | 历史备份副本（旧版本源码） |
| `src/` | 应用运行时 | 3674 | 24.7MB | 377 | 主源码 |
| `release/` | 生成物/日志（可删） | 79 | 455.3MB | 0 ⚠️ | electron-builder 打包产物（生成物） |
| `tests/` | 测试链路 | 50 | 295.8KB | 0 ⚠️ | 测试用例（node:test / 独立脚本两套） |
| `out/` | 构建/打包 | 41 | 13.7MB | 0 ⚠️ | electron-vite 构建产物（生成物） |
| `docs/` | 文档 | 27 | 3.5MB | 0 ⚠️ | 文档 |
| `capture/` | 人工使用（脚本/参考数据） | 22 | 86.6KB | 0 ⚠️ | 抓包脚本（配合 Edge 9222 调试端口），手动运行 |
| `project/` | 人工使用（脚本/参考数据） | 17 | 23.7KB | 0 ⚠️ | 独立的小项目/示例，未被主程序引用 |
| `skills/` | 人工使用（脚本/参考数据） | 12 | 25.3KB | 0 ⚠️ | 技能样例数据（可被用户导入，非代码依赖） |
| `tools/` | 人工使用（脚本/参考数据） | 10 | 72.8KB | 0 ⚠️ | 独立工具脚本（tsx 直接运行），未被主程序引用 |
| `scripts/` | 人工使用（脚本/参考数据） | 10 | 52.7KB | 0 ⚠️ | 构建/发布/自检脚本（npm run 会用到其中部分） |
| `build/` | 构建/打包 | 9 | 1.2MB | 0 ⚠️ | 打包资源（icon 等），被 electron-builder 使用 |
| `config/` | 人工使用（脚本/参考数据） | 4 | 1.4KB | 0 ⚠️ | 配置样例/预设，未被代码读取 |
| `self-test-patch-project/` | 人工使用（脚本/参考数据） | 3 | 1.2KB | 0 ⚠️ | 自测用补丁样例项目 |
| `0` | 生成物/日志（可删） | 1 | 39.8MB | 0 ⚠️ |  |
| `debug.txt` | 生成物/日志（可删） | 1 | 38.9MB | 0 ⚠️ |  |
| `latest` | 生成物/日志（可删） | 1 | 38.9MB | 0 ⚠️ |  |
| `src20260914.rar` | 历史副本（可删） | 1 | 8.5MB | 0 ⚠️ |  |
| `src20260913.rar` | 历史副本（可删） | 1 | 8.4MB | 0 ⚠️ |  |
| `_stepfun_5229.js` | 一次性产物（可删） | 1 | 526.8KB | 0 ⚠️ |  |
| `dev/` | 人工使用（脚本/参考数据） | 1 | 467.9KB | 0 ⚠️ | 开发用临时脚本 |
| `package-lock.json` | 构建/打包 | 1 | 341.0KB | 0 ⚠️ | 构建/运行配置 |
| `_stepfun_7875.js` | 一次性产物（可删） | 1 | 324.3KB | 0 ⚠️ |  |
| `_stepfun_5893.js` | 一次性产物（可删） | 1 | 191.3KB | 0 ⚠️ |  |
| `_stepfun_793.js` | 一次性产物（可删） | 1 | 187.8KB | 0 ⚠️ |  |
| `LICENSE` | 文档 | 1 | 173.9KB | 0 ⚠️ |  |
| `_stepfun_7957.js` | 一次性产物（可删） | 1 | 129.5KB | 0 ⚠️ |  |
| `_stepfun_5845.js` | 一次性产物（可删） | 1 | 115.5KB | 0 ⚠️ |  |
| `_stepfun_2721.js` | 一次性产物（可删） | 1 | 114.9KB | 0 ⚠️ |  |
| `chat_stepfun.html` | 一次性产物（可删） | 1 | 108.2KB | 0 ⚠️ |  |
| `_stepfun_page.html` | 一次性产物（可删） | 1 | 108.2KB | 0 ⚠️ |  |
| `_stepfun_7830.js` | 一次性产物（可删） | 1 | 106.4KB | 0 ⚠️ |  |
| `_stepfun_4432.js` | 一次性产物（可删） | 1 | 98.1KB | 0 ⚠️ |  |
| `_stepfun_8963.js` | 一次性产物（可删） | 1 | 87.6KB | 0 ⚠️ |  |
| `_stepfun_9433.js` | 一次性产物（可删） | 1 | 77.5KB | 0 ⚠️ |  |
| `_stepfun_1056.js` | 一次性产物（可删） | 1 | 74.3KB | 0 ⚠️ |  |
| `log.txt` | 生成物/日志（可删） | 1 | 48.8KB | 0 ⚠️ |  |
| `_stepfun_2443.js` | 一次性产物（可删） | 1 | 46.4KB | 0 ⚠️ |  |
| `_inspect_send.txt` | 一次性产物（可删） | 1 | 45.5KB | 0 ⚠️ |  |
| `_stepfun_8554.js` | 一次性产物（可删） | 1 | 41.7KB | 0 ⚠️ |  |
| `_stepfun_1004.js` | 一次性产物（可删） | 1 | 40.8KB | 0 ⚠️ |  |
| `_analysis_result.txt` | 一次性产物（可删） | 1 | 40.3KB | 0 ⚠️ |  |
| `stepfun_connect_headers.json` | 一次性产物（可删） | 1 | 38.6KB | 0 ⚠️ |  |
| `_stepfun_1374.js` | 一次性产物（可删） | 1 | 36.9KB | 0 ⚠️ |  |
| `isolated_files.txt` | 一次性产物（可删） | 1 | 33.7KB | 0 ⚠️ |  |
| `_stepfun_4859.js` | 一次性产物（可删） | 1 | 28.8KB | 0 ⚠️ |  |
| `_analysis_result2.txt` | 一次性产物（可删） | 1 | 27.6KB | 0 ⚠️ |  |
| `3029-8512adc0ad4af812.js` | 未分类 | 1 | 26.8KB | 0 ⚠️ |  |
| `_stepfun_3029.js` | 一次性产物（可删） | 1 | 26.8KB | 0 ⚠️ |  |
| `_stepfun_6689.js` | 一次性产物（可删） | 1 | 26.0KB | 0 ⚠️ |  |
| `_inspect_result.txt` | 一次性产物（可删） | 1 | 25.5KB | 0 ⚠️ |  |
| `_stepfun_8759.js` | 一次性产物（可删） | 1 | 25.0KB | 0 ⚠️ |  |
| `_inspect2.txt` | 一次性产物（可删） | 1 | 21.7KB | 0 ⚠️ |  |
| `_stepfun_3876.js` | 一次性产物（可删） | 1 | 20.2KB | 0 ⚠️ |  |
| `loop-response-task-4.json` | 一次性产物（可删） | 1 | 17.8KB | 0 ⚠️ |  |
| `out_test/` | 生成物/日志（可删） | 1 | 17.7KB | 0 ⚠️ | 旧的测试构建产物（生成物） |
| `stepfun_ws_frames.json` | 一次性产物（可删） | 1 | 17.2KB | 0 ⚠️ |  |
| `_stepfun_7371.js` | 一次性产物（可删） | 1 | 15.0KB | 0 ⚠️ |  |
| `_stepfun_4943.js` | 一次性产物（可删） | 1 | 13.7KB | 0 ⚠️ |  |
| `stepfun_session_create.json` | 一次性产物（可删） | 1 | 12.8KB | 0 ⚠️ |  |
| `loop-response-task-3.json` | 一次性产物（可删） | 1 | 12.3KB | 0 ⚠️ |  |
| `loop-request-task-6.json` | 一次性产物（可删） | 1 | 12.1KB | 0 ⚠️ |  |
| `loop-request-task-5.json` | 一次性产物（可删） | 1 | 11.8KB | 0 ⚠️ |  |
| `_stepfun_3251.js` | 一次性产物（可删） | 1 | 11.4KB | 0 ⚠️ |  |
| `loop-request-task-4.json` | 一次性产物（可删） | 1 | 9.7KB | 0 ⚠️ |  |
| `loop-request-task-3.json` | 一次性产物（可删） | 1 | 9.1KB | 0 ⚠️ |  |
| `analyze_isolated_final.py` | 未分类 | 1 | 9.0KB | 0 ⚠️ |  |
| `loop-request-task-2.json` | 一次性产物（可删） | 1 | 8.7KB | 0 ⚠️ |  |
| `analyze_isolated_v4.py` | 未分类 | 1 | 8.1KB | 0 ⚠️ |  |
| `stepfun_api.proto` | 一次性产物（可删） | 1 | 8.0KB | 0 ⚠️ |  |
| `TASK.md` | 文档 | 1 | 7.9KB | 0 ⚠️ |  |
| `analyze_isolated.py` | 未分类 | 1 | 7.8KB | 0 ⚠️ |  |
| `_stepfun_223.js` | 一次性产物（可删） | 1 | 7.6KB | 0 ⚠️ |  |
| `analyze_isolated_v2.py` | 未分类 | 1 | 7.6KB | 0 ⚠️ |  |
| `diagnose_stepfun_auth.js` | 未分类 | 1 | 6.7KB | 0 ⚠️ |  |
| `_stepfun_5739.js` | 一次性产物（可删） | 1 | 6.5KB | 0 ⚠️ |  |
| `diagnostic_tool/` | 人工使用（脚本/参考数据） | 1 | 6.3KB | 0 ⚠️ | 诊断脚本（Python） |
| `analyze_isolated_v3.py` | 未分类 | 1 | 6.3KB | 0 ⚠️ |  |
| `_analyze3.py` | 一次性产物（可删） | 1 | 5.9KB | 0 ⚠️ |  |
| `CLAUDE.md` | 文档 | 1 | 5.5KB | 0 ⚠️ |  |
| `diagnose_stepfun_auth.cjs` | 一次性产物（可删） | 1 | 5.4KB | 0 ⚠️ |  |
| `_analyze6.py` | 一次性产物（可删） | 1 | 5.3KB | 0 ⚠️ |  |
| `loop-request-task-1.json` | 一次性产物（可删） | 1 | 5.3KB | 0 ⚠️ |  |
| `_analyze5.py` | 一次性产物（可删） | 1 | 5.1KB | 0 ⚠️ |  |
| `_analyze4.py` | 一次性产物（可删） | 1 | 4.5KB | 0 ⚠️ |  |
| `diagnose_token_expiry.cjs` | 一次性产物（可删） | 1 | 4.2KB | 0 ⚠️ |  |
| `diagnose_token_parse.cjs` | 一次性产物（可删） | 1 | 3.9KB | 0 ⚠️ |  |
| `PLANNING.md` | 文档 | 1 | 3.4KB | 0 ⚠️ |  |
| `audit_orphans.py` | 未分类 | 1 | 2.7KB | 0 ⚠️ |  |
| `_inspect_js.py` | 一次性产物（可删） | 1 | 2.6KB | 0 ⚠️ |  |
| `_analyze2.py` | 一次性产物（可删） | 1 | 2.5KB | 0 ⚠️ |  |
| `_inspect_proto.py` | 一次性产物（可删） | 1 | 2.3KB | 0 ⚠️ |  |
| `REFACTOR_PLAN.md` | 文档 | 1 | 2.3KB | 0 ⚠️ |  |
| `stepfun_chatstream_capture.json` | 一次性产物（可删） | 1 | 2.1KB | 0 ⚠️ |  |
| `_fetch_chunks.py` | 一次性产物（可删） | 1 | 2.1KB | 0 ⚠️ |  |
| `_inspect_send.py` | 一次性产物（可删） | 1 | 1.8KB | 0 ⚠️ |  |
| `electron.vite.config.ts` | 构建/打包 | 1 | 1.6KB | 0 ⚠️ | 构建/运行配置 |
| `_find_connect.py` | 一次性产物（可删） | 1 | 1.6KB | 0 ⚠️ |  |
| `loop-response-task-1.json` | 一次性产物（可删） | 1 | 1.5KB | 0 ⚠️ |  |
| `_find_send2.py` | 一次性产物（可删） | 1 | 1.5KB | 0 ⚠️ |  |
| `_find_regenerate.py` | 一次性产物（可删） | 1 | 1.5KB | 0 ⚠️ |  |
| `_find_send.py` | 一次性产物（可删） | 1 | 1.3KB | 0 ⚠️ |  |
| `_find_r1.py` | 一次性产物（可删） | 1 | 1.3KB | 0 ⚠️ |  |
| `_find_serialize.py` | 一次性产物（可删） | 1 | 1.3KB | 0 ⚠️ |  |
| `_find_chat_msg.py` | 一次性产物（可删） | 1 | 1.3KB | 0 ⚠️ |  |
| `_find_cr2.py` | 一次性产物（可删） | 1 | 1.2KB | 0 ⚠️ |  |
| `_find_cr.py` | 一次性产物（可删） | 1 | 1.1KB | 0 ⚠️ |  |
| `tool_queue_extractor/` | 人工使用（脚本/参考数据） | 1 | 1.1KB | 0 ⚠️ | 抓包用的工具队列提取器（Python） |
| `test-commands.ts` | 未分类 | 1 | 1.0KB | 0 ⚠️ |  |
| `vitest.config.ts` | 构建/打包 | 1 | 1.0KB | 0 ⚠️ | 构建/运行配置 |
| `_find_send_wrapper.py` | 一次性产物（可删） | 1 | 1008B | 0 ⚠️ |  |
| `_find_yI.py` | 一次性产物（可删） | 1 | 1007B | 0 ⚠️ |  |
| `_find_service.py` | 一次性产物（可删） | 1 | 958B | 0 ⚠️ |  |
| `filter_isolated.py` | 未分类 | 1 | 942B | 0 ⚠️ |  |
| `_find_delta.py` | 一次性产物（可删） | 1 | 904B | 0 ⚠️ |  |
| `_find_d5.py` | 一次性产物（可删） | 1 | 801B | 0 ⚠️ |  |
| `README.md` | 文档 | 1 | 731B | 0 ⚠️ |  |
| `main-app-dc94571071f7af06.js` | 未分类 | 1 | 588B | 0 ⚠️ |  |
| `_stepfun_main_app.js` | 一次性产物（可删） | 1 | 588B | 0 ⚠️ |  |
| `_extract_js.py` | 一次性产物（可删） | 1 | 419B | 0 ⚠️ |  |
| `_verify.cjs` | 一次性产物（可删） | 1 | 328B | 0 ⚠️ |  |
| `_decode_error.py` | 一次性产物（可删） | 1 | 298B | 0 ⚠️ |  |
| `commit_msg.txt` | 未分类 | 1 | 297B | 0 ⚠️ |  |
| `amend_msg.txt` | 未分类 | 1 | 280B | 0 ⚠️ |  |
| `tailwind.config.ts` | 构建/打包 | 1 | 280B | 0 ⚠️ | 构建/运行配置 |
| `decode_webid.py` | 未分类 | 1 | 215B | 0 ⚠️ |  |
| `decode_webid.js` | 未分类 | 1 | 201B | 0 ⚠️ |  |
| `run_prod.bat` | 构建/打包 | 1 | 185B | 0 ⚠️ | 构建/运行配置 |
| `postcss.config.cjs` | 构建/打包 | 1 | 82B | 0 ⚠️ | 构建/运行配置 |
| `run.bat` | 构建/打包 | 1 | 79B | 0 ⚠️ | 构建/运行配置 |
| `loop-response-task-2.json` | 一次性产物（可删） | 1 | 74B | 0 ⚠️ |  |
| `Cookies` | 一次性产物（可删） | 1 | 66B | 0 ⚠️ |  |
| `loop-response-task-5.json` | 一次性产物（可删） | 1 | 38B | 0 ⚠️ |  |
| `loop-response-task-6.json` | 一次性产物（可删） | 1 | 38B | 0 ⚠️ |  |
| `trace.log` | 生成物/日志（可删） | 1 | 36B | 0 ⚠️ |  |
| `package.json` | 构建/打包 | 1 | 4.2KB | 1 | 构建/运行配置 |
| `logs/` | 生成物/日志（可删） | 0 | 0B | 0 ⚠️ | 运行时日志输出目录 |

## 二、src/ 各目录接入情况

| 目录 | 文件数 | 应用引用 | 仅测试 | 孤儿 |
| --- | ---: | ---: | ---: | ---: |
| `src/commands` | 682 | 0 | 0 | 682 |
| `src/main` | 466 | 192 | 0 | 274 |
| `src/tools` | 430 | 0 | 0 | 430 |
| `src/components` | 419 | 0 | 0 | 419 |
| `src/skills` | 413 | 0 | 0 | 413 |
| `src/services` | 274 | 0 | 0 | 274 |
| `src/ink` | 166 | 0 | 0 | 166 |
| `src/renderer` | 152 | 135 | 0 | 17 |
| `src/engine` | 120 | 40 | 0 | 80 |
| `src/hooks` | 114 | 0 | 0 | 114 |
| `src/bridge` | 58 | 0 | 0 | 58 |
| `src/cli` | 33 | 0 | 0 | 33 |
| `src/entrypoints` | 26 | 0 | 0 | 26 |
| `src/keybindings` | 25 | 0 | 0 | 25 |
| `src/tasks` | 23 | 0 | 0 | 23 |
| `src/memdir` | 18 | 0 | 0 | 18 |
| `src/buddy` | 13 | 0 | 0 | 13 |
| `src/performance` | 13 | 0 | 0 | 13 |
| `src/query` | 12 | 0 | 0 | 12 |
| `src/server` | 12 | 0 | 0 | 12 |
| `src/migrations` | 11 | 0 | 0 | 11 |
| `src/__tests__` | 10 | 0 | 0 | 10 |
| `src/api` | 9 | 0 | 0 | 9 |
| `src/context` | 9 | 0 | 0 | 9 |
| `src/security` | 9 | 3 | 0 | 6 |
| `src/state` | 9 | 0 | 0 | 9 |
| `src/assistant` | 8 | 0 | 0 | 8 |
| `src/plugins` | 8 | 0 | 0 | 8 |
| `src/shared` | 8 | 4 | 0 | 4 |
| `src/features` | 7 | 0 | 0 | 7 |
| `src/native-ts` | 7 | 0 | 0 | 7 |
| `src/utils` | 5 | 1 | 0 | 4 |
| `src/vim` | 5 | 0 | 0 | 5 |
| `src/coordinator` | 4 | 0 | 0 | 4 |
| `src/generated` | 4 | 0 | 0 | 4 |
| `src/remote` | 4 | 0 | 0 | 4 |
| `src/screens` | 4 | 0 | 0 | 4 |
| `src/preload` | 3 | 1 | 0 | 2 |
| `src/proactive` | 3 | 0 | 0 | 3 |
| `src/bootstrap` | 2 | 0 | 0 | 2 |
| `src/daemon` | 2 | 0 | 0 | 2 |
| `src/jobs` | 2 | 0 | 0 | 2 |
| `src/memory` | 2 | 1 | 0 | 1 |
| `src/outputStyles` | 2 | 0 | 0 | 2 |
| `src/polyfills` | 2 | 0 | 0 | 2 |
| `src/schemas` | 2 | 0 | 0 | 2 |
| `src/ssh` | 2 | 0 | 0 | 2 |
| `src/upstreamproxy` | 2 | 0 | 0 | 2 |
| `src/voice` | 2 | 0 | 0 | 2 |
| `src/auto-wrapper.ts` | 1 | 0 | 0 | 1 |
| `src/bootstrap-entry.ts` | 1 | 0 | 0 | 1 |
| `src/bootstrapMacro.ts` | 1 | 0 | 0 | 1 |
| `src/commands.ts` | 1 | 0 | 0 | 1 |
| `src/constants` | 1 | 0 | 0 | 1 |
| `src/context.ts` | 1 | 0 | 0 | 1 |
| `src/cost-tracker.ts` | 1 | 0 | 0 | 1 |
| `src/costHook.ts` | 1 | 0 | 0 | 1 |
| `src/desktop-bun` | 1 | 0 | 0 | 1 |
| `src/desktop-commands.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-context.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-core.ts` | 1 | 0 | 0 | 1 |
| `src/desktop-cost-tracker.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-dialogLaunchers.tsx` | 1 | 0 | 0 | 1 |
| `src/desktop-electron` | 1 | 0 | 0 | 1 |
| `src/desktop-history.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-index.ts` | 1 | 0 | 0 | 1 |
| `src/desktop-ink.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-projectOnboardingState.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-query--org.ts--` | 1 | 0 | 0 | 1 |
| `src/desktop-query.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-Task.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-tasks.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-Tool.js.map` | 1 | 0 | 0 | 1 |
| `src/desktop-tools.js.map` | 1 | 0 | 0 | 1 |
| `src/dev` | 1 | 0 | 0 | 1 |
| `src/dev-entry.ts` | 1 | 0 | 0 | 1 |
| `src/environment-runner` | 1 | 0 | 0 | 1 |
| `src/feature-repository.ts` | 1 | 0 | 0 | 1 |
| `src/globals.d.ts` | 1 | 0 | 0 | 1 |
| `src/GrowthBook.ts` | 1 | 0 | 0 | 1 |
| `src/GrowthBookClient.ts` | 1 | 0 | 0 | 1 |
| `src/history.ts` | 1 | 0 | 0 | 1 |
| `src/ink.ts` | 1 | 0 | 0 | 1 |
| `src/interactiveHelpers.tsx` | 1 | 0 | 0 | 1 |
| `src/main.py` | 1 | 0 | 0 | 1 |
| `src/main.tsx` | 1 | 0 | 0 | 1 |
| `src/mongrule.ts` | 1 | 0 | 0 | 1 |
| `src/moreright` | 1 | 0 | 0 | 1 |
| `src/projectOnboardingState.ts` | 1 | 0 | 0 | 1 |
| `src/query.ts` | 1 | 0 | 0 | 1 |
| `src/QueryEngine.ts` | 1 | 0 | 0 | 1 |
| `src/replLauncher.tsx` | 1 | 0 | 0 | 1 |
| `src/self-hosted-runner` | 1 | 0 | 0 | 1 |
| `src/setup.ts` | 1 | 0 | 0 | 1 |
| `src/shims` | 1 | 0 | 0 | 1 |
| `src/source-manager.ts` | 1 | 0 | 0 | 1 |
| `src/sticky-bucket-service.ts` | 1 | 0 | 0 | 1 |
| `src/stubs` | 1 | 0 | 0 | 1 |
| `src/Task.ts` | 1 | 0 | 0 | 1 |
| `src/tasks.ts` | 1 | 0 | 0 | 1 |
| `src/token_queue.py` | 1 | 0 | 0 | 1 |
| `src/Tool.ts` | 1 | 0 | 0 | 1 |
| `src/tools.ts` | 1 | 0 | 0 | 1 |
| `src/tool_extractor.py` | 1 | 0 | 0 | 1 |
| `src/types` | 1 | 0 | 0 | 1 |
| `src/util.ts` | 1 | 0 | 0 | 1 |
| `src/__init__.py` | 1 | 0 | 0 | 1 |

## 三、孤儿文件清单（3297 个）

<details><summary><code>src/skills/bundled</code> — 405 个</summary>

- `src/skills/bundled/askMatt.ts`
- `src/skills/bundled/batch.ts`
- `src/skills/bundled/bundledSkillsSummary.ts`
- `src/skills/bundled/claude-api/csharp/claude-api.md`
- `src/skills/bundled/claude-api/curl/examples.md`
- `src/skills/bundled/claude-api/go/claude-api.md`
- `src/skills/bundled/claude-api/java/claude-api.md`
- `src/skills/bundled/claude-api/php/claude-api.md`
- `src/skills/bundled/claude-api/python/agent-sdk/patterns.md`
- `src/skills/bundled/claude-api/python/agent-sdk/README.md`
- `src/skills/bundled/claude-api/python/claude-api/batches.md`
- `src/skills/bundled/claude-api/python/claude-api/files-api.md`
- `src/skills/bundled/claude-api/python/claude-api/README.md`
- `src/skills/bundled/claude-api/python/claude-api/streaming.md`
- `src/skills/bundled/claude-api/python/claude-api/tool-use.md`
- `src/skills/bundled/claude-api/ruby/claude-api.md`
- `src/skills/bundled/claude-api/shared/error-codes.md`
- `src/skills/bundled/claude-api/shared/live-sources.md`
- `src/skills/bundled/claude-api/shared/models.md`
- `src/skills/bundled/claude-api/shared/prompt-caching.md`
- `src/skills/bundled/claude-api/shared/tool-use-concepts.md`
- `src/skills/bundled/claude-api/SKILL.md`
- `src/skills/bundled/claude-api/statusline.md`
- `src/skills/bundled/claude-api/typescript/agent-sdk/patterns.md`
- `src/skills/bundled/claude-api/typescript/agent-sdk/README.md`
- `src/skills/bundled/claude-api/typescript/claude-api/batches.md`
- `src/skills/bundled/claude-api/typescript/claude-api/files-api.md`
- `src/skills/bundled/claude-api/typescript/claude-api/README.md`
- `src/skills/bundled/claude-api/typescript/claude-api/streaming.md`
- `src/skills/bundled/claude-api/typescript/claude-api/tool-use.md`
- `src/skills/bundled/claude-api/version.md`
- `src/skills/bundled/claudeApi.ts`
- `src/skills/bundled/claudeApiContent.ts`
- `src/skills/bundled/claudeInChrome.ts`
- `src/skills/bundled/code-analyzer/ReportGenerator.ts`
- `src/skills/bundled/code-analyzer/SKILL.md`
- `src/skills/bundled/codebaseDesign.ts`
- `src/skills/bundled/curatorReview.ts`
- `src/skills/bundled/debug.ts`
- `src/skills/bundled/diagnosingBugs.ts`
- `src/skills/bundled/domainModeling.ts`
- `src/skills/bundled/dream.ts`
- `src/skills/bundled/editArticle.ts`
- `src/skills/bundled/gitGuardrails.ts`
- `src/skills/bundled/grilling.ts`
- `src/skills/bundled/grillMe.ts`
- `src/skills/bundled/grillWithDocs.ts`
- `src/skills/bundled/handoff.ts`
- `src/skills/bundled/high-star-imports/01ai-skills/01ai-yi-skills.md`
- `src/skills/bundled/high-star-imports/01ai-skills/source.json`
- `src/skills/bundled/high-star-imports/addyosmani-agent-skills/addyosmani-prod-skills.md`
- `src/skills/bundled/high-star-imports/addyosmani-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/agentskills-official/agent-skills-spec.md`
- `src/skills/bundled/high-star-imports/agentskills-official/source.json`
- `src/skills/bundled/high-star-imports/ai-research-skills/ai-research-skills-library.md`
- `src/skills/bundled/high-star-imports/ai-research-skills/source.json`
- `src/skills/bundled/high-star-imports/aider/aider-skill.md`
- `src/skills/bundled/high-star-imports/aider/source.json`
- `src/skills/bundled/high-star-imports/alibaba-skills/alibaba-qwen-skills.md`
- `src/skills/bundled/high-star-imports/alibaba-skills/source.json`
- `src/skills/bundled/high-star-imports/anthropic-claude-code/claude-code-skill.md`
- `src/skills/bundled/high-star-imports/anthropic-claude-code/source.json`
- `src/skills/bundled/high-star-imports/anthropics-skills/anthropic-official-skills.md`
- `src/skills/bundled/high-star-imports/anthropics-skills/source.json`
- `src/skills/bundled/high-star-imports/awesome-agent-skills/awesome-agent-skills-collection.md`
- `src/skills/bundled/high-star-imports/awesome-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/baichuan-skills/baichuan-skills.md`
- `src/skills/bundled/high-star-imports/baichuan-skills/source.json`
- `src/skills/bundled/high-star-imports/baidu-skills/baidu-ernie-skills.md`
- `src/skills/bundled/high-star-imports/baidu-skills/source.json`
- `src/skills/bundled/high-star-imports/bytedance-skills/bytedance-ai-skills.md`
- `src/skills/bundled/high-star-imports/bytedance-skills/source.json`
- `src/skills/bundled/high-star-imports/claw-orchestrator/SKILL.md`
- `src/skills/bundled/high-star-imports/claw-orchestrator/source.json`
- `src/skills/bundled/high-star-imports/clawcodex/SKILL.md`
- `src/skills/bundled/high-star-imports/clawcodex/source.json`
- `src/skills/bundled/high-star-imports/clerk-skills/clerk-auth-skills.md`
- `src/skills/bundled/high-star-imports/clerk-skills/source.json`
- `src/skills/bundled/high-star-imports/cloudflare-skills/cloudflare-platform-skills.md`
- `src/skills/bundled/high-star-imports/cloudflare-skills/source.json`
- `src/skills/bundled/high-star-imports/codegate/codegate-security-gateway.md`
- `src/skills/bundled/high-star-imports/codegate/source.json`
- `src/skills/bundled/high-star-imports/continue-dev/continue-dev-skill.md`
- `src/skills/bundled/high-star-imports/continue-dev/source.json`
- `src/skills/bundled/high-star-imports/cpp-pro-skills/cpp-pro-skills.md`
- `src/skills/bundled/high-star-imports/cpp-pro-skills/source.json`
- `src/skills/bundled/high-star-imports/crewai/crewai-skill.md`
- `src/skills/bundled/high-star-imports/crewai/source.json`
- `src/skills/bundled/high-star-imports/dash0-agent-skills/dash0-observability-skills.md`
- `src/skills/bundled/high-star-imports/dash0-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/generate-data.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/monitor.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/nlp.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/optimize-sql.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/prep-interview.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/profile-data.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/query.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/recommend.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/regress.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/review-code.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/review-resume.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/style-plot.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/tell-story.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/test-hypothesis.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/track-experiment.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/train-model.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/tune.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/visualize.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/wrangle.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/commands/write-report.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/data-scientist-skills.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/ab-test-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/anomaly-detection/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/anova-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/bayesian-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/build-dashboard/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/causal-inference/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/choose-chart/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/choose-model/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/ci-cd-ml/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/classification/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/clean-dataset/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/clustering/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/code-review/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/cohort-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/computer-vision/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/correlation-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/customer-analytics/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/data-modeling/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/data-profiling-report/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/data-storytelling/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/data-versioning/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/dbt-models/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/demand-forecasting/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/design-schema/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/detect-outliers/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/dimensionality-reduction/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/distribution-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/document-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/eda-profile/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/embeddings-vectors/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/etl-patterns/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/experiment-tracking/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/feature-engineering/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/feature-selection/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/funnel-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/generate-synthetic-data/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/handle-missing-data/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/hyperparameter-tuning/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/hypothesis-test/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/infrastructure-design/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/interview-prep/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/kpi-framework/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/llm-applications/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/market-basket-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/ml-pipeline/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/model-deployment/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/model-evaluation/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/model-interpretation/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/model-monitoring/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/neural-network-design/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/nlp-pipeline/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/optimize-query/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/parse-dates-text/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/plot-comparison/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/plot-distribution/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/plot-relationship/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/plot-time-series/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/portfolio-project/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/presentation-design/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/recommendation-systems/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/regression-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/regression-ml/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/revenue-analytics/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/review-resume/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/sample-size-calculator/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/segment-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/statistical-concepts/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/style-guide/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/summary-statistics/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/survival-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/time-series-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/training-optimization/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/transfer-learning/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/transform-data/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/trend-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/validate-data-quality/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/window-functions/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/write-report/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/skills/write-sql/SKILL.md`
- `src/skills/bundled/high-star-imports/data-scientist-skills/source.json`
- `src/skills/bundled/high-star-imports/databricks-skills/databricks-skills.md`
- `src/skills/bundled/high-star-imports/databricks-skills/source.json`
- `src/skills/bundled/high-star-imports/deepseek-skills/deepseek-skills.md`
- `src/skills/bundled/high-star-imports/deepseek-skills/source.json`
- `src/skills/bundled/high-star-imports/dev-assistant/dev-assistant-skills.md`
- `src/skills/bundled/high-star-imports/dev-assistant/source.json`
- `src/skills/bundled/high-star-imports/docker-skills/docker-skills.md`
- `src/skills/bundled/high-star-imports/docker-skills/source.json`
- `src/skills/bundled/high-star-imports/embedded-review-skills/embedded-review.md`
- `src/skills/bundled/high-star-imports/embedded-review-skills/source.json`
- `src/skills/bundled/high-star-imports/fabric-patterns/fabric-patterns.md`
- `src/skills/bundled/high-star-imports/fabric-patterns/source.json`
- `src/skills/bundled/high-star-imports/free-claude-code/free-claude-code.md`
- `src/skills/bundled/high-star-imports/free-claude-code/README.md`
- `src/skills/bundled/high-star-imports/free-claude-code/source.json`
- `src/skills/bundled/high-star-imports/github-copilot-patterns/copilot-skill.md`
- `src/skills/bundled/high-star-imports/github-copilot-patterns/source.json`
- `src/skills/bundled/high-star-imports/gohypergiant-agent-skills/hypergiant-skills.md`
- `src/skills/bundled/high-star-imports/gohypergiant-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/google-ai-studio/gemini-skill.md`
- `src/skills/bundled/high-star-imports/google-ai-studio/source.json`
- `src/skills/bundled/high-star-imports/google-skills-for-engineers.md`
- `src/skills/bundled/high-star-imports/graphify/AGENTS.md`
- `src/skills/bundled/high-star-imports/graphify/graphify-skill.md`
- `src/skills/bundled/high-star-imports/graphify/README.md`
- `src/skills/bundled/high-star-imports/graphify/source.json`
- `src/skills/bundled/high-star-imports/huawei-skills/huawei-pangu-skills.md`
- `src/skills/bundled/high-star-imports/huawei-skills/source.json`
- `src/skills/bundled/high-star-imports/huggingface-agents/huggingface-agent-skill.md`
- `src/skills/bundled/high-star-imports/huggingface-agents/source.json`
- `src/skills/bundled/high-star-imports/humanizer/humanizer-skill.md`
- `src/skills/bundled/high-star-imports/humanizer/README.md`
- `src/skills/bundled/high-star-imports/humanizer/source.json`
- `src/skills/bundled/high-star-imports/iflytek-skills/iflytek-spark-skills.md`
- `src/skills/bundled/high-star-imports/iflytek-skills/source.json`
- `src/skills/bundled/high-star-imports/jeffallan-claude-skills/jeffallan-cpp-skills.md`
- `src/skills/bundled/high-star-imports/jeffallan-claude-skills/source.json`
- `src/skills/bundled/high-star-imports/langchain/langchain-skill.md`
- `src/skills/bundled/high-star-imports/langchain/source.json`
- `src/skills/bundled/high-star-imports/launchdarkly-agent-skills/launchdarkly-skills.md`
- `src/skills/bundled/high-star-imports/launchdarkly-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/learn-claude-code/CLAUDE.md`
- `src/skills/bundled/high-star-imports/learn-claude-code/learn-claude-code.md`
- `src/skills/bundled/high-star-imports/learn-claude-code/README.md`
- `src/skills/bundled/high-star-imports/learn-claude-code/skills/agent-builder/SKILL.md`
- `src/skills/bundled/high-star-imports/learn-claude-code/skills/code-review/SKILL.md`
- `src/skills/bundled/high-star-imports/learn-claude-code/skills/mcp-builder/SKILL.md`
- `src/skills/bundled/high-star-imports/learn-claude-code/skills/pdf/SKILL.md`
- `src/skills/bundled/high-star-imports/learn-claude-code/source.json`
- `src/skills/bundled/high-star-imports/mattpocock-skills/mattpocock-engineering-skills.md`
- `src/skills/bundled/high-star-imports/mattpocock-skills/source.json`
- `src/skills/bundled/high-star-imports/meddev-agent-skills/meddev-c-skills.md`
- `src/skills/bundled/high-star-imports/meddev-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/meta-llama-agent/llama-agent-skill.md`
- `src/skills/bundled/high-star-imports/meta-llama-agent/source.json`
- `src/skills/bundled/high-star-imports/mgechev-skills-best-practices/mgechev-skills.md`
- `src/skills/bundled/high-star-imports/mgechev-skills-best-practices/source.json`
- `src/skills/bundled/high-star-imports/microsoft-autogen/autogen-skill.md`
- `src/skills/bundled/high-star-imports/microsoft-autogen/source.json`
- `src/skills/bundled/high-star-imports/MiniCode/SKILL.md`
- `src/skills/bundled/high-star-imports/MiniCode/source.json`
- `src/skills/bundled/high-star-imports/minimax-skills/minimax-skills.md`
- `src/skills/bundled/high-star-imports/minimax-skills/source.json`
- `src/skills/bundled/high-star-imports/moonshot-skills/moonshot-kimi-skills.md`
- `src/skills/bundled/high-star-imports/moonshot-skills/source.json`
- `src/skills/bundled/high-star-imports/netresearch-agents-skill/netresearch-agents-skill.md`
- `src/skills/bundled/high-star-imports/netresearch-agents-skill/source.json`
- `src/skills/bundled/high-star-imports/nvidia-skills/nvidia-ai-platform-skills.md`
- `src/skills/bundled/high-star-imports/nvidia-skills/source.json`
- `src/skills/bundled/high-star-imports/open-interpreter/open-interpreter-skill.md`
- `src/skills/bundled/high-star-imports/open-interpreter/source.json`
- `src/skills/bundled/high-star-imports/openai-codex-cli/openai-codex-assistant.md`
- `src/skills/bundled/high-star-imports/openai-codex-cli/source.json`
- `src/skills/bundled/high-star-imports/OpenAlpha_Evolve/SKILL.md`
- `src/skills/bundled/high-star-imports/OpenAlpha_Evolve/source.json`
- `src/skills/bundled/high-star-imports/parallel-code/SKILL.md`
- `src/skills/bundled/high-star-imports/parallel-code/source.json`
- `src/skills/bundled/high-star-imports/plandex/plandex-planning.md`
- `src/skills/bundled/high-star-imports/plandex/source.json`
- `src/skills/bundled/high-star-imports/planning-with-files/planning-with-files.md`
- `src/skills/bundled/high-star-imports/planning-with-files/README.md`
- `src/skills/bundled/high-star-imports/planning-with-files/source.json`
- `src/skills/bundled/high-star-imports/qt-company-skills/qt-cpp-skills.md`
- `src/skills/bundled/high-star-imports/qt-company-skills/source.json`
- `src/skills/bundled/high-star-imports/ref-tools-mcp/SKILL.md`
- `src/skills/bundled/high-star-imports/ref-tools-mcp/source.json`
- `src/skills/bundled/high-star-imports/ruflo/AGENTS.md`
- `src/skills/bundled/high-star-imports/ruflo/CLAUDE.md`
- `src/skills/bundled/high-star-imports/ruflo/README.md`
- `src/skills/bundled/high-star-imports/ruflo/source.json`
- `src/skills/bundled/high-star-imports/simota-agent-skills/simota-agent-skills.md`
- `src/skills/bundled/high-star-imports/simota-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/supabase-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/supabase-agent-skills/supabase-skills.md`
- `src/skills/bundled/high-star-imports/SWE-AF/SKILL.md`
- `src/skills/bundled/high-star-imports/SWE-AF/source.json`
- `src/skills/bundled/high-star-imports/swe-agent/source.json`
- `src/skills/bundled/high-star-imports/swe-agent/swe-agent-skill.md`
- `src/skills/bundled/high-star-imports/system-prompts-and-models/README.md`
- `src/skills/bundled/high-star-imports/system-prompts-and-models/source.json`
- `src/skills/bundled/high-star-imports/system-prompts-and-models/system-prompts-and-models.md`
- `src/skills/bundled/high-star-imports/system-prompts-leaks/README.md`
- `src/skills/bundled/high-star-imports/system-prompts-leaks/source.json`
- `src/skills/bundled/high-star-imports/system-prompts-leaks/system-prompts-leaks.md`
- `src/skills/bundled/high-star-imports/tech-leads-club-skills/source.json`
- `src/skills/bundled/high-star-imports/tech-leads-club-skills/tech-leads-skills.md`
- `src/skills/bundled/high-star-imports/tencent-skills/source.json`
- `src/skills/bundled/high-star-imports/tencent-skills/tencent-ai-skills.md`
- `src/skills/bundled/high-star-imports/thudm-skills/source.json`
- `src/skills/bundled/high-star-imports/thudm-skills/thudm-glm-skills.md`
- `src/skills/bundled/high-star-imports/understand-anything/README.md`
- `src/skills/bundled/high-star-imports/understand-anything/source.json`
- `src/skills/bundled/high-star-imports/understand-anything/understand-anything.md`
- `src/skills/bundled/high-star-imports/unreal-engine-skills/source.json`
- `src/skills/bundled/high-star-imports/unreal-engine-skills/unreal-cpp-skills.md`
- `src/skills/bundled/high-star-imports/vercel-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/vercel-agent-skills/vercel-platform-skills.md`
- `src/skills/bundled/high-star-imports/vercel-labs-skills/source.json`
- `src/skills/bundled/high-star-imports/vercel-labs-skills/vercel-skills-cli.md`
- `src/skills/bundled/high-star-imports/vibe-kanban/README.md`
- `src/skills/bundled/high-star-imports/vibe-kanban/source.json`
- `src/skills/bundled/high-star-imports/vibe-kanban/vibe-kanban.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/ai-ml-attacks/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/business-logic/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/cache-poisoning/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/cloud-native/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/compliance-mapping/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/cpg-analysis/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/cross-component/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/cryptographic-failures/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/dangerous-functions/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/data-flow-tracing/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/exception-handling/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/exploit-techniques/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/framework-patterns/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/logging-failures/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/mixed-language-monorepos/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/mobile-android/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/mobile-ios/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/mobile-payments/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/skills/nextjs-react/SKILL.md`
- `src/skills/bundled/high-star-imports/vuln-scout/source.json`
- `src/skills/bundled/high-star-imports/Whale/SKILL.md`
- `src/skills/bundled/high-star-imports/Whale/source.json`
- `src/skills/bundled/high-star-imports/wordpress-agent-skills/source.json`
- `src/skills/bundled/high-star-imports/wordpress-agent-skills/wordpress-skills.md`
- `src/skills/bundled/high-star-imports/zero/SKILL.md`
- `src/skills/bundled/high-star-imports/zero/source.json`
- `src/skills/bundled/high-star-imports/_broken_backup/01ai-skills_01ai-yi-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/baichuan-skills_baichuan-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/baidu-skills_baidu-ernie-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/bytedance-skills_bytedance-ai-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/cpp-pro-skills_cpp-pro-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/deepseek-skills_deepseek-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/docker-skills_docker-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/embedded-review-skills_embedded-review.md`
- `src/skills/bundled/high-star-imports/_broken_backup/huawei-skills_huawei-pangu-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/humanizer_humanizer-skill.md`
- `src/skills/bundled/high-star-imports/_broken_backup/iflytek-skills_iflytek-spark-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/jeffallan-claude-skills_jeffallan-cpp-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/meddev-agent-skills_meddev-c-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/minimax-skills_minimax-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/plandex_plandex-planning.md`
- `src/skills/bundled/high-star-imports/_broken_backup/ruflo_ruflo-workflow.md`
- `src/skills/bundled/high-star-imports/_broken_backup/system-prompts-leaks_system-prompts-leaks.md`
- `src/skills/bundled/high-star-imports/_broken_backup/tencent-skills_tencent-ai-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/thudm-skills_thudm-glm-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/unreal-engine-skills_unreal-cpp-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/vercel-agent-skills_vercel-platform-skills.md`
- `src/skills/bundled/high-star-imports/_broken_backup/vibe-kanban_vibe-kanban.md`
- `src/skills/bundled/high-star-imports/_broken_backup/vuln-scout_owasp-2025_SKILL.md`
- `src/skills/bundled/high-star-imports/_broken_backup/vuln-scout_vuln-scout.md`
- `src/skills/bundled/hunter.ts`
- `src/skills/bundled/implement.ts`
- `src/skills/bundled/improveCodebaseArchitecture.ts`
- `src/skills/bundled/index.ts`
- `src/skills/bundled/iterationBudget.ts`
- `src/skills/bundled/keybindings.ts`
- `src/skills/bundled/loop.ts`
- `src/skills/bundled/loremIpsum.ts`
- `src/skills/bundled/memoryManager.ts`
- `src/skills/bundled/migrateToShoehorn.ts`
- `src/skills/bundled/obsidianVault.ts`
- `src/skills/bundled/prototype.ts`
- `src/skills/bundled/remember.ts`
- `src/skills/bundled/resolvingMergeConflicts.ts`
- `src/skills/bundled/runSkillGenerator.ts`
- `src/skills/bundled/scaffoldExercises.ts`
- `src/skills/bundled/scheduleRemoteAgents.ts`
- `src/skills/bundled/setupPreCommit.ts`
- `src/skills/bundled/simplify.ts`
- `src/skills/bundled/skillBundle.ts`
- `src/skills/bundled/skillCurator.ts`
- `src/skills/bundled/skillify.ts`
- `src/skills/bundled/skillUsage.js.map`
- `src/skills/bundled/skillUsage.ts`
- `src/skills/bundled/stock-research/SKILL.md`
- `src/skills/bundled/stuck.ts`
- `src/skills/bundled/tdd.ts`
- `src/skills/bundled/teach.ts`
- `src/skills/bundled/toIssues.ts`
- `src/skills/bundled/toPrd.ts`
- `src/skills/bundled/triage.ts`
- `src/skills/bundled/updateConfig.ts`
- `src/skills/bundled/verify/examples/cli.md`
- `src/skills/bundled/verify/examples/server.md`
- `src/skills/bundled/verify/SKILL.md`
- `src/skills/bundled/verify.ts`
- `src/skills/bundled/verifyContent.ts`
- `src/skills/bundled/writingBeats.ts`
- `src/skills/bundled/writingFragments.ts`
- `src/skills/bundled/writingGreatSkills.ts`
- `src/skills/bundled/writingShape.ts`
- `src/skills/bundled/技能说明书.md`

</details>

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

<details><summary><code>src/components/permissions</code> — 53 个</summary>

- `src/components/permissions/AskUserQuestionPermissionRequest/AskUserQuestionPermissionRequest.tsx`
- `src/components/permissions/AskUserQuestionPermissionRequest/PreviewBox.tsx`
- `src/components/permissions/AskUserQuestionPermissionRequest/PreviewQuestionView.tsx`
- `src/components/permissions/AskUserQuestionPermissionRequest/QuestionNavigationBar.tsx`
- `src/components/permissions/AskUserQuestionPermissionRequest/QuestionView.tsx`
- `src/components/permissions/AskUserQuestionPermissionRequest/SubmitQuestionsView.tsx`
- `src/components/permissions/AskUserQuestionPermissionRequest/use-multiple-choice-state.ts`
- `src/components/permissions/BashPermissionRequest/BashPermissionRequest.tsx`
- `src/components/permissions/BashPermissionRequest/bashToolUseOptions.tsx`
- `src/components/permissions/ComputerUseApproval/ComputerUseApproval.tsx`
- `src/components/permissions/EnterPlanModePermissionRequest/EnterPlanModePermissionRequest.tsx`
- `src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx`
- `src/components/permissions/FallbackPermissionRequest.tsx`
- `src/components/permissions/FileEditPermissionRequest/FileEditPermissionRequest.tsx`
- `src/components/permissions/FilePermissionDialog/FilePermissionDialog.tsx`
- `src/components/permissions/FilePermissionDialog/ideDiffConfig.ts`
- `src/components/permissions/FilePermissionDialog/permissionOptions.tsx`
- `src/components/permissions/FilePermissionDialog/useFilePermissionDialog.ts`
- `src/components/permissions/FilePermissionDialog/usePermissionHandler.ts`
- `src/components/permissions/FilesystemPermissionRequest/FilesystemPermissionRequest.tsx`
- `src/components/permissions/FileWritePermissionRequest/FileWritePermissionRequest.tsx`
- `src/components/permissions/FileWritePermissionRequest/FileWriteToolDiff.tsx`
- `src/components/permissions/hooks.ts`
- `src/components/permissions/MonitorPermissionRequest/MonitorPermissionRequest.tsx`
- `src/components/permissions/NotebookEditPermissionRequest/NotebookEditPermissionRequest.tsx`
- `src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx`
- `src/components/permissions/PermissionDecisionDebugInfo.tsx`
- `src/components/permissions/PermissionDialog.tsx`
- `src/components/permissions/PermissionExplanation.tsx`
- `src/components/permissions/PermissionPrompt.tsx`
- `src/components/permissions/PermissionRequest.tsx`
- `src/components/permissions/PermissionRequestTitle.tsx`
- `src/components/permissions/PermissionRuleExplanation.tsx`
- `src/components/permissions/PowerShellPermissionRequest/PowerShellPermissionRequest.tsx`
- `src/components/permissions/PowerShellPermissionRequest/powershellToolUseOptions.tsx`
- `src/components/permissions/ReviewArtifactPermissionRequest/ReviewArtifactPermissionRequest.tsx`
- `src/components/permissions/rules/AddPermissionRules.tsx`
- `src/components/permissions/rules/AddWorkspaceDirectory.tsx`
- `src/components/permissions/rules/PermissionRuleDescription.tsx`
- `src/components/permissions/rules/PermissionRuleInput.tsx`
- `src/components/permissions/rules/PermissionRuleList.tsx`
- `src/components/permissions/rules/RecentDenialsTab.tsx`
- `src/components/permissions/rules/RemoveWorkspaceDirectory.tsx`
- `src/components/permissions/rules/WorkspaceTab.tsx`
- `src/components/permissions/SandboxPermissionRequest.tsx`
- `src/components/permissions/SedEditPermissionRequest/SedEditPermissionRequest.tsx`
- `src/components/permissions/shellPermissionHelpers.tsx`
- `src/components/permissions/SkillPermissionRequest/SkillPermissionRequest.tsx`
- `src/components/permissions/useShellPermissionFeedback.ts`
- `src/components/permissions/utils.ts`
- `src/components/permissions/WebFetchPermissionRequest/WebFetchPermissionRequest.tsx`
- `src/components/permissions/WorkerBadge.tsx`
- `src/components/permissions/WorkerPendingPermission.tsx`

</details>

<details><summary><code>src/components/messages</code> — 45 个</summary>

- `src/components/messages/AdvisorMessage.tsx`
- `src/components/messages/AssistantRedactedThinkingMessage.tsx`
- `src/components/messages/AssistantTextMessage.tsx`
- `src/components/messages/AssistantThinkingMessage.tsx`
- `src/components/messages/AssistantToolUseMessage.tsx`
- `src/components/messages/AttachmentMessage.tsx`
- `src/components/messages/CollapsedReadSearchContent.tsx`
- `src/components/messages/CompactBoundaryMessage.tsx`
- `src/components/messages/GroupedToolUseContent.tsx`
- `src/components/messages/HighlightedThinkingText.tsx`
- `src/components/messages/HookProgressMessage.tsx`
- `src/components/messages/nullRenderingAttachments.ts`
- `src/components/messages/PlanApprovalMessage.tsx`
- `src/components/messages/RateLimitMessage.tsx`
- `src/components/messages/ShutdownMessage.tsx`
- `src/components/messages/SnipBoundaryMessage.tsx`
- `src/components/messages/SystemAPIErrorMessage.tsx`
- `src/components/messages/SystemTextMessage.tsx`
- `src/components/messages/TaskAssignmentMessage.tsx`
- `src/components/messages/teamMemCollapsed.tsx`
- `src/components/messages/teamMemSaved.ts`
- `src/components/messages/UserAgentNotificationMessage.tsx`
- `src/components/messages/UserBashInputMessage.tsx`
- `src/components/messages/UserBashOutputMessage.tsx`
- `src/components/messages/UserChannelMessage.tsx`
- `src/components/messages/UserCommandMessage.tsx`
- `src/components/messages/UserCrossSessionMessage.tsx`
- `src/components/messages/UserForkBoilerplateMessage.tsx`
- `src/components/messages/UserGitHubWebhookMessage.tsx`
- `src/components/messages/UserImageMessage.tsx`
- `src/components/messages/UserLocalCommandOutputMessage.tsx`
- `src/components/messages/UserMemoryInputMessage.tsx`
- `src/components/messages/UserPlanMessage.tsx`
- `src/components/messages/UserPromptMessage.tsx`
- `src/components/messages/UserResourceUpdateMessage.tsx`
- `src/components/messages/UserTeammateMessage.tsx`
- `src/components/messages/UserTextMessage.tsx`
- `src/components/messages/UserToolResultMessage/RejectedPlanMessage.tsx`
- `src/components/messages/UserToolResultMessage/RejectedToolUseMessage.tsx`
- `src/components/messages/UserToolResultMessage/UserToolCanceledMessage.tsx`
- `src/components/messages/UserToolResultMessage/UserToolErrorMessage.tsx`
- `src/components/messages/UserToolResultMessage/UserToolRejectMessage.tsx`
- `src/components/messages/UserToolResultMessage/UserToolResultMessage.tsx`
- `src/components/messages/UserToolResultMessage/UserToolSuccessMessage.tsx`
- `src/components/messages/UserToolResultMessage/utils.tsx`

</details>

<details><summary><code>src/services/mcp</code> — 42 个</summary>

- `src/services/mcp/auth.js.map`
- `src/services/mcp/auth.ts`
- `src/services/mcp/channelAllowlist.ts`
- `src/services/mcp/channelNotification.ts`
- `src/services/mcp/channelPermissions.js.map`
- `src/services/mcp/channelPermissions.ts`
- `src/services/mcp/claudeai.js.map`
- `src/services/mcp/claudeai.ts`
- `src/services/mcp/client.js.map`
- `src/services/mcp/client.ts`
- `src/services/mcp/config.js.map`
- `src/services/mcp/config.ts`
- `src/services/mcp/elicitationHandler.js.map`
- `src/services/mcp/elicitationHandler.ts`
- `src/services/mcp/envExpansion.js.map`
- `src/services/mcp/envExpansion.ts`
- `src/services/mcp/headersHelper.js.map`
- `src/services/mcp/headersHelper.ts`
- `src/services/mcp/InProcessTransport.js.map`
- `src/services/mcp/InProcessTransport.ts`
- `src/services/mcp/MCPConnectionManager.tsx`
- `src/services/mcp/mcpStringUtils.js.map`
- `src/services/mcp/mcpStringUtils.ts`
- `src/services/mcp/normalization.js.map`
- `src/services/mcp/normalization.ts`
- `src/services/mcp/oauthPort.js.map`
- `src/services/mcp/oauthPort.ts`
- `src/services/mcp/officialRegistry.js.map`
- `src/services/mcp/officialRegistry.ts`
- `src/services/mcp/SdkControlTransport.js.map`
- `src/services/mcp/SdkControlTransport.ts`
- `src/services/mcp/types.js.map`
- `src/services/mcp/types.ts`
- `src/services/mcp/useManageMCPConnections.ts`
- `src/services/mcp/utils.js.map`
- `src/services/mcp/utils.ts`
- `src/services/mcp/vscodeSdkMcp.js.map`
- `src/services/mcp/vscodeSdkMcp.ts`
- `src/services/mcp/xaa.js.map`
- `src/services/mcp/xaa.ts`
- `src/services/mcp/xaaIdpLogin.js.map`
- `src/services/mcp/xaaIdpLogin.ts`

</details>

<details><summary><code>src/tools/AgentTool</code> — 37 个</summary>

- `src/tools/AgentTool/agentColorManager.js.map`
- `src/tools/AgentTool/agentColorManager.ts`
- `src/tools/AgentTool/agentDisplay.ts`
- `src/tools/AgentTool/agentMemory.js.map`
- `src/tools/AgentTool/agentMemory.ts`
- `src/tools/AgentTool/agentMemorySnapshot.js.map`
- `src/tools/AgentTool/agentMemorySnapshot.ts`
- `src/tools/AgentTool/AgentTool.tsx`
- `src/tools/AgentTool/agentToolUtils.js.map`
- `src/tools/AgentTool/agentToolUtils.ts`
- `src/tools/AgentTool/built-in/claudeCodeGuideAgent.js.map`
- `src/tools/AgentTool/built-in/claudeCodeGuideAgent.ts`
- `src/tools/AgentTool/built-in/exploreAgent.js.map`
- `src/tools/AgentTool/built-in/exploreAgent.ts`
- `src/tools/AgentTool/built-in/generalPurposeAgent.js.map`
- `src/tools/AgentTool/built-in/generalPurposeAgent.ts`
- `src/tools/AgentTool/built-in/planAgent.js.map`
- `src/tools/AgentTool/built-in/planAgent.ts`
- `src/tools/AgentTool/built-in/statuslineSetup.js.map`
- `src/tools/AgentTool/built-in/statuslineSetup.ts`
- `src/tools/AgentTool/built-in/verificationAgent.js.map`
- `src/tools/AgentTool/built-in/verificationAgent.ts`
- `src/tools/AgentTool/builtInAgents.js.map`
- `src/tools/AgentTool/builtInAgents.ts`
- `src/tools/AgentTool/constants.js.map`
- `src/tools/AgentTool/constants.ts`
- `src/tools/AgentTool/forkSubagent.js.map`
- `src/tools/AgentTool/forkSubagent.ts`
- `src/tools/AgentTool/loadAgentsDir.js.map`
- `src/tools/AgentTool/loadAgentsDir.ts`
- `src/tools/AgentTool/prompt.js.map`
- `src/tools/AgentTool/prompt.ts`
- `src/tools/AgentTool/resumeAgent.js.map`
- `src/tools/AgentTool/resumeAgent.ts`
- `src/tools/AgentTool/runAgent.js.map`
- `src/tools/AgentTool/runAgent.ts`
- `src/tools/AgentTool/UI.tsx`

</details>

<details><summary><code>src/services/api</code> — 36 个</summary>

- `src/services/api/adminRequests.js.map`
- `src/services/api/adminRequests.ts`
- `src/services/api/bootstrap.ts`
- `src/services/api/claude.js.map`
- `src/services/api/claude.ts`
- `src/services/api/client.js.map`
- `src/services/api/client.ts`
- `src/services/api/dumpPrompts.js.map`
- `src/services/api/dumpPrompts.ts`
- `src/services/api/emptyUsage.js.map`
- `src/services/api/emptyUsage.ts`
- `src/services/api/errors.js.map`
- `src/services/api/errors.ts`
- `src/services/api/errorUtils.js.map`
- `src/services/api/errorUtils.ts`
- `src/services/api/filesApi.ts`
- `src/services/api/firstTokenDate.ts`
- `src/services/api/grove.ts`
- `src/services/api/logging.js.map`
- `src/services/api/logging.ts`
- `src/services/api/metricsOptOut.ts`
- `src/services/api/openaiCompat.js.map`
- `src/services/api/openaiCompat.ts`
- `src/services/api/overageCreditGrant.js.map`
- `src/services/api/overageCreditGrant.ts`
- `src/services/api/promptCacheBreakDetection.js.map`
- `src/services/api/promptCacheBreakDetection.ts`
- `src/services/api/referral.js.map`
- `src/services/api/referral.ts`
- `src/services/api/sessionIngress.js.map`
- `src/services/api/sessionIngress.ts`
- `src/services/api/ultrareviewQuota.ts`
- `src/services/api/usage.js.map`
- `src/services/api/usage.ts`
- `src/services/api/withRetry.js.map`
- `src/services/api/withRetry.ts`

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

<details><summary><code>src/services/compact</code> — 31 个</summary>

- `src/services/compact/apiMicrocompact.js.map`
- `src/services/compact/apiMicrocompact.ts`
- `src/services/compact/autoCompact.js.map`
- `src/services/compact/autoCompact.ts`
- `src/services/compact/cachedMCConfig.js.map`
- `src/services/compact/cachedMCConfig.ts`
- `src/services/compact/cachedMicrocompact.js.map`
- `src/services/compact/cachedMicrocompact.ts`
- `src/services/compact/compact.js.map`
- `src/services/compact/compact.ts`
- `src/services/compact/compactWarningHook.ts`
- `src/services/compact/compactWarningState.js.map`
- `src/services/compact/compactWarningState.ts`
- `src/services/compact/grouping.js.map`
- `src/services/compact/grouping.ts`
- `src/services/compact/microCompact.js.map`
- `src/services/compact/microCompact.ts`
- `src/services/compact/postCompactCleanup.js.map`
- `src/services/compact/postCompactCleanup.ts`
- `src/services/compact/prompt.js.map`
- `src/services/compact/prompt.ts`
- `src/services/compact/reactiveCompact.js.map`
- `src/services/compact/reactiveCompact.ts`
- `src/services/compact/sessionMemoryCompact.js.map`
- `src/services/compact/sessionMemoryCompact.ts`
- `src/services/compact/snipCompact.js.map`
- `src/services/compact/snipCompact.ts`
- `src/services/compact/snipProjection.js.map`
- `src/services/compact/snipProjection.ts`
- `src/services/compact/timeBasedMCConfig.js.map`
- `src/services/compact/timeBasedMCConfig.ts`

</details>

<details><summary><code>src/components/agents</code> — 29 个</summary>

- `src/components/agents/AgentDetail.tsx`
- `src/components/agents/AgentEditor.tsx`
- `src/components/agents/agentFileUtils.ts`
- `src/components/agents/AgentNavigationFooter.tsx`
- `src/components/agents/AgentsList.tsx`
- `src/components/agents/AgentsMenu.tsx`
- `src/components/agents/ColorPicker.tsx`
- `src/components/agents/generateAgent.ts`
- `src/components/agents/ModelSelector.tsx`
- `src/components/agents/new-agent-creation/CreateAgentWizard.tsx`
- `src/components/agents/new-agent-creation/types.ts`
- `src/components/agents/new-agent-creation/wizard-steps/ColorStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/ConfirmStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/ConfirmStepWrapper.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/DescriptionStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/GenerateStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/LocationStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/MemoryStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/MethodStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/ModelStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/PromptStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/ToolsStep.tsx`
- `src/components/agents/new-agent-creation/wizard-steps/TypeStep.tsx`
- `src/components/agents/SnapshotUpdateDialog.ts`
- `src/components/agents/SnapshotUpdateDialog.tsx`
- `src/components/agents/ToolSelector.tsx`
- `src/components/agents/types.ts`
- `src/components/agents/utils.ts`
- `src/components/agents/validateAgent.ts`

</details>

<details><summary><code>src/tools/BashTool</code> — 29 个</summary>

- `src/tools/BashTool/bashCommandHelpers.js.map`
- `src/tools/BashTool/bashCommandHelpers.ts`
- `src/tools/BashTool/bashPermissions.js.map`
- `src/tools/BashTool/bashPermissions.ts`
- `src/tools/BashTool/bashSecurity.js.map`
- `src/tools/BashTool/bashSecurity.ts`
- `src/tools/BashTool/BashTool.tsx`
- `src/tools/BashTool/BashToolResultMessage.tsx`
- `src/tools/BashTool/commandSemantics.ts`
- `src/tools/BashTool/commentLabel.ts`
- `src/tools/BashTool/destructiveCommandWarning.ts`
- `src/tools/BashTool/grepRouter.ts`
- `src/tools/BashTool/modeValidation.js.map`
- `src/tools/BashTool/modeValidation.ts`
- `src/tools/BashTool/pathValidation.js.map`
- `src/tools/BashTool/pathValidation.ts`
- `src/tools/BashTool/prompt.ts`
- `src/tools/BashTool/readOnlyValidation.js.map`
- `src/tools/BashTool/readOnlyValidation.ts`
- `src/tools/BashTool/sedEditParser.ts`
- `src/tools/BashTool/sedValidation.js.map`
- `src/tools/BashTool/sedValidation.ts`
- `src/tools/BashTool/shouldUseSandbox.js.map`
- `src/tools/BashTool/shouldUseSandbox.ts`
- `src/tools/BashTool/toolName.js.map`
- `src/tools/BashTool/toolName.ts`
- `src/tools/BashTool/UI.tsx`
- `src/tools/BashTool/utils.js.map`
- `src/tools/BashTool/utils.ts`

</details>

<details><summary><code>src/commands/plugin</code> — 24 个</summary>

- `src/commands/plugin/AddMarketplace.tsx`
- `src/commands/plugin/BrowseMarketplace.tsx`
- `src/commands/plugin/DiscoverPlugins.tsx`
- `src/commands/plugin/index.js.map`
- `src/commands/plugin/index.ts`
- `src/commands/plugin/index.tsx`
- `src/commands/plugin/ManageMarketplaces.tsx`
- `src/commands/plugin/ManagePlugins.tsx`
- `src/commands/plugin/parseArgs.ts`
- `src/commands/plugin/plugin.tsx`
- `src/commands/plugin/pluginDetailsHelpers.tsx`
- `src/commands/plugin/PluginErrors.ts`
- `src/commands/plugin/PluginErrors.tsx`
- `src/commands/plugin/PluginOptionsDialog.tsx`
- `src/commands/plugin/PluginOptionsFlow.tsx`
- `src/commands/plugin/PluginSettings.tsx`
- `src/commands/plugin/PluginTrustWarning.tsx`
- `src/commands/plugin/src/services/analytics/index.ts`
- `src/commands/plugin/types.ts`
- `src/commands/plugin/UnifiedInstalledCell.tsx`
- `src/commands/plugin/unifiedTypes.ts`
- `src/commands/plugin/usePagination.ts`
- `src/commands/plugin/ValidatePlugin.tsx`
- `src/commands/plugin/__tests__/parseArgs.test.ts`

</details>

<details><summary><code>src/ink/components</code> — 23 个</summary>

- `src/ink/components/AlternateScreen.tsx`
- `src/ink/components/App.tsx`
- `src/ink/components/AppContext.js.map`
- `src/ink/components/AppContext.ts`
- `src/ink/components/Box.tsx`
- `src/ink/components/Button.tsx`
- `src/ink/components/ClockContext.tsx`
- `src/ink/components/CursorDeclarationContext.ts`
- `src/ink/components/ErrorOverview.tsx`
- `src/ink/components/Link.tsx`
- `src/ink/components/Newline.tsx`
- `src/ink/components/NoSelect.tsx`
- `src/ink/components/patch2.mjs`
- `src/ink/components/patch_app.js`
- `src/ink/components/patch_app.mjs`
- `src/ink/components/RawAnsi.tsx`
- `src/ink/components/ScrollBox.tsx`
- `src/ink/components/Spacer.tsx`
- `src/ink/components/StdinContext.js.map`
- `src/ink/components/StdinContext.ts`
- `src/ink/components/TerminalFocusContext.tsx`
- `src/ink/components/TerminalSizeContext.tsx`
- `src/ink/components/Text.tsx`

</details>

<details><summary><code>src/ink/hooks</code> — 22 个</summary>

- `src/ink/hooks/use-animation-frame.js.map`
- `src/ink/hooks/use-animation-frame.ts`
- `src/ink/hooks/use-app.js.map`
- `src/ink/hooks/use-app.ts`
- `src/ink/hooks/use-declared-cursor.ts`
- `src/ink/hooks/use-input.js.map`
- `src/ink/hooks/use-input.ts`
- `src/ink/hooks/use-interval.js.map`
- `src/ink/hooks/use-interval.ts`
- `src/ink/hooks/use-search-highlight.ts`
- `src/ink/hooks/use-selection.js.map`
- `src/ink/hooks/use-selection.ts`
- `src/ink/hooks/use-stdin.js.map`
- `src/ink/hooks/use-stdin.ts`
- `src/ink/hooks/use-tab-status.js.map`
- `src/ink/hooks/use-tab-status.ts`
- `src/ink/hooks/use-terminal-focus.js.map`
- `src/ink/hooks/use-terminal-focus.ts`
- `src/ink/hooks/use-terminal-title.js.map`
- `src/ink/hooks/use-terminal-title.ts`
- `src/ink/hooks/use-terminal-viewport.js.map`
- `src/ink/hooks/use-terminal-viewport.ts`

</details>

<details><summary><code>src/components/PromptInput</code> — 21 个</summary>

- `src/components/PromptInput/HistorySearchInput.tsx`
- `src/components/PromptInput/inputModes.ts`
- `src/components/PromptInput/inputPaste.ts`
- `src/components/PromptInput/IssueFlagBanner.tsx`
- `src/components/PromptInput/Notifications.tsx`
- `src/components/PromptInput/PromptInput.tsx`
- `src/components/PromptInput/PromptInputFooter.tsx`
- `src/components/PromptInput/PromptInputFooterLeftSide.tsx`
- `src/components/PromptInput/PromptInputFooterSuggestions.tsx`
- `src/components/PromptInput/PromptInputHelpMenu.tsx`
- `src/components/PromptInput/PromptInputModeIndicator.tsx`
- `src/components/PromptInput/PromptInputQueuedCommands.tsx`
- `src/components/PromptInput/PromptInputStashNotice.tsx`
- `src/components/PromptInput/SandboxPromptFooterHint.tsx`
- `src/components/PromptInput/ShimmeredInput.tsx`
- `src/components/PromptInput/useMaybeTruncateInput.ts`
- `src/components/PromptInput/usePromptInputPlaceholder.ts`
- `src/components/PromptInput/useShowFastIconHint.ts`
- `src/components/PromptInput/useSwarmBanner.ts`
- `src/components/PromptInput/utils.ts`
- `src/components/PromptInput/VoiceIndicator.tsx`

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

<details><summary><code>src/commands/install-github-app</code> — 19 个</summary>

- `src/commands/install-github-app/ApiKeyStep.tsx`
- `src/commands/install-github-app/CheckExistingSecretStep.tsx`
- `src/commands/install-github-app/CheckGitHubStep.tsx`
- `src/commands/install-github-app/ChooseRepoStep.tsx`
- `src/commands/install-github-app/CreatingStep.tsx`
- `src/commands/install-github-app/ErrorStep.tsx`
- `src/commands/install-github-app/ExistingWorkflowStep.tsx`
- `src/commands/install-github-app/index.js.map`
- `src/commands/install-github-app/index.ts`
- `src/commands/install-github-app/install-github-app.tsx`
- `src/commands/install-github-app/InstallAppStep.tsx`
- `src/commands/install-github-app/OAuthFlowStep.tsx`
- `src/commands/install-github-app/setupGitHubActions.ts`
- `src/commands/install-github-app/src/components/CustomSelect/index.ts`
- `src/commands/install-github-app/src/services/analytics/index.ts`
- `src/commands/install-github-app/src/utils/config.ts`
- `src/commands/install-github-app/SuccessStep.tsx`
- `src/commands/install-github-app/types.ts`
- `src/commands/install-github-app/WarningsStep.tsx`

</details>

<details><summary><code>src/ink/events</code> — 19 个</summary>

- `src/ink/events/click-event.js.map`
- `src/ink/events/click-event.ts`
- `src/ink/events/dispatcher.ts`
- `src/ink/events/emitter.js.map`
- `src/ink/events/emitter.ts`
- `src/ink/events/event-handlers.ts`
- `src/ink/events/event.js.map`
- `src/ink/events/event.ts`
- `src/ink/events/focus-event.js.map`
- `src/ink/events/focus-event.ts`
- `src/ink/events/input-event.js.map`
- `src/ink/events/input-event.ts`
- `src/ink/events/keyboard-event.ts`
- `src/ink/events/paste-event.ts`
- `src/ink/events/resize-event.ts`
- `src/ink/events/terminal-event.js.map`
- `src/ink/events/terminal-event.ts`
- `src/ink/events/terminal-focus-event.js.map`
- `src/ink/events/terminal-focus-event.ts`

</details>

<details><summary><code>src/commands/clear</code> — 18 个</summary>

- `src/commands/clear/caches.js`
- `src/commands/clear/caches.js.map`
- `src/commands/clear/caches.ts`
- `src/commands/clear/clear/caches.ts`
- `src/commands/clear/clear/conversation.ts`
- `src/commands/clear/clear.js`
- `src/commands/clear/clear.js.map`
- `src/commands/clear/clear.ts`
- `src/commands/clear/conversation.js`
- `src/commands/clear/conversation.js.map`
- `src/commands/clear/conversation.ts`
- `src/commands/clear/index.js`
- `src/commands/clear/index.js.map`
- `src/commands/clear/index.ts`
- `src/commands/clear/session-result-handler.ts`
- `src/commands/clear/tool-call-executor.ts`
- `src/commands/clear/tool-handler.ts`
- `src/commands/clear/tool-protocol-handler.ts`

</details>

<details><summary><code>src/services/analytics</code> — 18 个</summary>

- `src/services/analytics/config.js.map`
- `src/services/analytics/config.ts`
- `src/services/analytics/datadog.js.map`
- `src/services/analytics/datadog.ts`
- `src/services/analytics/firstPartyEventLogger.js.map`
- `src/services/analytics/firstPartyEventLogger.ts`
- `src/services/analytics/firstPartyEventLoggingExporter.js.map`
- `src/services/analytics/firstPartyEventLoggingExporter.ts`
- `src/services/analytics/growthbook.js.map`
- `src/services/analytics/growthbook.ts`
- `src/services/analytics/index.js.map`
- `src/services/analytics/index.ts`
- `src/services/analytics/metadata.js.map`
- `src/services/analytics/metadata.ts`
- `src/services/analytics/sink.js.map`
- `src/services/analytics/sink.ts`
- `src/services/analytics/sinkKillswitch.js.map`
- `src/services/analytics/sinkKillswitch.ts`

</details>

<details><summary><code>src/components/design-system</code> — 17 个</summary>

- `src/components/design-system/Byline.tsx`
- `src/components/design-system/color.js.map`
- `src/components/design-system/color.ts`
- `src/components/design-system/Dialog.tsx`
- `src/components/design-system/Divider.tsx`
- `src/components/design-system/FuzzyPicker.tsx`
- `src/components/design-system/KeyboardShortcutHint.tsx`
- `src/components/design-system/ListItem.tsx`
- `src/components/design-system/LoadingState.tsx`
- `src/components/design-system/Pane.tsx`
- `src/components/design-system/ProgressBar.tsx`
- `src/components/design-system/Ratchet.tsx`
- `src/components/design-system/StatusIcon.tsx`
- `src/components/design-system/Tabs.tsx`
- `src/components/design-system/ThemedBox.tsx`
- `src/components/design-system/ThemedText.tsx`
- `src/components/design-system/ThemeProvider.tsx`

</details>

<details><summary><code>src/components/LogoV2</code> — 17 个</summary>

- `src/components/LogoV2/AnimatedAsterisk.tsx`
- `src/components/LogoV2/AnimatedClawd.tsx`
- `src/components/LogoV2/ChannelsNotice.tsx`
- `src/components/LogoV2/Clawd.tsx`
- `src/components/LogoV2/CondensedLogo.tsx`
- `src/components/LogoV2/EmergencyTip.tsx`
- `src/components/LogoV2/Feed.tsx`
- `src/components/LogoV2/FeedColumn.tsx`
- `src/components/LogoV2/feedConfigs.tsx`
- `src/components/LogoV2/GuestPassesUpsell.tsx`
- `src/components/LogoV2/KirakiraNotice.tsx`
- `src/components/LogoV2/LogoV2.tsx`
- `src/components/LogoV2/Opus1mMergeNotice.tsx`
- `src/components/LogoV2/OverageCreditUpsell.tsx`
- `src/components/LogoV2/VoiceModeNotice.tsx`
- `src/components/LogoV2/WelcomeV2-bak.tsx`
- `src/components/LogoV2/WelcomeV2.tsx`

</details>

<details><summary><code>src/entrypoints/sdk</code> — 17 个</summary>

- `src/entrypoints/sdk/controlSchemas.ts`
- `src/entrypoints/sdk/controlTypes.js.map`
- `src/entrypoints/sdk/controlTypes.ts`
- `src/entrypoints/sdk/coreSchemas.js.map`
- `src/entrypoints/sdk/coreSchemas.ts`
- `src/entrypoints/sdk/coreTypes.generated.js.map`
- `src/entrypoints/sdk/coreTypes.generated.ts`
- `src/entrypoints/sdk/coreTypes.js.map`
- `src/entrypoints/sdk/coreTypes.ts`
- `src/entrypoints/sdk/runtimeTypes.js.map`
- `src/entrypoints/sdk/runtimeTypes.ts`
- `src/entrypoints/sdk/sdkUtilityTypes.js.map`
- `src/entrypoints/sdk/sdkUtilityTypes.ts`
- `src/entrypoints/sdk/settingsTypes.generated.js.map`
- `src/entrypoints/sdk/settingsTypes.generated.ts`
- `src/entrypoints/sdk/toolTypes.js.map`
- `src/entrypoints/sdk/toolTypes.ts`

</details>

<details><summary><code>src/hooks/notifs</code> — 17 个</summary>

- `src/hooks/notifs/useAntOrgWarningNotification.ts`
- `src/hooks/notifs/useAutoModeUnavailableNotification.ts`
- `src/hooks/notifs/useCanSwitchToExistingSubscription.tsx`
- `src/hooks/notifs/useDeprecationWarningNotification.tsx`
- `src/hooks/notifs/useFastModeNotification.tsx`
- `src/hooks/notifs/useIDEStatusIndicator.tsx`
- `src/hooks/notifs/useInstallMessages.tsx`
- `src/hooks/notifs/useLspInitializationNotification.tsx`
- `src/hooks/notifs/useMcpConnectivityStatus.tsx`
- `src/hooks/notifs/useModelMigrationNotifications.tsx`
- `src/hooks/notifs/useNpmDeprecationNotification.tsx`
- `src/hooks/notifs/usePluginAutoupdateNotification.tsx`
- `src/hooks/notifs/usePluginInstallationStatus.tsx`
- `src/hooks/notifs/useRateLimitWarningNotification.tsx`
- `src/hooks/notifs/useSettingsErrors.tsx`
- `src/hooks/notifs/useStartupNotification.ts`
- `src/hooks/notifs/useTeammateShutdownNotification.ts`

</details>

<details><summary><code>src/renderer/src</code> — 16 个</summary>

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
- `src/renderer/src/stores/logsStore.ts`
- `src/renderer/src/stores/promptsStore.ts`
- `src/renderer/src/types/electron.d.ts`
- `src/renderer/src/vite-env.d.ts`

</details>

<details><summary><code>src/services/lsp</code> — 16 个</summary>

- `src/services/lsp/config.js.map`
- `src/services/lsp/config.ts`
- `src/services/lsp/LSPClient.js.map`
- `src/services/lsp/LSPClient.ts`
- `src/services/lsp/LSPDiagnosticRegistry.js.map`
- `src/services/lsp/LSPDiagnosticRegistry.ts`
- `src/services/lsp/LSPServerInstance.js.map`
- `src/services/lsp/LSPServerInstance.ts`
- `src/services/lsp/LSPServerManager.js.map`
- `src/services/lsp/LSPServerManager.ts`
- `src/services/lsp/manager.js.map`
- `src/services/lsp/manager.ts`
- `src/services/lsp/passiveFeedback.js.map`
- `src/services/lsp/passiveFeedback.ts`
- `src/services/lsp/types.js.map`
- `src/services/lsp/types.ts`

</details>

<details><summary><code>src/cli/transports</code> — 15 个</summary>

- `src/cli/transports/ccrClient.js.map`
- `src/cli/transports/ccrClient.ts`
- `src/cli/transports/HybridTransport.js.map`
- `src/cli/transports/HybridTransport.ts`
- `src/cli/transports/SerialBatchEventUploader.js.map`
- `src/cli/transports/SerialBatchEventUploader.ts`
- `src/cli/transports/SSETransport.js.map`
- `src/cli/transports/SSETransport.ts`
- `src/cli/transports/Transport.js.map`
- `src/cli/transports/Transport.ts`
- `src/cli/transports/transportUtils.ts`
- `src/cli/transports/WebSocketTransport.js.map`
- `src/cli/transports/WebSocketTransport.ts`
- `src/cli/transports/WorkerStateUploader.js.map`
- `src/cli/transports/WorkerStateUploader.ts`

</details>

<details><summary><code>src/components/mcp</code> — 15 个</summary>

- `src/components/mcp/CapabilitiesSection.tsx`
- `src/components/mcp/ElicitationDialog.tsx`
- `src/components/mcp/index.ts`
- `src/components/mcp/MCPAgentServerMenu.tsx`
- `src/components/mcp/MCPListPanel.tsx`
- `src/components/mcp/McpParsingWarnings.tsx`
- `src/components/mcp/MCPReconnect.tsx`
- `src/components/mcp/MCPRemoteServerMenu.tsx`
- `src/components/mcp/MCPSettings.tsx`
- `src/components/mcp/MCPStdioServerMenu.tsx`
- `src/components/mcp/MCPToolDetailView.tsx`
- `src/components/mcp/MCPToolListView.tsx`
- `src/components/mcp/types.js.map`
- `src/components/mcp/types.ts`
- `src/components/mcp/utils/reconnectHelpers.tsx`

</details>

<details><summary><code>src/ink/termio</code> — 15 个</summary>

- `src/ink/termio/ansi.js.map`
- `src/ink/termio/ansi.ts`
- `src/ink/termio/csi.js.map`
- `src/ink/termio/csi.ts`
- `src/ink/termio/dec.js.map`
- `src/ink/termio/dec.ts`
- `src/ink/termio/esc.ts`
- `src/ink/termio/osc.js.map`
- `src/ink/termio/osc.ts`
- `src/ink/termio/parser.ts`
- `src/ink/termio/sgr.ts`
- `src/ink/termio/tokenize.js.map`
- `src/ink/termio/tokenize.ts`
- `src/ink/termio/types.js.map`
- `src/ink/termio/types.ts`

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

<details><summary><code>src/tools/PowerShellTool</code> — 15 个</summary>

- `src/tools/PowerShellTool/clmTypes.ts`
- `src/tools/PowerShellTool/commandSemantics.ts`
- `src/tools/PowerShellTool/commonParameters.ts`
- `src/tools/PowerShellTool/destructiveCommandWarning.ts`
- `src/tools/PowerShellTool/gitSafety.ts`
- `src/tools/PowerShellTool/modeValidation.ts`
- `src/tools/PowerShellTool/pathValidation.ts`
- `src/tools/PowerShellTool/powershellPermissions.ts`
- `src/tools/PowerShellTool/powershellSecurity.ts`
- `src/tools/PowerShellTool/PowerShellTool.tsx`
- `src/tools/PowerShellTool/prompt.ts`
- `src/tools/PowerShellTool/readOnlyValidation.ts`
- `src/tools/PowerShellTool/toolName.js.map`
- `src/tools/PowerShellTool/toolName.ts`
- `src/tools/PowerShellTool/UI.tsx`

</details>

<details><summary><code>src/components/Spinner</code> — 14 个</summary>

- `src/components/Spinner/FlashingChar.tsx`
- `src/components/Spinner/GlimmerMessage.tsx`
- `src/components/Spinner/index.ts`
- `src/components/Spinner/ShimmerChar.tsx`
- `src/components/Spinner/SpinnerAnimationRow.tsx`
- `src/components/Spinner/SpinnerGlyph.tsx`
- `src/components/Spinner/teammateSelectHint.ts`
- `src/components/Spinner/TeammateSpinnerLine.tsx`
- `src/components/Spinner/TeammateSpinnerTree.tsx`
- `src/components/Spinner/TimeGradientMessage.tsx`
- `src/components/Spinner/types.ts`
- `src/components/Spinner/useShimmerAnimation.ts`
- `src/components/Spinner/useStalledAnimation.ts`
- `src/components/Spinner/utils.ts`

</details>

<details><summary><code>src/components/tasks</code> — 14 个</summary>

- `src/components/tasks/AsyncAgentDetailDialog.tsx`
- `src/components/tasks/BackgroundTask.tsx`
- `src/components/tasks/BackgroundTasksDialog.tsx`
- `src/components/tasks/BackgroundTaskStatus.tsx`
- `src/components/tasks/DreamDetailDialog.tsx`
- `src/components/tasks/InProcessTeammateDetailDialog.tsx`
- `src/components/tasks/MonitorMcpDetailDialog.tsx`
- `src/components/tasks/RemoteSessionDetailDialog.tsx`
- `src/components/tasks/RemoteSessionProgress.tsx`
- `src/components/tasks/renderToolActivity.tsx`
- `src/components/tasks/ShellDetailDialog.tsx`
- `src/components/tasks/ShellProgress.tsx`
- `src/components/tasks/taskStatusUtils.tsx`
- `src/components/tasks/WorkflowDetailDialog.tsx`

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

<details><summary><code>src/services/skillSearch</code> — 14 个</summary>

- `src/services/skillSearch/featureCheck.js.map`
- `src/services/skillSearch/featureCheck.ts`
- `src/services/skillSearch/localSearch.js.map`
- `src/services/skillSearch/localSearch.ts`
- `src/services/skillSearch/prefetch.js.map`
- `src/services/skillSearch/prefetch.ts`
- `src/services/skillSearch/remoteSkillLoader.js.map`
- `src/services/skillSearch/remoteSkillLoader.ts`
- `src/services/skillSearch/remoteSkillState.js.map`
- `src/services/skillSearch/remoteSkillState.ts`
- `src/services/skillSearch/signals.js.map`
- `src/services/skillSearch/signals.ts`
- `src/services/skillSearch/telemetry.js.map`
- `src/services/skillSearch/telemetry.ts`

</details>

<details><summary><code>src/commands/loop</code> — 13 个</summary>

- `src/commands/loop/engine.ts`
- `src/commands/loop/index.tsx`
- `src/commands/loop/shortcuts.ts`
- `src/commands/loop/strategies/autogpt.ts`
- `src/commands/loop/strategies/base.ts`
- `src/commands/loop/strategies/crew.ts`
- `src/commands/loop/strategies/index.ts`
- `src/commands/loop/strategies/langgraph.ts`
- `src/commands/loop/strategies/openhands.ts`
- `src/commands/loop/strategies/swe-agent.ts`
- `src/commands/loop/strategy-examples.ts`
- `src/commands/loop/strategy-manuals.ts`
- `src/commands/loop/types.ts`

</details>

<details><summary><code>src/services/oauth</code> — 12 个</summary>

- `src/services/oauth/auth-code-listener.js.map`
- `src/services/oauth/auth-code-listener.ts`
- `src/services/oauth/client.js.map`
- `src/services/oauth/client.ts`
- `src/services/oauth/crypto.js.map`
- `src/services/oauth/crypto.ts`
- `src/services/oauth/getOauthProfile.js.map`
- `src/services/oauth/getOauthProfile.ts`
- `src/services/oauth/index.js.map`
- `src/services/oauth/index.ts`
- `src/services/oauth/types.js.map`
- `src/services/oauth/types.ts`

</details>

<details><summary><code>src/tools/MultiSearchTool</code> — 12 个</summary>

- `src/tools/MultiSearchTool/engines/baidu.js.map`
- `src/tools/MultiSearchTool/engines/baidu.ts`
- `src/tools/MultiSearchTool/engines/bing.js.map`
- `src/tools/MultiSearchTool/engines/bing.ts`
- `src/tools/MultiSearchTool/engines/duckduckgo.js.map`
- `src/tools/MultiSearchTool/engines/duckduckgo.ts`
- `src/tools/MultiSearchTool/engines/index.js.map`
- `src/tools/MultiSearchTool/engines/index.ts`
- `src/tools/MultiSearchTool/MultiSearchTool.js.map`
- `src/tools/MultiSearchTool/MultiSearchTool.ts`
- `src/tools/MultiSearchTool/types.js.map`
- `src/tools/MultiSearchTool/types.ts`

</details>

<details><summary><code>src/components/FeedbackSurvey</code> — 11 个</summary>

- `src/components/FeedbackSurvey/FeedbackSurvey.tsx`
- `src/components/FeedbackSurvey/FeedbackSurveyView.tsx`
- `src/components/FeedbackSurvey/submitTranscriptShare.ts`
- `src/components/FeedbackSurvey/TranscriptSharePrompt.tsx`
- `src/components/FeedbackSurvey/useDebouncedDigitInput.ts`
- `src/components/FeedbackSurvey/useFeedbackSurvey.tsx`
- `src/components/FeedbackSurvey/useFrustrationDetection.ts`
- `src/components/FeedbackSurvey/useMemorySurvey.tsx`
- `src/components/FeedbackSurvey/usePostCompactSurvey.tsx`
- `src/components/FeedbackSurvey/useSurveyState.tsx`
- `src/components/FeedbackSurvey/utils.ts`

</details>

<details><summary><code>src/tools/FileEditTool</code> — 11 个</summary>

- `src/tools/FileEditTool/constants.js.map`
- `src/tools/FileEditTool/constants.ts`
- `src/tools/FileEditTool/FileEditTool.js.map`
- `src/tools/FileEditTool/FileEditTool.ts`
- `src/tools/FileEditTool/prompt.js.map`
- `src/tools/FileEditTool/prompt.ts`
- `src/tools/FileEditTool/types.js.map`
- `src/tools/FileEditTool/types.ts`
- `src/tools/FileEditTool/UI.tsx`
- `src/tools/FileEditTool/utils.js.map`
- `src/tools/FileEditTool/utils.ts`

</details>

<details><summary><code>src/components/CustomSelect</code> — 10 个</summary>

- `src/components/CustomSelect/index.ts`
- `src/components/CustomSelect/option-map.ts`
- `src/components/CustomSelect/select-input-option.tsx`
- `src/components/CustomSelect/select-option.tsx`
- `src/components/CustomSelect/select.tsx`
- `src/components/CustomSelect/SelectMulti.tsx`
- `src/components/CustomSelect/use-multi-select-state.ts`
- `src/components/CustomSelect/use-select-input.ts`
- `src/components/CustomSelect/use-select-navigation.ts`
- `src/components/CustomSelect/use-select-state.ts`

</details>

<details><summary><code>src/services/teamMemorySync</code> — 10 个</summary>

- `src/services/teamMemorySync/index.js.map`
- `src/services/teamMemorySync/index.ts`
- `src/services/teamMemorySync/secretScanner.js.map`
- `src/services/teamMemorySync/secretScanner.ts`
- `src/services/teamMemorySync/teamMemSecretGuard.js.map`
- `src/services/teamMemorySync/teamMemSecretGuard.ts`
- `src/services/teamMemorySync/types.js.map`
- `src/services/teamMemorySync/types.ts`
- `src/services/teamMemorySync/watcher.js.map`
- `src/services/teamMemorySync/watcher.ts`

</details>

<details><summary><code>src/tools/LSPTool</code> — 10 个</summary>

- `src/tools/LSPTool/formatters.js.map`
- `src/tools/LSPTool/formatters.ts`
- `src/tools/LSPTool/LSPTool.js.map`
- `src/tools/LSPTool/LSPTool.ts`
- `src/tools/LSPTool/prompt.js.map`
- `src/tools/LSPTool/prompt.ts`
- `src/tools/LSPTool/schemas.js.map`
- `src/tools/LSPTool/schemas.ts`
- `src/tools/LSPTool/symbolContext.ts`
- `src/tools/LSPTool/UI.tsx`

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

<details><summary><code>src/tools/BriefTool</code> — 9 个</summary>

- `src/tools/BriefTool/attachments.js.map`
- `src/tools/BriefTool/attachments.ts`
- `src/tools/BriefTool/BriefTool.js.map`
- `src/tools/BriefTool/BriefTool.ts`
- `src/tools/BriefTool/prompt.js.map`
- `src/tools/BriefTool/prompt.ts`
- `src/tools/BriefTool/UI.tsx`
- `src/tools/BriefTool/upload.js.map`
- `src/tools/BriefTool/upload.ts`

</details>

<details><summary><code>src/tools/ConfigTool</code> — 9 个</summary>

- `src/tools/ConfigTool/ConfigTool.js.map`
- `src/tools/ConfigTool/ConfigTool.ts`
- `src/tools/ConfigTool/constants.js.map`
- `src/tools/ConfigTool/constants.ts`
- `src/tools/ConfigTool/prompt.js.map`
- `src/tools/ConfigTool/prompt.ts`
- `src/tools/ConfigTool/supportedSettings.js.map`
- `src/tools/ConfigTool/supportedSettings.ts`
- `src/tools/ConfigTool/UI.tsx`

</details>

<details><summary><code>src/tools/FileReadTool</code> — 9 个</summary>

- `src/tools/FileReadTool/FileReadTool.js.map`
- `src/tools/FileReadTool/FileReadTool.ts`
- `src/tools/FileReadTool/imageProcessor.js.map`
- `src/tools/FileReadTool/imageProcessor.ts`
- `src/tools/FileReadTool/limits.js.map`
- `src/tools/FileReadTool/limits.ts`
- `src/tools/FileReadTool/prompt.js.map`
- `src/tools/FileReadTool/prompt.ts`
- `src/tools/FileReadTool/UI.tsx`

</details>

<details><summary><code>src/tools/WebFetchTool</code> — 9 个</summary>

- `src/tools/WebFetchTool/preapproved.js.map`
- `src/tools/WebFetchTool/preapproved.ts`
- `src/tools/WebFetchTool/prompt.js.map`
- `src/tools/WebFetchTool/prompt.ts`
- `src/tools/WebFetchTool/UI.tsx`
- `src/tools/WebFetchTool/utils.js.map`
- `src/tools/WebFetchTool/utils.ts`
- `src/tools/WebFetchTool/WebFetchTool.js.map`
- `src/tools/WebFetchTool/WebFetchTool.ts`

</details>

<details><summary><code>src/tools/WorkflowTool</code> — 9 个</summary>

- `src/tools/WorkflowTool/bundled/index.ts`
- `src/tools/WorkflowTool/constants.js.map`
- `src/tools/WorkflowTool/constants.ts`
- `src/tools/WorkflowTool/createWorkflowCommand.js.map`
- `src/tools/WorkflowTool/createWorkflowCommand.ts`
- `src/tools/WorkflowTool/WorkflowPermissionRequest.ts`
- `src/tools/WorkflowTool/WorkflowPermissionRequest.tsx`
- `src/tools/WorkflowTool/WorkflowTool.js.map`
- `src/tools/WorkflowTool/WorkflowTool.ts`

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

<details><summary><code>src/cli/handlers</code> — 8 个</summary>

- `src/cli/handlers/agents.ts`
- `src/cli/handlers/ant.ts`
- `src/cli/handlers/auth.ts`
- `src/cli/handlers/autoMode.ts`
- `src/cli/handlers/mcp.tsx`
- `src/cli/handlers/plugins.ts`
- `src/cli/handlers/templateJobs.ts`
- `src/cli/handlers/util.tsx`

</details>

<details><summary><code>src/ink/layout</code> — 8 个</summary>

- `src/ink/layout/engine.js.map`
- `src/ink/layout/engine.ts`
- `src/ink/layout/geometry.js.map`
- `src/ink/layout/geometry.ts`
- `src/ink/layout/node.js.map`
- `src/ink/layout/node.ts`
- `src/ink/layout/yoga.js.map`
- `src/ink/layout/yoga.ts`

</details>

<details><summary><code>src/services/autoDream</code> — 8 个</summary>

- `src/services/autoDream/autoDream.js.map`
- `src/services/autoDream/autoDream.ts`
- `src/services/autoDream/config.js.map`
- `src/services/autoDream/config.ts`
- `src/services/autoDream/consolidationLock.js.map`
- `src/services/autoDream/consolidationLock.ts`
- `src/services/autoDream/consolidationPrompt.js.map`
- `src/services/autoDream/consolidationPrompt.ts`

</details>

<details><summary><code>src/services/tools</code> — 8 个</summary>

- `src/services/tools/StreamingToolExecutor.js.map`
- `src/services/tools/StreamingToolExecutor.ts`
- `src/services/tools/toolExecution.js.map`
- `src/services/tools/toolExecution.ts`
- `src/services/tools/toolHooks.js.map`
- `src/services/tools/toolHooks.ts`
- `src/services/tools/toolOrchestration.js.map`
- `src/services/tools/toolOrchestration.ts`

</details>

<details><summary><code>src/commands/extra-usage</code> — 7 个</summary>

- `src/commands/extra-usage/extra-usage-core.js.map`
- `src/commands/extra-usage/extra-usage-core.ts`
- `src/commands/extra-usage/extra-usage-noninteractive.js.map`
- `src/commands/extra-usage/extra-usage-noninteractive.ts`
- `src/commands/extra-usage/extra-usage.tsx`
- `src/commands/extra-usage/index.js.map`
- `src/commands/extra-usage/index.ts`

</details>

<details><summary><code>src/hooks/toolPermission</code> — 7 个</summary>

- `src/hooks/toolPermission/handlers/coordinatorHandler.ts`
- `src/hooks/toolPermission/handlers/interactiveHandler.ts`
- `src/hooks/toolPermission/handlers/swarmWorkerHandler.ts`
- `src/hooks/toolPermission/PermissionContext.js.map`
- `src/hooks/toolPermission/PermissionContext.ts`
- `src/hooks/toolPermission/permissionLogging.js.map`
- `src/hooks/toolPermission/permissionLogging.ts`

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

<details><summary><code>src/tools/EnterPlanModeTool</code> — 7 个</summary>

- `src/tools/EnterPlanModeTool/constants.js.map`
- `src/tools/EnterPlanModeTool/constants.ts`
- `src/tools/EnterPlanModeTool/EnterPlanModeTool.js.map`
- `src/tools/EnterPlanModeTool/EnterPlanModeTool.ts`
- `src/tools/EnterPlanModeTool/prompt.js.map`
- `src/tools/EnterPlanModeTool/prompt.ts`
- `src/tools/EnterPlanModeTool/UI.tsx`

</details>

<details><summary><code>src/tools/EnterWorktreeTool</code> — 7 个</summary>

- `src/tools/EnterWorktreeTool/constants.js.map`
- `src/tools/EnterWorktreeTool/constants.ts`
- `src/tools/EnterWorktreeTool/EnterWorktreeTool.js.map`
- `src/tools/EnterWorktreeTool/EnterWorktreeTool.ts`
- `src/tools/EnterWorktreeTool/prompt.js.map`
- `src/tools/EnterWorktreeTool/prompt.ts`
- `src/tools/EnterWorktreeTool/UI.tsx`

</details>

<details><summary><code>src/tools/ExitPlanModeTool</code> — 7 个</summary>

- `src/tools/ExitPlanModeTool/constants.js.map`
- `src/tools/ExitPlanModeTool/constants.ts`
- `src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.js.map`
- `src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts`
- `src/tools/ExitPlanModeTool/prompt.js.map`
- `src/tools/ExitPlanModeTool/prompt.ts`
- `src/tools/ExitPlanModeTool/UI.tsx`

</details>

<details><summary><code>src/tools/ExitWorktreeTool</code> — 7 个</summary>

- `src/tools/ExitWorktreeTool/constants.js.map`
- `src/tools/ExitWorktreeTool/constants.ts`
- `src/tools/ExitWorktreeTool/ExitWorktreeTool.js.map`
- `src/tools/ExitWorktreeTool/ExitWorktreeTool.ts`
- `src/tools/ExitWorktreeTool/prompt.js.map`
- `src/tools/ExitWorktreeTool/prompt.ts`
- `src/tools/ExitWorktreeTool/UI.tsx`

</details>

<details><summary><code>src/tools/MCPTool</code> — 7 个</summary>

- `src/tools/MCPTool/classifyForCollapse.js.map`
- `src/tools/MCPTool/classifyForCollapse.ts`
- `src/tools/MCPTool/MCPTool.js.map`
- `src/tools/MCPTool/MCPTool.ts`
- `src/tools/MCPTool/prompt.js.map`
- `src/tools/MCPTool/prompt.ts`
- `src/tools/MCPTool/UI.tsx`

</details>

<details><summary><code>src/tools/NotebookEditTool</code> — 7 个</summary>

- `src/tools/NotebookEditTool/constants.js.map`
- `src/tools/NotebookEditTool/constants.ts`
- `src/tools/NotebookEditTool/NotebookEditTool.js.map`
- `src/tools/NotebookEditTool/NotebookEditTool.ts`
- `src/tools/NotebookEditTool/prompt.js.map`
- `src/tools/NotebookEditTool/prompt.ts`
- `src/tools/NotebookEditTool/UI.tsx`

</details>

<details><summary><code>src/tools/SendMessageTool</code> — 7 个</summary>

- `src/tools/SendMessageTool/constants.js.map`
- `src/tools/SendMessageTool/constants.ts`
- `src/tools/SendMessageTool/prompt.js.map`
- `src/tools/SendMessageTool/prompt.ts`
- `src/tools/SendMessageTool/SendMessageTool.js.map`
- `src/tools/SendMessageTool/SendMessageTool.ts`
- `src/tools/SendMessageTool/UI.tsx`

</details>

<details><summary><code>src/tools/SkillTool</code> — 7 个</summary>

- `src/tools/SkillTool/constants.js.map`
- `src/tools/SkillTool/constants.ts`
- `src/tools/SkillTool/prompt.js.map`
- `src/tools/SkillTool/prompt.ts`
- `src/tools/SkillTool/SkillTool.js.map`
- `src/tools/SkillTool/SkillTool.ts`
- `src/tools/SkillTool/UI.tsx`

</details>

<details><summary><code>src/tools/TeamCreateTool</code> — 7 个</summary>

- `src/tools/TeamCreateTool/constants.js.map`
- `src/tools/TeamCreateTool/constants.ts`
- `src/tools/TeamCreateTool/prompt.js.map`
- `src/tools/TeamCreateTool/prompt.ts`
- `src/tools/TeamCreateTool/TeamCreateTool.js.map`
- `src/tools/TeamCreateTool/TeamCreateTool.ts`
- `src/tools/TeamCreateTool/UI.tsx`

</details>

<details><summary><code>src/tools/TeamDeleteTool</code> — 7 个</summary>

- `src/tools/TeamDeleteTool/constants.js.map`
- `src/tools/TeamDeleteTool/constants.ts`
- `src/tools/TeamDeleteTool/prompt.js.map`
- `src/tools/TeamDeleteTool/prompt.ts`
- `src/tools/TeamDeleteTool/TeamDeleteTool.js.map`
- `src/tools/TeamDeleteTool/TeamDeleteTool.ts`
- `src/tools/TeamDeleteTool/UI.tsx`

</details>

<details><summary><code>src/commands/assistant</code> — 6 个</summary>

- `src/commands/assistant/assistant.ts`
- `src/commands/assistant/assistant.tsx`
- `src/commands/assistant/AssistantSessionChooser.ts`
- `src/commands/assistant/index.ts`
- `src/commands/assistant/sessionDiscovery.ts`
- `src/commands/assistant/sessionHistory.ts`

</details>

<details><summary><code>src/commands/dependency-analyzer</code> — 6 个</summary>

- `src/commands/dependency-analyzer/dependencyAnalyzer.ts`
- `src/commands/dependency-analyzer/dependencyAnalyzer.ts.backup`
- `src/commands/dependency-analyzer/dependency_analyzer.js.map`
- `src/commands/dependency-analyzer/dependency_analyzer.ts`
- `src/commands/dependency-analyzer/index.js.map`
- `src/commands/dependency-analyzer/index.ts`

</details>

<details><summary><code>src/commands/notebook</code> — 6 个</summary>

- `src/commands/notebook/index.js.map`
- `src/commands/notebook/index.ts`
- `src/commands/notebook/notebook-list.tsx`
- `src/commands/notebook/notebook-ui.tsx`
- `src/commands/notebook/notebook-view.tsx`
- `src/commands/notebook/notebook.ts`

</details>

<details><summary><code>src/commands/rename</code> — 6 个</summary>

- `src/commands/rename/generateSessionName.js.map`
- `src/commands/rename/generateSessionName.ts`
- `src/commands/rename/index.js.map`
- `src/commands/rename/index.ts`
- `src/commands/rename/rename.js.map`
- `src/commands/rename/rename.ts`

</details>

<details><summary><code>src/commands/terminalSetup</code> — 6 个</summary>

- `src/commands/terminalSetup/index.js.map`
- `src/commands/terminalSetup/index.ts`
- `src/commands/terminalSetup/src/utils/theme.ts`
- `src/commands/terminalSetup/terminalSetup.js.map`
- `src/commands/terminalSetup/terminalSetup.ts`
- `src/commands/terminalSetup/terminalSetup.tsx`

</details>

<details><summary><code>src/components/hooks</code> — 6 个</summary>

- `src/components/hooks/HooksConfigMenu.tsx`
- `src/components/hooks/PromptDialog.tsx`
- `src/components/hooks/SelectEventMode.tsx`
- `src/components/hooks/SelectHookMode.tsx`
- `src/components/hooks/SelectMatcherMode.tsx`
- `src/components/hooks/ViewHookMode.tsx`

</details>

<details><summary><code>src/components/wizard</code> — 6 个</summary>

- `src/components/wizard/index.ts`
- `src/components/wizard/types.ts`
- `src/components/wizard/useWizard.ts`
- `src/components/wizard/WizardDialogLayout.tsx`
- `src/components/wizard/WizardNavigationFooter.tsx`
- `src/components/wizard/WizardProvider.tsx`

</details>

<details><summary><code>src/services/remoteManagedSettings</code> — 6 个</summary>

- `src/services/remoteManagedSettings/index.ts`
- `src/services/remoteManagedSettings/securityCheck.tsx`
- `src/services/remoteManagedSettings/syncCache.ts`
- `src/services/remoteManagedSettings/syncCacheState.js.map`
- `src/services/remoteManagedSettings/syncCacheState.ts`
- `src/services/remoteManagedSettings/types.ts`

</details>

<details><summary><code>src/tools/ScheduleCronTool</code> — 6 个</summary>

- `src/tools/ScheduleCronTool/CronCreateTool.ts`
- `src/tools/ScheduleCronTool/CronDeleteTool.ts`
- `src/tools/ScheduleCronTool/CronListTool.ts`
- `src/tools/ScheduleCronTool/prompt.js.map`
- `src/tools/ScheduleCronTool/prompt.ts`
- `src/tools/ScheduleCronTool/UI.tsx`

</details>

<details><summary><code>src/tools/TaskCreateTool</code> — 6 个</summary>

- `src/tools/TaskCreateTool/constants.js.map`
- `src/tools/TaskCreateTool/constants.ts`
- `src/tools/TaskCreateTool/prompt.js.map`
- `src/tools/TaskCreateTool/prompt.ts`
- `src/tools/TaskCreateTool/TaskCreateTool.js.map`
- `src/tools/TaskCreateTool/TaskCreateTool.ts`

</details>

<details><summary><code>src/tools/TaskGetTool</code> — 6 个</summary>

- `src/tools/TaskGetTool/constants.js.map`
- `src/tools/TaskGetTool/constants.ts`
- `src/tools/TaskGetTool/prompt.js.map`
- `src/tools/TaskGetTool/prompt.ts`
- `src/tools/TaskGetTool/TaskGetTool.js.map`
- `src/tools/TaskGetTool/TaskGetTool.ts`

</details>

<details><summary><code>src/tools/TaskListTool</code> — 6 个</summary>

- `src/tools/TaskListTool/constants.js.map`
- `src/tools/TaskListTool/constants.ts`
- `src/tools/TaskListTool/prompt.js.map`
- `src/tools/TaskListTool/prompt.ts`
- `src/tools/TaskListTool/TaskListTool.js.map`
- `src/tools/TaskListTool/TaskListTool.ts`

</details>

<details><summary><code>src/tools/TaskUpdateTool</code> — 6 个</summary>

- `src/tools/TaskUpdateTool/constants.js.map`
- `src/tools/TaskUpdateTool/constants.ts`
- `src/tools/TaskUpdateTool/prompt.js.map`
- `src/tools/TaskUpdateTool/prompt.ts`
- `src/tools/TaskUpdateTool/TaskUpdateTool.js.map`
- `src/tools/TaskUpdateTool/TaskUpdateTool.ts`

</details>

<details><summary><code>src/tools/TodoWriteTool</code> — 6 个</summary>

- `src/tools/TodoWriteTool/constants.js.map`
- `src/tools/TodoWriteTool/constants.ts`
- `src/tools/TodoWriteTool/prompt.js.map`
- `src/tools/TodoWriteTool/prompt.ts`
- `src/tools/TodoWriteTool/TodoWriteTool.js.map`
- `src/tools/TodoWriteTool/TodoWriteTool.ts`

</details>

<details><summary><code>src/tools/ToolSearchTool</code> — 6 个</summary>

- `src/tools/ToolSearchTool/constants.js.map`
- `src/tools/ToolSearchTool/constants.ts`
- `src/tools/ToolSearchTool/prompt.js.map`
- `src/tools/ToolSearchTool/prompt.ts`
- `src/tools/ToolSearchTool/ToolSearchTool.js.map`
- `src/tools/ToolSearchTool/ToolSearchTool.ts`

</details>

<details><summary><code>src/tools/WebSearchTool</code> — 6 个</summary>

- `src/tools/WebSearchTool/prompt.js.map`
- `src/tools/WebSearchTool/prompt.ts`
- `src/tools/WebSearchTool/UI.tsx`
- `src/tools/WebSearchTool/WebSearchTool.js.map`
- `src/tools/WebSearchTool/WebSearchTool.ts`
- `src/tools/WebSearchTool/WebSearchTool_old.bak`

</details>

<details><summary><code>src/commands/add-dir</code> — 5 个</summary>

- `src/commands/add-dir/add-dir.tsx`
- `src/commands/add-dir/index.js.map`
- `src/commands/add-dir/index.ts`
- `src/commands/add-dir/validation.js.map`
- `src/commands/add-dir/validation.ts`

</details>

<details><summary><code>src/commands/code-review-assistant</code> — 5 个</summary>

- `src/commands/code-review-assistant/codeReviewAssistant.ts`
- `src/commands/code-review-assistant/code_review_assistant.js.map`
- `src/commands/code-review-assistant/code_review_assistant.ts`
- `src/commands/code-review-assistant/index.js.map`
- `src/commands/code-review-assistant/index.ts`

</details>

<details><summary><code>src/commands/compact</code> — 5 个</summary>

- `src/commands/compact/compact.js.map`
- `src/commands/compact/compact.ts`
- `src/commands/compact/index.js.map`
- `src/commands/compact/index.ts`
- `src/commands/compact/src/bootstrap/state.ts`

</details>

<details><summary><code>src/commands/context</code> — 5 个</summary>

- `src/commands/context/context-noninteractive.js.map`
- `src/commands/context/context-noninteractive.ts`
- `src/commands/context/context.tsx`
- `src/commands/context/index.js.map`
- `src/commands/context/index.ts`

</details>

<details><summary><code>src/commands/context-collapse</code> — 5 个</summary>

- `src/commands/context-collapse/context-collapse.ts`
- `src/commands/context-collapse/contextCollapse.js.map`
- `src/commands/context-collapse/contextCollapse.ts`
- `src/commands/context-collapse/index.js.map`
- `src/commands/context-collapse/index.ts`

</details>

<details><summary><code>src/commands/database</code> — 5 个</summary>

- `src/commands/database/database-connection-pool.ts`
- `src/commands/database/database.js.map`
- `src/commands/database/database.ts`
- `src/commands/database/index.js.map`
- `src/commands/database/index.ts`

</details>

<details><summary><code>src/commands/file-watcher</code> — 5 个</summary>

- `src/commands/file-watcher/file-watcher.ts`
- `src/commands/file-watcher/fileWatcher.js.map`
- `src/commands/file-watcher/fileWatcher.ts`
- `src/commands/file-watcher/index.js.map`
- `src/commands/file-watcher/index.ts`

</details>

<details><summary><code>src/commands/mcp</code> — 5 个</summary>

- `src/commands/mcp/addCommand.ts`
- `src/commands/mcp/index.js.map`
- `src/commands/mcp/index.ts`
- `src/commands/mcp/mcp.tsx`
- `src/commands/mcp/xaaIdpCommand.ts`

</details>

<details><summary><code>src/commands/mcp-tool-search</code> — 5 个</summary>

- `src/commands/mcp-tool-search/index.js.map`
- `src/commands/mcp-tool-search/index.ts`
- `src/commands/mcp-tool-search/mcp-tool-search.ts`
- `src/commands/mcp-tool-search/mcpToolsearch.js.map`
- `src/commands/mcp-tool-search/mcpToolsearch.ts`

</details>

<details><summary><code>src/commands/mobile</code> — 5 个</summary>

- `src/commands/mobile/connect.ts`
- `src/commands/mobile/connect.tsx`
- `src/commands/mobile/index.js.map`
- `src/commands/mobile/index.ts`
- `src/commands/mobile/mobile.tsx`

</details>

<details><summary><code>src/commands/output-style</code> — 5 个</summary>

- `src/commands/output-style/index.js.map`
- `src/commands/output-style/index.ts`
- `src/commands/output-style/output-style.js.map`
- `src/commands/output-style/output-style.ts`
- `src/commands/output-style/output-style.tsx`

</details>

<details><summary><code>src/commands/plan-mode</code> — 5 个</summary>

- `src/commands/plan-mode/index.js.map`
- `src/commands/plan-mode/index.ts`
- `src/commands/plan-mode/plan-mode.ts`
- `src/commands/plan-mode/planMode.js.map`
- `src/commands/plan-mode/planMode.ts`

</details>

<details><summary><code>src/commands/review</code> — 5 个</summary>

- `src/commands/review/reviewRemote.ts`
- `src/commands/review/ultrareviewCommand.tsx`
- `src/commands/review/ultrareviewEnabled.js.map`
- `src/commands/review/ultrareviewEnabled.ts`
- `src/commands/review/UltrareviewOverageDialog.tsx`

</details>

<details><summary><code>src/commands/stock</code> — 5 个</summary>

- `src/commands/stock/api.js.map`
- `src/commands/stock/api.ts`
- `src/commands/stock/index.js.map`
- `src/commands/stock/index.ts`
- `src/commands/stock/test.txt`

</details>

<details><summary><code>src/commands/task-create</code> — 5 个</summary>

- `src/commands/task-create/index.js.map`
- `src/commands/task-create/index.ts`
- `src/commands/task-create/task-create.js.map`
- `src/commands/task-create/task-create.ts`
- `src/commands/task-create/taskCreate.ts`

</details>

<details><summary><code>src/components/sandbox</code> — 5 个</summary>

- `src/components/sandbox/SandboxConfigTab.tsx`
- `src/components/sandbox/SandboxDependenciesTab.tsx`
- `src/components/sandbox/SandboxDoctorSection.tsx`
- `src/components/sandbox/SandboxOverridesTab.tsx`
- `src/components/sandbox/SandboxSettings.tsx`

</details>

<details><summary><code>src/components/ui</code> — 5 个</summary>

- `src/components/ui/option.ts`
- `src/components/ui/option.tsx`
- `src/components/ui/OrderedList.tsx`
- `src/components/ui/OrderedListItem.tsx`
- `src/components/ui/TreeSelect.tsx`

</details>

<details><summary><code>src/main/ipc</code> — 5 个</summary>

- `src/main/ipc/channels.d.ts`
- `src/main/ipc/chat-handlers.d.ts`
- `src/main/ipc/handlers.d.ts`
- `src/main/ipc/index.d.ts`
- `src/main/ipc/index.ts`

</details>

<details><summary><code>src/services/contextCollapse</code> — 5 个</summary>

- `src/services/contextCollapse/index.js.map`
- `src/services/contextCollapse/index.ts`
- `src/services/contextCollapse/operations.js.map`
- `src/services/contextCollapse/operations.ts`
- `src/services/contextCollapse/persist.ts`

</details>

<details><summary><code>src/services/SessionMemory</code> — 5 个</summary>

- `src/services/SessionMemory/prompts.js.map`
- `src/services/SessionMemory/prompts.ts`
- `src/services/SessionMemory/sessionMemory.ts`
- `src/services/SessionMemory/sessionMemoryUtils.js.map`
- `src/services/SessionMemory/sessionMemoryUtils.ts`

</details>

<details><summary><code>src/tasks/LocalShellTask</code> — 5 个</summary>

- `src/tasks/LocalShellTask/guards.js.map`
- `src/tasks/LocalShellTask/guards.ts`
- `src/tasks/LocalShellTask/killShellTasks.js.map`
- `src/tasks/LocalShellTask/killShellTasks.ts`
- `src/tasks/LocalShellTask/LocalShellTask.tsx`

</details>

<details><summary><code>src/tools/FileWriteTool</code> — 5 个</summary>

- `src/tools/FileWriteTool/FileWriteTool.js.map`
- `src/tools/FileWriteTool/FileWriteTool.ts`
- `src/tools/FileWriteTool/prompt.js.map`
- `src/tools/FileWriteTool/prompt.ts`
- `src/tools/FileWriteTool/UI.tsx`

</details>

<details><summary><code>src/tools/GlobTool</code> — 5 个</summary>

- `src/tools/GlobTool/GlobTool.js.map`
- `src/tools/GlobTool/GlobTool.ts`
- `src/tools/GlobTool/prompt.js.map`
- `src/tools/GlobTool/prompt.ts`
- `src/tools/GlobTool/UI.tsx`

</details>

<details><summary><code>src/tools/GrepTool</code> — 5 个</summary>

- `src/tools/GrepTool/GrepTool.js.map`
- `src/tools/GrepTool/GrepTool.ts`
- `src/tools/GrepTool/prompt.js.map`
- `src/tools/GrepTool/prompt.ts`
- `src/tools/GrepTool/UI.tsx`

</details>

<details><summary><code>src/tools/ListMcpResourcesTool</code> — 5 个</summary>

- `src/tools/ListMcpResourcesTool/ListMcpResourcesTool.js.map`
- `src/tools/ListMcpResourcesTool/ListMcpResourcesTool.ts`
- `src/tools/ListMcpResourcesTool/prompt.js.map`
- `src/tools/ListMcpResourcesTool/prompt.ts`
- `src/tools/ListMcpResourcesTool/UI.tsx`

</details>

<details><summary><code>src/tools/ReadMcpResourceTool</code> — 5 个</summary>

- `src/tools/ReadMcpResourceTool/prompt.js.map`
- `src/tools/ReadMcpResourceTool/prompt.ts`
- `src/tools/ReadMcpResourceTool/ReadMcpResourceTool.js.map`
- `src/tools/ReadMcpResourceTool/ReadMcpResourceTool.ts`
- `src/tools/ReadMcpResourceTool/UI.tsx`

</details>

<details><summary><code>src/tools/TaskStopTool</code> — 5 个</summary>

- `src/tools/TaskStopTool/prompt.js.map`
- `src/tools/TaskStopTool/prompt.ts`
- `src/tools/TaskStopTool/TaskStopTool.js.map`
- `src/tools/TaskStopTool/TaskStopTool.ts`
- `src/tools/TaskStopTool/UI.tsx`

</details>

<details><summary><code>src/commands/add-model</code> — 4 个</summary>

- `src/commands/add-model/add-model.js.map`
- `src/commands/add-model/add-model.ts`
- `src/commands/add-model/index.js.map`
- `src/commands/add-model/index.ts`

</details>

<details><summary><code>src/commands/backup</code> — 4 个</summary>

- `src/commands/backup/backup.js.map`
- `src/commands/backup/backup.ts`
- `src/commands/backup/index.js.map`
- `src/commands/backup/index.ts`

</details>

<details><summary><code>src/commands/batch-han</code> — 4 个</summary>

- `src/commands/batch-han/batch-han.js.map`
- `src/commands/batch-han/batch-han.ts`
- `src/commands/batch-han/index.js.map`
- `src/commands/batch-han/index.ts`

</details>

<details><summary><code>src/commands/branch</code> — 4 个</summary>

- `src/commands/branch/branch.js.map`
- `src/commands/branch/branch.ts`
- `src/commands/branch/index.js.map`
- `src/commands/branch/index.ts`

</details>

<details><summary><code>src/commands/buddy</code> — 4 个</summary>

- `src/commands/buddy/buddy.js.map`
- `src/commands/buddy/buddy.ts`
- `src/commands/buddy/index.js.map`
- `src/commands/buddy/index.ts`

</details>

<details><summary><code>src/commands/changelog</code> — 4 个</summary>

- `src/commands/changelog/changelog.js.map`
- `src/commands/changelog/changelog.ts`
- `src/commands/changelog/index.js.map`
- `src/commands/changelog/index.ts`

</details>

<details><summary><code>src/commands/color</code> — 4 个</summary>

- `src/commands/color/color.js.map`
- `src/commands/color/color.ts`
- `src/commands/color/index.js.map`
- `src/commands/color/index.ts`

</details>

<details><summary><code>src/commands/compare</code> — 4 个</summary>

- `src/commands/compare/compare.js.map`
- `src/commands/compare/compare.ts`
- `src/commands/compare/index.js.map`
- `src/commands/compare/index.ts`

</details>

<details><summary><code>src/commands/copy-page</code> — 4 个</summary>

- `src/commands/copy-page/copy-page.js.map`
- `src/commands/copy-page/copy-page.ts`
- `src/commands/copy-page/index.js.map`
- `src/commands/copy-page/index.ts`

</details>

<details><summary><code>src/commands/cost</code> — 4 个</summary>

- `src/commands/cost/cost.js.map`
- `src/commands/cost/cost.ts`
- `src/commands/cost/index.js.map`
- `src/commands/cost/index.ts`

</details>

<details><summary><code>src/commands/cron</code> — 4 个</summary>

- `src/commands/cron/cron.js.map`
- `src/commands/cron/cron.ts`
- `src/commands/cron/index.js.map`
- `src/commands/cron/index.ts`

</details>

<details><summary><code>src/commands/documentation-index</code> — 4 个</summary>

- `src/commands/documentation-index/documentation-index.js.map`
- `src/commands/documentation-index/documentation-index.ts`
- `src/commands/documentation-index/index.js.map`
- `src/commands/documentation-index/index.ts`

</details>

<details><summary><code>src/commands/event-stream</code> — 4 个</summary>

- `src/commands/event-stream/eventStream.js.map`
- `src/commands/event-stream/eventStream.ts`
- `src/commands/event-stream/index.js.map`
- `src/commands/event-stream/index.ts`

</details>

<details><summary><code>src/commands/files</code> — 4 个</summary>

- `src/commands/files/files.js.map`
- `src/commands/files/files.ts`
- `src/commands/files/index.js.map`
- `src/commands/files/index.ts`

</details>

<details><summary><code>src/commands/focus</code> — 4 个</summary>

- `src/commands/focus/focus.js.map`
- `src/commands/focus/focus.ts`
- `src/commands/focus/index.js.map`
- `src/commands/focus/index.ts`

</details>

<details><summary><code>src/commands/getting-started</code> — 4 个</summary>

- `src/commands/getting-started/getting-started.js.map`
- `src/commands/getting-started/getting-started.ts`
- `src/commands/getting-started/index.js.map`
- `src/commands/getting-started/index.ts`

</details>

<details><summary><code>src/commands/graphql</code> — 4 个</summary>

- `src/commands/graphql/graphql.js.map`
- `src/commands/graphql/graphql.ts`
- `src/commands/graphql/index.js.map`
- `src/commands/graphql/index.ts`

</details>

<details><summary><code>src/commands/heapdump</code> — 4 个</summary>

- `src/commands/heapdump/heapdump.js.map`
- `src/commands/heapdump/heapdump.ts`
- `src/commands/heapdump/index.js.map`
- `src/commands/heapdump/index.ts`

</details>

<details><summary><code>src/commands/http</code> — 4 个</summary>

- `src/commands/http/http.js.map`
- `src/commands/http/http.ts`
- `src/commands/http/index.js.map`
- `src/commands/http/index.ts`

</details>

<details><summary><code>src/commands/ide</code> — 4 个</summary>

- `src/commands/ide/ide.tsx`
- `src/commands/ide/index.js.map`
- `src/commands/ide/index.ts`
- `src/commands/ide/src/services/analytics/index.ts`

</details>

<details><summary><code>src/commands/insights</code> — 4 个</summary>

- `src/commands/insights/index.js.map`
- `src/commands/insights/index.ts`
- `src/commands/insights/insights.js.map`
- `src/commands/insights/insights.ts`

</details>

<details><summary><code>src/commands/install-slack-app</code> — 4 个</summary>

- `src/commands/install-slack-app/index.js.map`
- `src/commands/install-slack-app/index.ts`
- `src/commands/install-slack-app/install-slack-app.js.map`
- `src/commands/install-slack-app/install-slack-app.ts`

</details>

<details><summary><code>src/commands/keybindings</code> — 4 个</summary>

- `src/commands/keybindings/index.js.map`
- `src/commands/keybindings/index.ts`
- `src/commands/keybindings/keybindings.js.map`
- `src/commands/keybindings/keybindings.ts`

</details>

<details><summary><code>src/commands/less-permission-prompts</code> — 4 个</summary>

- `src/commands/less-permission-prompts/index.js.map`
- `src/commands/less-permission-prompts/index.ts`
- `src/commands/less-permission-prompts/lessPermissionPrompts.js.map`
- `src/commands/less-permission-prompts/lessPermissionPrompts.ts`

</details>

<details><summary><code>src/commands/logger</code> — 4 个</summary>

- `src/commands/logger/index.js.map`
- `src/commands/logger/index.ts`
- `src/commands/logger/logger.js.map`
- `src/commands/logger/logger.ts`

</details>

<details><summary><code>src/commands/logout</code> — 4 个</summary>

- `src/commands/logout/index.js.map`
- `src/commands/logout/index.ts`
- `src/commands/logout/logout.js`
- `src/commands/logout/logout.tsx`

</details>

<details><summary><code>src/commands/memory</code> — 4 个</summary>

- `src/commands/memory/index.js.map`
- `src/commands/memory/index.ts`
- `src/commands/memory/memory.tsx`
- `src/commands/memory/memorySearch.ts`

</details>

<details><summary><code>src/commands/memory-monitor</code> — 4 个</summary>

- `src/commands/memory-monitor/index.js.map`
- `src/commands/memory-monitor/index.ts`
- `src/commands/memory-monitor/memoryMonitor.js.map`
- `src/commands/memory-monitor/memoryMonitor.ts`

</details>

<details><summary><code>src/commands/metrics</code> — 4 个</summary>

- `src/commands/metrics/index.js.map`
- `src/commands/metrics/index.ts`
- `src/commands/metrics/metrics.js.map`
- `src/commands/metrics/metrics.ts`

</details>

<details><summary><code>src/commands/monitor</code> — 4 个</summary>

- `src/commands/monitor/index.js.map`
- `src/commands/monitor/index.ts`
- `src/commands/monitor/monitor.js.map`
- `src/commands/monitor/monitor.ts`

</details>

<details><summary><code>src/commands/performance-profiler</code> — 4 个</summary>

- `src/commands/performance-profiler/index.js.map`
- `src/commands/performance-profiler/index.ts`
- `src/commands/performance-profiler/performance_profiler.js.map`
- `src/commands/performance-profiler/performance_profiler.ts`

</details>

<details><summary><code>src/commands/powerup</code> — 4 个</summary>

- `src/commands/powerup/index.js.map`
- `src/commands/powerup/index.ts`
- `src/commands/powerup/powerup.js.map`
- `src/commands/powerup/powerup.ts`

</details>

<details><summary><code>src/commands/project-purge</code> — 4 个</summary>

- `src/commands/project-purge/index.js.map`
- `src/commands/project-purge/index.ts`
- `src/commands/project-purge/project-purge.js.map`
- `src/commands/project-purge/project-purge.ts`

</details>

<details><summary><code>src/commands/queue</code> — 4 个</summary>

- `src/commands/queue/index.js.map`
- `src/commands/queue/index.ts`
- `src/commands/queue/queue.js.map`
- `src/commands/queue/queue.ts`

</details>

<details><summary><code>src/commands/rag</code> — 4 个</summary>

- `src/commands/rag/api.js.map`
- `src/commands/rag/api.ts`
- `src/commands/rag/index.js.map`
- `src/commands/rag/index.ts`

</details>

<details><summary><code>src/commands/release-notes</code> — 4 个</summary>

- `src/commands/release-notes/index.js.map`
- `src/commands/release-notes/index.ts`
- `src/commands/release-notes/release-notes.js.map`
- `src/commands/release-notes/release-notes.ts`

</details>

<details><summary><code>src/commands/reload-plugins</code> — 4 个</summary>

- `src/commands/reload-plugins/index.js.map`
- `src/commands/reload-plugins/index.ts`
- `src/commands/reload-plugins/reload-plugins.js.map`
- `src/commands/reload-plugins/reload-plugins.ts`

</details>

<details><summary><code>src/commands/remote-setup</code> — 4 个</summary>

- `src/commands/remote-setup/api.ts`
- `src/commands/remote-setup/index.js.map`
- `src/commands/remote-setup/index.ts`
- `src/commands/remote-setup/remote-setup.tsx`

</details>

<details><summary><code>src/commands/rewind</code> — 4 个</summary>

- `src/commands/rewind/index.js.map`
- `src/commands/rewind/index.ts`
- `src/commands/rewind/rewind.js.map`
- `src/commands/rewind/rewind.ts`

</details>

<details><summary><code>src/commands/rstk</code> — 4 个</summary>

- `src/commands/rstk/index.js.map`
- `src/commands/rstk/index.ts`
- `src/commands/rstk/rstk.js.map`
- `src/commands/rstk/rstk.ts`

</details>

<details><summary><code>src/commands/schedule</code> — 4 个</summary>

- `src/commands/schedule/index.js.map`
- `src/commands/schedule/index.ts`
- `src/commands/schedule/schedule.js.map`
- `src/commands/schedule/schedule.ts`

</details>

<details><summary><code>src/commands/shell</code> — 4 个</summary>

- `src/commands/shell/index.js.map`
- `src/commands/shell/index.ts`
- `src/commands/shell/shell.js.map`
- `src/commands/shell/shell.ts`

</details>

<details><summary><code>src/commands/skills-i18n</code> — 4 个</summary>

- `src/commands/skills-i18n/index.js.map`
- `src/commands/skills-i18n/index.ts`
- `src/commands/skills-i18n/skills-i18n.js.map`
- `src/commands/skills-i18n/skills-i18n.ts`

</details>

<details><summary><code>src/commands/stickers</code> — 4 个</summary>

- `src/commands/stickers/index.js.map`
- `src/commands/stickers/index.ts`
- `src/commands/stickers/stickers.js.map`
- `src/commands/stickers/stickers.ts`

</details>

<details><summary><code>src/commands/task</code> — 4 个</summary>

- `src/commands/task/index.js.map`
- `src/commands/task/index.ts`
- `src/commands/task/task.js.map`
- `src/commands/task/task.ts`

</details>

<details><summary><code>src/commands/team</code> — 4 个</summary>

- `src/commands/team/index.js.map`
- `src/commands/team/index.ts`
- `src/commands/team/team.js.map`
- `src/commands/team/team.ts`

</details>

<details><summary><code>src/commands/team-onboarding</code> — 4 个</summary>

- `src/commands/team-onboarding/index.js.map`
- `src/commands/team-onboarding/index.ts`
- `src/commands/team-onboarding/team-onboarding.js.map`
- `src/commands/team-onboarding/team-onboarding.ts`

</details>

<details><summary><code>src/commands/thinkback-play</code> — 4 个</summary>

- `src/commands/thinkback-play/index.js.map`
- `src/commands/thinkback-play/index.ts`
- `src/commands/thinkback-play/thinkback-play.js.map`
- `src/commands/thinkback-play/thinkback-play.ts`

</details>

<details><summary><code>src/commands/updateapikey</code> — 4 个</summary>

- `src/commands/updateapikey/index.js.map`
- `src/commands/updateapikey/index.ts`
- `src/commands/updateapikey/updateapikey.js.map`
- `src/commands/updateapikey/updateapikey.ts`

</details>

<details><summary><code>src/commands/vim</code> — 4 个</summary>

- `src/commands/vim/index.js.map`
- `src/commands/vim/index.ts`
- `src/commands/vim/vim.js.map`
- `src/commands/vim/vim.ts`

</details>

<details><summary><code>src/commands/websocket</code> — 4 个</summary>

- `src/commands/websocket/index.js.map`
- `src/commands/websocket/index.ts`
- `src/commands/websocket/websocket.js.map`
- `src/commands/websocket/websocket.ts`

</details>

<details><summary><code>src/components/Settings</code> — 4 个</summary>

- `src/components/Settings/Config.tsx`
- `src/components/Settings/Settings.tsx`
- `src/components/Settings/Status.tsx`
- `src/components/Settings/Usage.tsx`

</details>

<details><summary><code>src/components/shell</code> — 4 个</summary>

- `src/components/shell/ExpandShellOutputContext.tsx`
- `src/components/shell/OutputLine.tsx`
- `src/components/shell/ShellProgressMessage.tsx`
- `src/components/shell/ShellTimeDisplay.tsx`

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

<details><summary><code>src/native-ts/yoga-layout</code> — 4 个</summary>

- `src/native-ts/yoga-layout/enums.js.map`
- `src/native-ts/yoga-layout/enums.ts`
- `src/native-ts/yoga-layout/index.js.map`
- `src/native-ts/yoga-layout/index.ts`

</details>

<details><summary><code>src/services/extractMemories</code> — 4 个</summary>

- `src/services/extractMemories/extractMemories.js.map`
- `src/services/extractMemories/extractMemories.ts`
- `src/services/extractMemories/prompts.js.map`
- `src/services/extractMemories/prompts.ts`

</details>

<details><summary><code>src/services/MagicDocs</code> — 4 个</summary>

- `src/services/MagicDocs/magicDocs.js.map`
- `src/services/MagicDocs/magicDocs.ts`
- `src/services/MagicDocs/prompts.js.map`
- `src/services/MagicDocs/prompts.ts`

</details>

<details><summary><code>src/services/policyLimits</code> — 4 个</summary>

- `src/services/policyLimits/index.js.map`
- `src/services/policyLimits/index.ts`
- `src/services/policyLimits/types.js.map`
- `src/services/policyLimits/types.ts`

</details>

<details><summary><code>src/services/PromptSuggestion</code> — 4 个</summary>

- `src/services/PromptSuggestion/promptSuggestion.js.map`
- `src/services/PromptSuggestion/promptSuggestion.ts`
- `src/services/PromptSuggestion/speculation.js.map`
- `src/services/PromptSuggestion/speculation.ts`

</details>

<details><summary><code>src/services/settingsSync</code> — 4 个</summary>

- `src/services/settingsSync/index.js.map`
- `src/services/settingsSync/index.ts`
- `src/services/settingsSync/types.js.map`
- `src/services/settingsSync/types.ts`

</details>

<details><summary><code>src/services/tips</code> — 4 个</summary>

- `src/services/tips/tipHistory.ts`
- `src/services/tips/tipRegistry.ts`
- `src/services/tips/tipScheduler.ts`
- `src/services/tips/types.ts`

</details>

<details><summary><code>src/tools/AgentProxyTool</code> — 4 个</summary>

- `src/tools/AgentProxyTool/AgentProxyTool.tsx`
- `src/tools/AgentProxyTool/builtins.ts`
- `src/tools/AgentProxyTool/core.ts`
- `src/tools/AgentProxyTool/index.ts`

</details>

<details><summary><code>src/tools/PowerTools</code> — 4 个</summary>

- `src/tools/PowerTools/index.ts`
- `src/tools/PowerTools/index2.ts`
- `src/tools/PowerTools/PowerTools.tsx`
- `src/tools/PowerTools/PowerTools2.tsx`

</details>

<details><summary><code>src/tools/REPLTool</code> — 4 个</summary>

- `src/tools/REPLTool/constants.js.map`
- `src/tools/REPLTool/constants.ts`
- `src/tools/REPLTool/primitiveTools.ts`
- `src/tools/REPLTool/REPLTool.js`

</details>

<details><summary><code>src/tools/TungstenTool</code> — 4 个</summary>

- `src/tools/TungstenTool/TungstenLiveMonitor.tsx`
- `src/tools/TungstenTool/TungstenTool.js.map`
- `src/tools/TungstenTool/TungstenTool.ts`
- `src/tools/TungstenTool/TungstenTool.tsx`

</details>

<details><summary><code>src/commands/agents</code> — 3 个</summary>

- `src/commands/agents/agents.tsx`
- `src/commands/agents/index.js.map`
- `src/commands/agents/index.ts`

</details>

<details><summary><code>src/commands/btw</code> — 3 个</summary>

- `src/commands/btw/btw.tsx`
- `src/commands/btw/index.js.map`
- `src/commands/btw/index.ts`

</details>

<details><summary><code>src/commands/cache</code> — 3 个</summary>

- `src/commands/cache/cache.tsx`
- `src/commands/cache/index.js.map`
- `src/commands/cache/index.ts`

</details>

<details><summary><code>src/commands/chrome</code> — 3 个</summary>

- `src/commands/chrome/chrome.tsx`
- `src/commands/chrome/index.js.map`
- `src/commands/chrome/index.ts`

</details>

<details><summary><code>src/commands/config</code> — 3 个</summary>

- `src/commands/config/config.tsx`
- `src/commands/config/index.js.map`
- `src/commands/config/index.ts`

</details>

<details><summary><code>src/commands/copy</code> — 3 个</summary>

- `src/commands/copy/copy.tsx`
- `src/commands/copy/index.js.map`
- `src/commands/copy/index.ts`

</details>

<details><summary><code>src/commands/desktop</code> — 3 个</summary>

- `src/commands/desktop/desktop.tsx`
- `src/commands/desktop/index.js.map`
- `src/commands/desktop/index.ts`

</details>

<details><summary><code>src/commands/diff</code> — 3 个</summary>

- `src/commands/diff/diff.tsx`
- `src/commands/diff/index.js.map`
- `src/commands/diff/index.ts`

</details>

<details><summary><code>src/commands/doctor</code> — 3 个</summary>

- `src/commands/doctor/doctor.tsx`
- `src/commands/doctor/index.js.map`
- `src/commands/doctor/index.ts`

</details>

<details><summary><code>src/commands/effort</code> — 3 个</summary>

- `src/commands/effort/effort.tsx`
- `src/commands/effort/index.js.map`
- `src/commands/effort/index.ts`

</details>

<details><summary><code>src/commands/exit</code> — 3 个</summary>

- `src/commands/exit/exit.tsx`
- `src/commands/exit/index.js.map`
- `src/commands/exit/index.ts`

</details>

<details><summary><code>src/commands/export</code> — 3 个</summary>

- `src/commands/export/export.tsx`
- `src/commands/export/index.js.map`
- `src/commands/export/index.ts`

</details>

<details><summary><code>src/commands/fast</code> — 3 个</summary>

- `src/commands/fast/fast.tsx`
- `src/commands/fast/index.js.map`
- `src/commands/fast/index.ts`

</details>

<details><summary><code>src/commands/feedback</code> — 3 个</summary>

- `src/commands/feedback/feedback.tsx`
- `src/commands/feedback/index.js.map`
- `src/commands/feedback/index.ts`

</details>

<details><summary><code>src/commands/fuck</code> — 3 个</summary>

- `src/commands/fuck/fuck.ts`
- `src/commands/fuck/index.js.map`
- `src/commands/fuck/index.ts`

</details>

<details><summary><code>src/commands/game</code> — 3 个</summary>

- `src/commands/game/game.tsx`
- `src/commands/game/index.js.map`
- `src/commands/game/index.ts`

</details>

<details><summary><code>src/commands/help</code> — 3 个</summary>

- `src/commands/help/help.tsx`
- `src/commands/help/index.js.map`
- `src/commands/help/index.ts`

</details>

<details><summary><code>src/commands/hooks</code> — 3 个</summary>

- `src/commands/hooks/hooks.tsx`
- `src/commands/hooks/index.js.map`
- `src/commands/hooks/index.ts`

</details>

<details><summary><code>src/commands/login</code> — 3 个</summary>

- `src/commands/login/index.js.map`
- `src/commands/login/index.ts`
- `src/commands/login/login.tsx`

</details>

<details><summary><code>src/commands/model</code> — 3 个</summary>

- `src/commands/model/index.js.map`
- `src/commands/model/index.ts`
- `src/commands/model/model.tsx`

</details>

<details><summary><code>src/commands/passes</code> — 3 个</summary>

- `src/commands/passes/index.js.map`
- `src/commands/passes/index.ts`
- `src/commands/passes/passes.tsx`

</details>

<details><summary><code>src/commands/permissions</code> — 3 个</summary>

- `src/commands/permissions/index.js.map`
- `src/commands/permissions/index.ts`
- `src/commands/permissions/permissions.tsx`

</details>

<details><summary><code>src/commands/plan</code> — 3 个</summary>

- `src/commands/plan/index.js.map`
- `src/commands/plan/index.ts`
- `src/commands/plan/plan.tsx`

</details>

<details><summary><code>src/commands/privacy-settings</code> — 3 个</summary>

- `src/commands/privacy-settings/index.js.map`
- `src/commands/privacy-settings/index.ts`
- `src/commands/privacy-settings/privacy-settings.tsx`

</details>

<details><summary><code>src/commands/prompt-diff</code> — 3 个</summary>

- `src/commands/prompt-diff/index.js.map`
- `src/commands/prompt-diff/index.ts`
- `src/commands/prompt-diff/prompt-diff.tsx`

</details>

<details><summary><code>src/commands/rate-limit-options</code> — 3 个</summary>

- `src/commands/rate-limit-options/index.js.map`
- `src/commands/rate-limit-options/index.ts`
- `src/commands/rate-limit-options/rate-limit-options.tsx`

</details>

<details><summary><code>src/commands/remote-env</code> — 3 个</summary>

- `src/commands/remote-env/index.js.map`
- `src/commands/remote-env/index.ts`
- `src/commands/remote-env/remote-env.tsx`

</details>

<details><summary><code>src/commands/remove-model</code> — 3 个</summary>

- `src/commands/remove-model/index.js.map`
- `src/commands/remove-model/index.ts`
- `src/commands/remove-model/remove-model.ts`

</details>

<details><summary><code>src/commands/resume</code> — 3 个</summary>

- `src/commands/resume/index.js.map`
- `src/commands/resume/index.ts`
- `src/commands/resume/resume.tsx`

</details>

<details><summary><code>src/commands/sandbox-toggle</code> — 3 个</summary>

- `src/commands/sandbox-toggle/index.js.map`
- `src/commands/sandbox-toggle/index.ts`
- `src/commands/sandbox-toggle/sandbox-toggle.tsx`

</details>

<details><summary><code>src/commands/session</code> — 3 个</summary>

- `src/commands/session/index.js.map`
- `src/commands/session/index.ts`
- `src/commands/session/session.tsx`

</details>

<details><summary><code>src/commands/skills</code> — 3 个</summary>

- `src/commands/skills/index.js.map`
- `src/commands/skills/index.ts`
- `src/commands/skills/skills.tsx`

</details>

<details><summary><code>src/commands/stats</code> — 3 个</summary>

- `src/commands/stats/index.js.map`
- `src/commands/stats/index.ts`
- `src/commands/stats/stats.tsx`

</details>

<details><summary><code>src/commands/status</code> — 3 个</summary>

- `src/commands/status/index.js.map`
- `src/commands/status/index.ts`
- `src/commands/status/status.tsx`

</details>

<details><summary><code>src/commands/tag</code> — 3 个</summary>

- `src/commands/tag/index.js.map`
- `src/commands/tag/index.ts`
- `src/commands/tag/tag.tsx`

</details>

<details><summary><code>src/commands/tasks</code> — 3 个</summary>

- `src/commands/tasks/index.js.map`
- `src/commands/tasks/index.ts`
- `src/commands/tasks/tasks.tsx`

</details>

<details><summary><code>src/commands/theme</code> — 3 个</summary>

- `src/commands/theme/index.js.map`
- `src/commands/theme/index.ts`
- `src/commands/theme/theme.tsx`

</details>

<details><summary><code>src/commands/thinkback</code> — 3 个</summary>

- `src/commands/thinkback/index.js.map`
- `src/commands/thinkback/index.ts`
- `src/commands/thinkback/thinkback.tsx`

</details>

<details><summary><code>src/commands/tui</code> — 3 个</summary>

- `src/commands/tui/index.js.map`
- `src/commands/tui/index.ts`
- `src/commands/tui/tui.tsx`

</details>

<details><summary><code>src/commands/updateskills</code> — 3 个</summary>

- `src/commands/updateskills/index.js.map`
- `src/commands/updateskills/index.ts`
- `src/commands/updateskills/updateskills.tsx`

</details>

<details><summary><code>src/commands/upgrade</code> — 3 个</summary>

- `src/commands/upgrade/index.js.map`
- `src/commands/upgrade/index.ts`
- `src/commands/upgrade/upgrade.tsx`

</details>

<details><summary><code>src/commands/usage</code> — 3 个</summary>

- `src/commands/usage/index.js.map`
- `src/commands/usage/index.ts`
- `src/commands/usage/usage.tsx`

</details>

<details><summary><code>src/components/diff</code> — 3 个</summary>

- `src/components/diff/DiffDetailView.tsx`
- `src/components/diff/DiffDialog.tsx`
- `src/components/diff/DiffFileList.tsx`

</details>

<details><summary><code>src/components/HelpV2</code> — 3 个</summary>

- `src/components/HelpV2/Commands.tsx`
- `src/components/HelpV2/General.tsx`
- `src/components/HelpV2/HelpV2.tsx`

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

<details><summary><code>src/services/plugins</code> — 3 个</summary>

- `src/services/plugins/pluginCliCommands.ts`
- `src/services/plugins/PluginInstallationManager.ts`
- `src/services/plugins/pluginOperations.ts`

</details>

<details><summary><code>src/tasks/InProcessTeammateTask</code> — 3 个</summary>

- `src/tasks/InProcessTeammateTask/InProcessTeammateTask.tsx`
- `src/tasks/InProcessTeammateTask/types.js.map`
- `src/tasks/InProcessTeammateTask/types.ts`

</details>

<details><summary><code>src/tools/AgentIntegrationTool</code> — 3 个</summary>

- `src/tools/AgentIntegrationTool/AgentIntegrationTool.tsx`
- `src/tools/AgentIntegrationTool/agentRegistry.ts`
- `src/tools/AgentIntegrationTool/index.ts`

</details>

<details><summary><code>src/tools/AskUserQuestionTool</code> — 3 个</summary>

- `src/tools/AskUserQuestionTool/AskUserQuestionTool.tsx`
- `src/tools/AskUserQuestionTool/prompt.js.map`
- `src/tools/AskUserQuestionTool/prompt.ts`

</details>

<details><summary><code>src/tools/RemoteTriggerTool</code> — 3 个</summary>

- `src/tools/RemoteTriggerTool/prompt.ts`
- `src/tools/RemoteTriggerTool/RemoteTriggerTool.ts`
- `src/tools/RemoteTriggerTool/UI.tsx`

</details>

<details><summary><code>src/tools/SendUserFileTool</code> — 3 个</summary>

- `src/tools/SendUserFileTool/prompt.js.map`
- `src/tools/SendUserFileTool/prompt.ts`
- `src/tools/SendUserFileTool/SendUserFileTool.ts`

</details>

<details><summary><code>src/tools/shared</code> — 3 个</summary>

- `src/tools/shared/gitOperationTracking.js.map`
- `src/tools/shared/gitOperationTracking.ts`
- `src/tools/shared/spawnMultiAgent.ts`

</details>

<details><summary><code>src/tools/SleepTool</code> — 3 个</summary>

- `src/tools/SleepTool/prompt.js.map`
- `src/tools/SleepTool/prompt.ts`
- `src/tools/SleepTool/SleepTool.ts`

</details>

<details><summary><code>src/tools/SnipTool</code> — 3 个</summary>

- `src/tools/SnipTool/prompt.ts`
- `src/tools/SnipTool/SnipTool.js.map`
- `src/tools/SnipTool/SnipTool.ts`

</details>

<details><summary><code>src/tools/TaskOutputTool</code> — 3 个</summary>

- `src/tools/TaskOutputTool/constants.js.map`
- `src/tools/TaskOutputTool/constants.ts`
- `src/tools/TaskOutputTool/TaskOutputTool.tsx`

</details>

<details><summary><code>src/tools/TerminalCaptureTool</code> — 3 个</summary>

- `src/tools/TerminalCaptureTool/prompt.js.map`
- `src/tools/TerminalCaptureTool/prompt.ts`
- `src/tools/TerminalCaptureTool/TerminalCaptureTool.ts`

</details>

<details><summary><code>src/tools/VerifyPlanExecutionTool</code> — 3 个</summary>

- `src/tools/VerifyPlanExecutionTool/constants.js.map`
- `src/tools/VerifyPlanExecutionTool/constants.ts`
- `src/tools/VerifyPlanExecutionTool/VerifyPlanExecutionTool.js`

</details>

<details><summary><code>src/commands/api-doc</code> — 2 个</summary>

- `src/commands/api-doc/index.js.map`
- `src/commands/api-doc/index.ts`

</details>

<details><summary><code>src/commands/backfill-sessions</code> — 2 个</summary>

- `src/commands/backfill-sessions/index.js.map`
- `src/commands/backfill-sessions/index.ts`

</details>

<details><summary><code>src/commands/benchmark</code> — 2 个</summary>

- `src/commands/benchmark/index.js.map`
- `src/commands/benchmark/index.ts`

</details>

<details><summary><code>src/commands/block-mode</code> — 2 个</summary>

- `src/commands/block-mode/block-mode.ts`
- `src/commands/block-mode/index.ts`

</details>

<details><summary><code>src/commands/break-cache</code> — 2 个</summary>

- `src/commands/break-cache/index.js.map`
- `src/commands/break-cache/index.ts`

</details>

<details><summary><code>src/commands/bridge</code> — 2 个</summary>

- `src/commands/bridge/bridge.tsx`
- `src/commands/bridge/index.ts`

</details>

<details><summary><code>src/commands/bridge-sessions</code> — 2 个</summary>

- `src/commands/bridge-sessions/bridge.tsx`
- `src/commands/bridge-sessions/index.ts`

</details>

<details><summary><code>src/commands/debug-tool-call</code> — 2 个</summary>

- `src/commands/debug-tool-call/index.js.map`
- `src/commands/debug-tool-call/index.ts`

</details>

<details><summary><code>src/commands/deploy</code> — 2 个</summary>

- `src/commands/deploy/index.js.map`
- `src/commands/deploy/index.ts`

</details>

<details><summary><code>src/commands/deps-viz</code> — 2 个</summary>

- `src/commands/deps-viz/index.js.map`
- `src/commands/deps-viz/index.ts`

</details>

<details><summary><code>src/commands/diagram</code> — 2 个</summary>

- `src/commands/diagram/index.js.map`
- `src/commands/diagram/index.ts`

</details>

<details><summary><code>src/commands/diff-mode</code> — 2 个</summary>

- `src/commands/diff-mode/diff-mode.ts`
- `src/commands/diff-mode/index.ts`

</details>

<details><summary><code>src/commands/docker</code> — 2 个</summary>

- `src/commands/docker/index.js.map`
- `src/commands/docker/index.ts`

</details>

<details><summary><code>src/commands/docker-sandbox</code> — 2 个</summary>

- `src/commands/docker-sandbox/docker-sandbox.tsx`
- `src/commands/docker-sandbox/index.ts`

</details>

<details><summary><code>src/commands/env</code> — 2 个</summary>

- `src/commands/env/index.ts`
- `src/commands/env/index.tsx`

</details>

<details><summary><code>src/commands/excel</code> — 2 个</summary>

- `src/commands/excel/index.js.map`
- `src/commands/excel/index.ts`

</details>

<details><summary><code>src/commands/fork</code> — 2 个</summary>

- `src/commands/fork/index.js.map`
- `src/commands/fork/index.ts`

</details>

<details><summary><code>src/commands/good-claude</code> — 2 个</summary>

- `src/commands/good-claude/index.js.map`
- `src/commands/good-claude/index.ts`

</details>

<details><summary><code>src/commands/health-score</code> — 2 个</summary>

- `src/commands/health-score/health-score.tsx`
- `src/commands/health-score/index.ts`

</details>

<details><summary><code>src/commands/image</code> — 2 个</summary>

- `src/commands/image/index.js.map`
- `src/commands/image/index.ts`

</details>

<details><summary><code>src/commands/k8s</code> — 2 个</summary>

- `src/commands/k8s/index.js.map`
- `src/commands/k8s/index.ts`

</details>

<details><summary><code>src/commands/mcp-discovery</code> — 2 个</summary>

- `src/commands/mcp-discovery/index.ts`
- `src/commands/mcp-discovery/index.ts `

</details>

<details><summary><code>src/commands/mock-limits</code> — 2 个</summary>

- `src/commands/mock-limits/index.js.map`
- `src/commands/mock-limits/index.ts`

</details>

<details><summary><code>src/commands/nginx</code> — 2 个</summary>

- `src/commands/nginx/index.js.map`
- `src/commands/nginx/index.ts`

</details>

<details><summary><code>src/commands/oauth-refresh</code> — 2 个</summary>

- `src/commands/oauth-refresh/index.js.map`
- `src/commands/oauth-refresh/index.ts`

</details>

<details><summary><code>src/commands/pdf</code> — 2 个</summary>

- `src/commands/pdf/index.js.map`
- `src/commands/pdf/index.ts`

</details>

<details><summary><code>src/commands/peers</code> — 2 个</summary>

- `src/commands/peers/index.js.map`
- `src/commands/peers/index.ts`

</details>

<details><summary><code>src/commands/pr_comments</code> — 2 个</summary>

- `src/commands/pr_comments/index.js.map`
- `src/commands/pr_comments/index.ts`

</details>

<details><summary><code>src/commands/redis</code> — 2 个</summary>

- `src/commands/redis/index.js.map`
- `src/commands/redis/index.ts`

</details>

<details><summary><code>src/commands/scaffold</code> — 2 个</summary>

- `src/commands/scaffold/index.js.map`
- `src/commands/scaffold/index.ts`

</details>

<details><summary><code>src/commands/share</code> — 2 个</summary>

- `src/commands/share/index.js.map`
- `src/commands/share/index.ts`

</details>

<details><summary><code>src/commands/summary</code> — 2 个</summary>

- `src/commands/summary/index.js.map`
- `src/commands/summary/index.ts`

</details>

<details><summary><code>src/commands/todo</code> — 2 个</summary>

- `src/commands/todo/index.js.map`
- `src/commands/todo/index.ts`

</details>

<details><summary><code>src/commands/translate</code> — 2 个</summary>

- `src/commands/translate/index.js.map`
- `src/commands/translate/index.ts`

</details>

<details><summary><code>src/commands/voice</code> — 2 个</summary>

- `src/commands/voice/index.ts`
- `src/commands/voice/voice.ts`

</details>

<details><summary><code>src/commands/workflows</code> — 2 个</summary>

- `src/commands/workflows/index.js.map`
- `src/commands/workflows/index.ts`

</details>

<details><summary><code>src/components/ManagedSettingsSecurityDialog</code> — 2 个</summary>

- `src/components/ManagedSettingsSecurityDialog/ManagedSettingsSecurityDialog.tsx`
- `src/components/ManagedSettingsSecurityDialog/utils.ts`

</details>

<details><summary><code>src/components/memory</code> — 2 个</summary>

- `src/components/memory/MemoryFileSelector.tsx`
- `src/components/memory/MemoryUpdateNotification.tsx`

</details>

<details><summary><code>src/components/skills</code> — 2 个</summary>

- `src/components/skills/SkillsMenu.tsx`
- `src/components/skills/SkillsMenu.tsx.bak`

</details>

<details><summary><code>src/components/StructuredDiff</code> — 2 个</summary>

- `src/components/StructuredDiff/colorDiff.ts`
- `src/components/StructuredDiff/Fallback.tsx`

</details>

<details><summary><code>src/components/teams</code> — 2 个</summary>

- `src/components/teams/TeamsDialog.tsx`
- `src/components/teams/TeamStatus.tsx`

</details>

<details><summary><code>src/components/TrustDialog</code> — 2 个</summary>

- `src/components/TrustDialog/TrustDialog.tsx`
- `src/components/TrustDialog/utils.ts`

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

<details><summary><code>src/native-ts/file-index</code> — 2 个</summary>

- `src/native-ts/file-index/index.js.map`
- `src/native-ts/file-index/index.ts`

</details>

<details><summary><code>src/services/AgentSummary</code> — 2 个</summary>

- `src/services/AgentSummary/agentSummary.js.map`
- `src/services/AgentSummary/agentSummary.ts`

</details>

<details><summary><code>src/services/notebook</code> — 2 个</summary>

- `src/services/notebook/database.ts`
- `src/services/notebook/schema.ts`

</details>

<details><summary><code>src/services/sessionTranscript</code> — 2 个</summary>

- `src/services/sessionTranscript/sessionTranscript.js.map`
- `src/services/sessionTranscript/sessionTranscript.ts`

</details>

<details><summary><code>src/services/toolUseSummary</code> — 2 个</summary>

- `src/services/toolUseSummary/toolUseSummaryGenerator.js.map`
- `src/services/toolUseSummary/toolUseSummaryGenerator.ts`

</details>

<details><summary><code>src/tasks/DreamTask</code> — 2 个</summary>

- `src/tasks/DreamTask/DreamTask.js.map`
- `src/tasks/DreamTask/DreamTask.ts`

</details>

<details><summary><code>src/tasks/LocalWorkflowTask</code> — 2 个</summary>

- `src/tasks/LocalWorkflowTask/LocalWorkflowTask.js.map`
- `src/tasks/LocalWorkflowTask/LocalWorkflowTask.ts`

</details>

<details><summary><code>src/tasks/MonitorMcpTask</code> — 2 个</summary>

- `src/tasks/MonitorMcpTask/MonitorMcpTask.js.map`
- `src/tasks/MonitorMcpTask/MonitorMcpTask.ts`

</details>

<details><summary><code>src/tools/AdvisorTool</code> — 2 个</summary>

- `src/tools/AdvisorTool/AdvisorTool.js.map`
- `src/tools/AdvisorTool/AdvisorTool.ts`

</details>

<details><summary><code>src/tools/BackupTool</code> — 2 个</summary>

- `src/tools/BackupTool/BackupTool.js.map`
- `src/tools/BackupTool/BackupTool.ts`

</details>

<details><summary><code>src/tools/BranchTool</code> — 2 个</summary>

- `src/tools/BranchTool/BranchTool.js.map`
- `src/tools/BranchTool/BranchTool.ts`

</details>

<details><summary><code>src/tools/CacheTool</code> — 2 个</summary>

- `src/tools/CacheTool/CacheTool.js.map`
- `src/tools/CacheTool/CacheTool.ts`

</details>

<details><summary><code>src/tools/CompareTool</code> — 2 个</summary>

- `src/tools/CompareTool/CompareTool.js.map`
- `src/tools/CompareTool/CompareTool.ts`

</details>

<details><summary><code>src/tools/ContextCollapseTool</code> — 2 个</summary>

- `src/tools/ContextCollapseTool/ContextCollapseTool.js.map`
- `src/tools/ContextCollapseTool/ContextCollapseTool.ts`

</details>

<details><summary><code>src/tools/CronTool</code> — 2 个</summary>

- `src/tools/CronTool/CronTool.js.map`
- `src/tools/CronTool/CronTool.ts`

</details>

<details><summary><code>src/tools/DatabaseTool</code> — 2 个</summary>

- `src/tools/DatabaseTool/DatabaseTool.js.map`
- `src/tools/DatabaseTool/DatabaseTool.ts`

</details>

<details><summary><code>src/tools/DiscoverSkillsTool</code> — 2 个</summary>

- `src/tools/DiscoverSkillsTool/prompt.js.map`
- `src/tools/DiscoverSkillsTool/prompt.ts`

</details>

<details><summary><code>src/tools/EffortTool</code> — 2 个</summary>

- `src/tools/EffortTool/EffortTool.js.map`
- `src/tools/EffortTool/EffortTool.ts`

</details>

<details><summary><code>src/tools/EventStreamTool</code> — 2 个</summary>

- `src/tools/EventStreamTool/EventStreamTool.js.map`
- `src/tools/EventStreamTool/EventStreamTool.ts`

</details>

<details><summary><code>src/tools/FileWatcherTool</code> — 2 个</summary>

- `src/tools/FileWatcherTool/FileWatcherTool.js.map`
- `src/tools/FileWatcherTool/FileWatcherTool.ts`

</details>

<details><summary><code>src/tools/GraphqlTool</code> — 2 个</summary>

- `src/tools/GraphqlTool/GraphqlTool.js.map`
- `src/tools/GraphqlTool/GraphqlTool.ts`

</details>

<details><summary><code>src/tools/HttpTool</code> — 2 个</summary>

- `src/tools/HttpTool/HttpTool.js.map`
- `src/tools/HttpTool/HttpTool.ts`

</details>

<details><summary><code>src/tools/LessPermissionPromptsTool</code> — 2 个</summary>

- `src/tools/LessPermissionPromptsTool/LessPermissionPromptsTool.js.map`
- `src/tools/LessPermissionPromptsTool/LessPermissionPromptsTool.ts`

</details>

<details><summary><code>src/tools/LoggerTool</code> — 2 个</summary>

- `src/tools/LoggerTool/LoggerTool.js.map`
- `src/tools/LoggerTool/LoggerTool.ts`

</details>

<details><summary><code>src/tools/McpAuthTool</code> — 2 个</summary>

- `src/tools/McpAuthTool/McpAuthTool.js.map`
- `src/tools/McpAuthTool/McpAuthTool.ts`

</details>

<details><summary><code>src/tools/McpToolSearchTool</code> — 2 个</summary>

- `src/tools/McpToolSearchTool/McpToolSearchTool.js.map`
- `src/tools/McpToolSearchTool/McpToolSearchTool.ts`

</details>

<details><summary><code>src/tools/MetricsTool</code> — 2 个</summary>

- `src/tools/MetricsTool/MetricsTool.js.map`
- `src/tools/MetricsTool/MetricsTool.ts`

</details>

<details><summary><code>src/tools/MonitorTool</code> — 2 个</summary>

- `src/tools/MonitorTool/MonitorTool.js.map`
- `src/tools/MonitorTool/MonitorTool.ts`

</details>

<details><summary><code>src/tools/MultiFileEditTool</code> — 2 个</summary>

- `src/tools/MultiFileEditTool/MultiFileEditTool.js.map`
- `src/tools/MultiFileEditTool/MultiFileEditTool.ts`

</details>

<details><summary><code>src/tools/OverflowTestTool</code> — 2 个</summary>

- `src/tools/OverflowTestTool/OverflowTestTool.js.map`
- `src/tools/OverflowTestTool/OverflowTestTool.ts`

</details>

<details><summary><code>src/tools/PlanModeTool</code> — 2 个</summary>

- `src/tools/PlanModeTool/PlanModeTool.js.map`
- `src/tools/PlanModeTool/PlanModeTool.ts`

</details>

<details><summary><code>src/tools/QueueTool</code> — 2 个</summary>

- `src/tools/QueueTool/QueueTool.js.map`
- `src/tools/QueueTool/QueueTool.ts`

</details>

<details><summary><code>src/tools/ScheduleTool</code> — 2 个</summary>

- `src/tools/ScheduleTool/ScheduleTool.js.map`
- `src/tools/ScheduleTool/ScheduleTool.ts`

</details>

<details><summary><code>src/tools/ShellTool</code> — 2 个</summary>

- `src/tools/ShellTool/ShellTool.js.map`
- `src/tools/ShellTool/ShellTool.ts`

</details>

<details><summary><code>src/tools/SyntheticOutputTool</code> — 2 个</summary>

- `src/tools/SyntheticOutputTool/SyntheticOutputTool.js.map`
- `src/tools/SyntheticOutputTool/SyntheticOutputTool.ts`

</details>

<details><summary><code>src/tools/TerminalPanelTool</code> — 2 个</summary>

- `src/tools/TerminalPanelTool/TerminalPanelTool.js.map`
- `src/tools/TerminalPanelTool/TerminalPanelTool.ts`

</details>

<details><summary><code>src/tools/ThemeTool</code> — 2 个</summary>

- `src/tools/ThemeTool/ThemeTool.js.map`
- `src/tools/ThemeTool/ThemeTool.ts`

</details>

<details><summary><code>src/tools/UltrareviewTool</code> — 2 个</summary>

- `src/tools/UltrareviewTool/UltrareviewTool.js.map`
- `src/tools/UltrareviewTool/UltrareviewTool.ts`

</details>

<details><summary><code>src/tools/VimVisualModeTool</code> — 2 个</summary>

- `src/tools/VimVisualModeTool/VimVisualModeTool.js.map`
- `src/tools/VimVisualModeTool/VimVisualModeTool.ts`

</details>

<details><summary><code>src/tools/WebBrowserTool</code> — 2 个</summary>

- `src/tools/WebBrowserTool/WebBrowserPanel.tsx`
- `src/tools/WebBrowserTool/WebBrowserTool.ts`

</details>

<details><summary><code>src/tools/WebSocketTool</code> — 2 个</summary>

- `src/tools/WebSocketTool/WebSocketTool.js.map`
- `src/tools/WebSocketTool/WebSocketTool.ts`

</details>

<details><summary><code>src/api/CommandRegistry.ts</code> — 1 个</summary>

- `src/api/CommandRegistry.ts`

</details>

<details><summary><code>src/api/ConfigManager.ts</code> — 1 个</summary>

- `src/api/ConfigManager.ts`

</details>

<details><summary><code>src/api/hooks.ts</code> — 1 个</summary>

- `src/api/hooks.ts`

</details>

<details><summary><code>src/api/index.ts</code> — 1 个</summary>

- `src/api/index.ts`

</details>

<details><summary><code>src/api/QueryEngine.ts</code> — 1 个</summary>

- `src/api/QueryEngine.ts`

</details>

<details><summary><code>src/api/SessionManager.ts</code> — 1 个</summary>

- `src/api/SessionManager.ts`

</details>

<details><summary><code>src/api/ToolRegistry.ts</code> — 1 个</summary>

- `src/api/ToolRegistry.ts`

</details>

<details><summary><code>src/api/types.ts</code> — 1 个</summary>

- `src/api/types.ts`

</details>

<details><summary><code>src/api/utils.ts</code> — 1 个</summary>

- `src/api/utils.ts`

</details>

<details><summary><code>src/assistant/assistant.ts</code> — 1 个</summary>

- `src/assistant/assistant.ts`

</details>

<details><summary><code>src/assistant/assistant.tsx</code> — 1 个</summary>

- `src/assistant/assistant.tsx`

</details>

<details><summary><code>src/assistant/AssistantSessionChooser.ts</code> — 1 个</summary>

- `src/assistant/AssistantSessionChooser.ts`

</details>

<details><summary><code>src/assistant/AssistantSessionChooser.tsx</code> — 1 个</summary>

- `src/assistant/AssistantSessionChooser.tsx`

</details>

<details><summary><code>src/assistant/gate.ts</code> — 1 个</summary>

- `src/assistant/gate.ts`

</details>

<details><summary><code>src/assistant/index.ts</code> — 1 个</summary>

- `src/assistant/index.ts`

</details>

<details><summary><code>src/assistant/sessionDiscovery.ts</code> — 1 个</summary>

- `src/assistant/sessionDiscovery.ts`

</details>

<details><summary><code>src/assistant/sessionHistory.ts</code> — 1 个</summary>

- `src/assistant/sessionHistory.ts`

</details>

<details><summary><code>src/auto-wrapper.ts</code> — 1 个</summary>

- `src/auto-wrapper.ts`

</details>

<details><summary><code>src/bootstrap/state.js.map</code> — 1 个</summary>

- `src/bootstrap/state.js.map`

</details>

<details><summary><code>src/bootstrap/state.ts</code> — 1 个</summary>

- `src/bootstrap/state.ts`

</details>

<details><summary><code>src/bootstrap-entry.ts</code> — 1 个</summary>

- `src/bootstrap-entry.ts`

</details>

<details><summary><code>src/bootstrapMacro.ts</code> — 1 个</summary>

- `src/bootstrapMacro.ts`

</details>

<details><summary><code>src/bridge/bridgeApi.js.map</code> — 1 个</summary>

- `src/bridge/bridgeApi.js.map`

</details>

<details><summary><code>src/bridge/bridgeApi.ts</code> — 1 个</summary>

- `src/bridge/bridgeApi.ts`

</details>

<details><summary><code>src/bridge/bridgeConfig.js.map</code> — 1 个</summary>

- `src/bridge/bridgeConfig.js.map`

</details>

<details><summary><code>src/bridge/bridgeConfig.ts</code> — 1 个</summary>

- `src/bridge/bridgeConfig.ts`

</details>

<details><summary><code>src/bridge/bridgeDebug.js.map</code> — 1 个</summary>

- `src/bridge/bridgeDebug.js.map`

</details>

<details><summary><code>src/bridge/bridgeDebug.ts</code> — 1 个</summary>

- `src/bridge/bridgeDebug.ts`

</details>

<details><summary><code>src/bridge/bridgeEnabled.js.map</code> — 1 个</summary>

- `src/bridge/bridgeEnabled.js.map`

</details>

<details><summary><code>src/bridge/bridgeEnabled.ts</code> — 1 个</summary>

- `src/bridge/bridgeEnabled.ts`

</details>

<details><summary><code>src/bridge/bridgeMain.ts</code> — 1 个</summary>

- `src/bridge/bridgeMain.ts`

</details>

<details><summary><code>src/bridge/bridgeMessaging.js.map</code> — 1 个</summary>

- `src/bridge/bridgeMessaging.js.map`

</details>

<details><summary><code>src/bridge/bridgeMessaging.ts</code> — 1 个</summary>

- `src/bridge/bridgeMessaging.ts`

</details>

<details><summary><code>src/bridge/bridgePermissionCallbacks.js.map</code> — 1 个</summary>

- `src/bridge/bridgePermissionCallbacks.js.map`

</details>

<details><summary><code>src/bridge/bridgePermissionCallbacks.ts</code> — 1 个</summary>

- `src/bridge/bridgePermissionCallbacks.ts`

</details>

<details><summary><code>src/bridge/bridgePointer.js.map</code> — 1 个</summary>

- `src/bridge/bridgePointer.js.map`

</details>

<details><summary><code>src/bridge/bridgePointer.ts</code> — 1 个</summary>

- `src/bridge/bridgePointer.ts`

</details>

<details><summary><code>src/bridge/bridgeStatusUtil.ts</code> — 1 个</summary>

- `src/bridge/bridgeStatusUtil.ts`

</details>

<details><summary><code>src/bridge/bridgeUI.ts</code> — 1 个</summary>

- `src/bridge/bridgeUI.ts`

</details>

<details><summary><code>src/bridge/capacityWake.js.map</code> — 1 个</summary>

- `src/bridge/capacityWake.js.map`

</details>

<details><summary><code>src/bridge/capacityWake.ts</code> — 1 个</summary>

- `src/bridge/capacityWake.ts`

</details>

<details><summary><code>src/bridge/codeSessionApi.ts</code> — 1 个</summary>

- `src/bridge/codeSessionApi.ts`

</details>

<details><summary><code>src/bridge/createSession.js.map</code> — 1 个</summary>

- `src/bridge/createSession.js.map`

</details>

<details><summary><code>src/bridge/createSession.ts</code> — 1 个</summary>

- `src/bridge/createSession.ts`

</details>

<details><summary><code>src/bridge/debugUtils.js.map</code> — 1 个</summary>

- `src/bridge/debugUtils.js.map`

</details>

<details><summary><code>src/bridge/debugUtils.ts</code> — 1 个</summary>

- `src/bridge/debugUtils.ts`

</details>

<details><summary><code>src/bridge/envLessBridgeConfig.ts</code> — 1 个</summary>

- `src/bridge/envLessBridgeConfig.ts`

</details>

<details><summary><code>src/bridge/flushGate.js.map</code> — 1 个</summary>

- `src/bridge/flushGate.js.map`

</details>

<details><summary><code>src/bridge/flushGate.ts</code> — 1 个</summary>

- `src/bridge/flushGate.ts`

</details>

<details><summary><code>src/bridge/inboundAttachments.ts</code> — 1 个</summary>

- `src/bridge/inboundAttachments.ts`

</details>

<details><summary><code>src/bridge/inboundMessages.ts</code> — 1 个</summary>

- `src/bridge/inboundMessages.ts`

</details>

<details><summary><code>src/bridge/initReplBridge.ts</code> — 1 个</summary>

- `src/bridge/initReplBridge.ts`

</details>

<details><summary><code>src/bridge/jwtUtils.js.map</code> — 1 个</summary>

- `src/bridge/jwtUtils.js.map`

</details>

<details><summary><code>src/bridge/jwtUtils.ts</code> — 1 个</summary>

- `src/bridge/jwtUtils.ts`

</details>

<details><summary><code>src/bridge/localBridge.ts</code> — 1 个</summary>

- `src/bridge/localBridge.ts`

</details>

<details><summary><code>src/bridge/mobileBridge.ts</code> — 1 个</summary>

- `src/bridge/mobileBridge.ts`

</details>

<details><summary><code>src/bridge/mobileProtocol.ts</code> — 1 个</summary>

- `src/bridge/mobileProtocol.ts`

</details>

<details><summary><code>src/bridge/mobileSession.ts</code> — 1 个</summary>

- `src/bridge/mobileSession.ts`

</details>

<details><summary><code>src/bridge/peerSessions.js.map</code> — 1 个</summary>

- `src/bridge/peerSessions.js.map`

</details>

<details><summary><code>src/bridge/peerSessions.ts</code> — 1 个</summary>

- `src/bridge/peerSessions.ts`

</details>

<details><summary><code>src/bridge/pollConfig.ts</code> — 1 个</summary>

- `src/bridge/pollConfig.ts`

</details>

<details><summary><code>src/bridge/pollConfigDefaults.js.map</code> — 1 个</summary>

- `src/bridge/pollConfigDefaults.js.map`

</details>

<details><summary><code>src/bridge/pollConfigDefaults.ts</code> — 1 个</summary>

- `src/bridge/pollConfigDefaults.ts`

</details>

<details><summary><code>src/bridge/remoteBridgeCore.ts</code> — 1 个</summary>

- `src/bridge/remoteBridgeCore.ts`

</details>

<details><summary><code>src/bridge/replBridge.js.map</code> — 1 个</summary>

- `src/bridge/replBridge.js.map`

</details>

<details><summary><code>src/bridge/replBridge.ts</code> — 1 个</summary>

- `src/bridge/replBridge.ts`

</details>

<details><summary><code>src/bridge/replBridgeHandle.js.map</code> — 1 个</summary>

- `src/bridge/replBridgeHandle.js.map`

</details>

<details><summary><code>src/bridge/replBridgeHandle.ts</code> — 1 个</summary>

- `src/bridge/replBridgeHandle.ts`

</details>

<details><summary><code>src/bridge/replBridgeTransport.js.map</code> — 1 个</summary>

- `src/bridge/replBridgeTransport.js.map`

</details>

<details><summary><code>src/bridge/replBridgeTransport.ts</code> — 1 个</summary>

- `src/bridge/replBridgeTransport.ts`

</details>

<details><summary><code>src/bridge/sessionIdCompat.js.map</code> — 1 个</summary>

- `src/bridge/sessionIdCompat.js.map`

</details>

<details><summary><code>src/bridge/sessionIdCompat.ts</code> — 1 个</summary>

- `src/bridge/sessionIdCompat.ts`

</details>

<details><summary><code>src/bridge/sessionRunner.ts</code> — 1 个</summary>

- `src/bridge/sessionRunner.ts`

</details>

<details><summary><code>src/bridge/trustedDevice.js.map</code> — 1 个</summary>

- `src/bridge/trustedDevice.js.map`

</details>

<details><summary><code>src/bridge/trustedDevice.ts</code> — 1 个</summary>

- `src/bridge/trustedDevice.ts`

</details>

<details><summary><code>src/bridge/types.js.map</code> — 1 个</summary>

- `src/bridge/types.js.map`

</details>

<details><summary><code>src/bridge/types.ts</code> — 1 个</summary>

- `src/bridge/types.ts`

</details>

<details><summary><code>src/bridge/webhookSanitizer.ts</code> — 1 个</summary>

- `src/bridge/webhookSanitizer.ts`

</details>

<details><summary><code>src/bridge/workSecret.js.map</code> — 1 个</summary>

- `src/bridge/workSecret.js.map`

</details>

<details><summary><code>src/bridge/workSecret.ts</code> — 1 个</summary>

- `src/bridge/workSecret.ts`

</details>

<details><summary><code>src/buddy/companion.js.map</code> — 1 个</summary>

- `src/buddy/companion.js.map`

</details>

<details><summary><code>src/buddy/companion.ts</code> — 1 个</summary>

- `src/buddy/companion.ts`

</details>

<details><summary><code>src/buddy/CompanionCard.tsx</code> — 1 个</summary>

- `src/buddy/CompanionCard.tsx`

</details>

<details><summary><code>src/buddy/companionReact.js.map</code> — 1 个</summary>

- `src/buddy/companionReact.js.map`

</details>

<details><summary><code>src/buddy/companionReact.ts</code> — 1 个</summary>

- `src/buddy/companionReact.ts`

</details>

<details><summary><code>src/buddy/CompanionSprite.tsx</code> — 1 个</summary>

- `src/buddy/CompanionSprite.tsx`

</details>

<details><summary><code>src/buddy/prompt.js.map</code> — 1 个</summary>

- `src/buddy/prompt.js.map`

</details>

<details><summary><code>src/buddy/prompt.ts</code> — 1 个</summary>

- `src/buddy/prompt.ts`

</details>

<details><summary><code>src/buddy/sprites.js.map</code> — 1 个</summary>

- `src/buddy/sprites.js.map`

</details>

<details><summary><code>src/buddy/sprites.ts</code> — 1 个</summary>

- `src/buddy/sprites.ts`

</details>

<details><summary><code>src/buddy/types.js.map</code> — 1 个</summary>

- `src/buddy/types.js.map`

</details>

<details><summary><code>src/buddy/types.ts</code> — 1 个</summary>

- `src/buddy/types.ts`

</details>

<details><summary><code>src/buddy/useBuddyNotification.tsx</code> — 1 个</summary>

- `src/buddy/useBuddyNotification.tsx`

</details>

<details><summary><code>src/cli/bg.ts</code> — 1 个</summary>

- `src/cli/bg.ts`

</details>

<details><summary><code>src/cli/exit.ts</code> — 1 个</summary>

- `src/cli/exit.ts`

</details>

<details><summary><code>src/cli/ndjsonSafeStringify.ts</code> — 1 个</summary>

- `src/cli/ndjsonSafeStringify.ts`

</details>

<details><summary><code>src/cli/print.ts</code> — 1 个</summary>

- `src/cli/print.ts`

</details>

<details><summary><code>src/cli/remoteIO.ts</code> — 1 个</summary>

- `src/cli/remoteIO.ts`

</details>

<details><summary><code>src/cli/rollback.ts</code> — 1 个</summary>

- `src/cli/rollback.ts`

</details>

<details><summary><code>src/cli/structuredIO.ts</code> — 1 个</summary>

- `src/cli/structuredIO.ts`

</details>

<details><summary><code>src/cli/test-import.ts</code> — 1 个</summary>

- `src/cli/test-import.ts`

</details>

<details><summary><code>src/cli/up.ts</code> — 1 个</summary>

- `src/cli/up.ts`

</details>

<details><summary><code>src/cli/update.ts</code> — 1 个</summary>

- `src/cli/update.ts`

</details>

<details><summary><code>src/commands/advisor.js.map</code> — 1 个</summary>

- `src/commands/advisor.js.map`

</details>

<details><summary><code>src/commands/advisor.ts</code> — 1 个</summary>

- `src/commands/advisor.ts`

</details>

<details><summary><code>src/commands/agent-new</code> — 1 个</summary>

- `src/commands/agent-new/index.ts`

</details>

<details><summary><code>src/commands/agents-platform</code> — 1 个</summary>

- `src/commands/agents-platform/index.ts`

</details>

<details><summary><code>src/commands/ant-trace</code> — 1 个</summary>

- `src/commands/ant-trace/index.tsx`

</details>

<details><summary><code>src/commands/api-debug</code> — 1 个</summary>

- `src/commands/api-debug/index.ts`

</details>

<details><summary><code>src/commands/auto-commit</code> — 1 个</summary>

- `src/commands/auto-commit/index.ts`

</details>

<details><summary><code>src/commands/auto-mode-reset</code> — 1 个</summary>

- `src/commands/auto-mode-reset/index.ts`

</details>

<details><summary><code>src/commands/autocomplete</code> — 1 个</summary>

- `src/commands/autocomplete/index.ts`

</details>

<details><summary><code>src/commands/autofix-pr</code> — 1 个</summary>

- `src/commands/autofix-pr/index.tsx`

</details>

<details><summary><code>src/commands/background</code> — 1 个</summary>

- `src/commands/background/index.ts`

</details>

<details><summary><code>src/commands/bookmark</code> — 1 个</summary>

- `src/commands/bookmark/index.ts`

</details>

<details><summary><code>src/commands/bridge-kick.js.map</code> — 1 个</summary>

- `src/commands/bridge-kick.js.map`

</details>

<details><summary><code>src/commands/bridge-kick.ts</code> — 1 个</summary>

- `src/commands/bridge-kick.ts`

</details>

<details><summary><code>src/commands/brief.ts</code> — 1 个</summary>

- `src/commands/brief.ts`

</details>

<details><summary><code>src/commands/browser</code> — 1 个</summary>

- `src/commands/browser/index.tsx`

</details>

<details><summary><code>src/commands/bughunter</code> — 1 个</summary>

- `src/commands/bughunter/index.tsx`

</details>

<details><summary><code>src/commands/code-health</code> — 1 个</summary>

- `src/commands/code-health/index.ts`

</details>

<details><summary><code>src/commands/code-search</code> — 1 个</summary>

- `src/commands/code-search/index.tsx`

</details>

<details><summary><code>src/commands/commit-push-pr.js.map</code> — 1 个</summary>

- `src/commands/commit-push-pr.js.map`

</details>

<details><summary><code>src/commands/commit-push-pr.ts</code> — 1 个</summary>

- `src/commands/commit-push-pr.ts`

</details>

<details><summary><code>src/commands/commit.js.map</code> — 1 个</summary>

- `src/commands/commit.js.map`

</details>

<details><summary><code>src/commands/commit.ts</code> — 1 个</summary>

- `src/commands/commit.ts`

</details>

<details><summary><code>src/commands/complete</code> — 1 个</summary>

- `src/commands/complete/index.ts`

</details>

<details><summary><code>src/commands/cost-history</code> — 1 个</summary>

- `src/commands/cost-history/index.ts`

</details>

<details><summary><code>src/commands/createMovedToPluginCommand.js.map</code> — 1 个</summary>

- `src/commands/createMovedToPluginCommand.js.map`

</details>

<details><summary><code>src/commands/createMovedToPluginCommand.ts</code> — 1 个</summary>

- `src/commands/createMovedToPluginCommand.ts`

</details>

<details><summary><code>src/commands/ctx_viz</code> — 1 个</summary>

- `src/commands/ctx_viz/index.tsx`

</details>

<details><summary><code>src/commands/custom-cmd</code> — 1 个</summary>

- `src/commands/custom-cmd/index.ts`

</details>

<details><summary><code>src/commands/deps</code> — 1 个</summary>

- `src/commands/deps/index.ts`

</details>

<details><summary><code>src/commands/diagnose.js.map</code> — 1 个</summary>

- `src/commands/diagnose.js.map`

</details>

<details><summary><code>src/commands/diagnose.ts</code> — 1 个</summary>

- `src/commands/diagnose.ts`

</details>

<details><summary><code>src/commands/diff-review</code> — 1 个</summary>

- `src/commands/diff-review/index.ts`

</details>

<details><summary><code>src/commands/errors</code> — 1 个</summary>

- `src/commands/errors/index.ts`

</details>

<details><summary><code>src/commands/fmt</code> — 1 个</summary>

- `src/commands/fmt/index.ts`

</details>

<details><summary><code>src/commands/force-snip.ts</code> — 1 个</summary>

- `src/commands/force-snip.ts`

</details>

<details><summary><code>src/commands/i18n-extract.js.map</code> — 1 个</summary>

- `src/commands/i18n-extract.js.map`

</details>

<details><summary><code>src/commands/i18n-extract.ts</code> — 1 个</summary>

- `src/commands/i18n-extract.ts`

</details>

<details><summary><code>src/commands/imports</code> — 1 个</summary>

- `src/commands/imports/index.ts`

</details>

<details><summary><code>src/commands/init-verifiers.js.map</code> — 1 个</summary>

- `src/commands/init-verifiers.js.map`

</details>

<details><summary><code>src/commands/init-verifiers.ts</code> — 1 个</summary>

- `src/commands/init-verifiers.ts`

</details>

<details><summary><code>src/commands/init.js.map</code> — 1 个</summary>

- `src/commands/init.js.map`

</details>

<details><summary><code>src/commands/init.ts</code> — 1 个</summary>

- `src/commands/init.ts`

</details>

<details><summary><code>src/commands/insights.js.map</code> — 1 个</summary>

- `src/commands/insights.js.map`

</details>

<details><summary><code>src/commands/insights.ts</code> — 1 个</summary>

- `src/commands/insights.ts`

</details>

<details><summary><code>src/commands/install.tsx</code> — 1 个</summary>

- `src/commands/install.tsx`

</details>

<details><summary><code>src/commands/issue</code> — 1 个</summary>

- `src/commands/issue/index.tsx`

</details>

<details><summary><code>src/commands/logs</code> — 1 个</summary>

- `src/commands/logs/index.ts`

</details>

<details><summary><code>src/commands/memory-bank</code> — 1 个</summary>

- `src/commands/memory-bank/index.ts`

</details>

<details><summary><code>src/commands/memory-search</code> — 1 个</summary>

- `src/commands/memory-search/index.ts`

</details>

<details><summary><code>src/commands/notify</code> — 1 个</summary>

- `src/commands/notify/index.ts`

</details>

<details><summary><code>src/commands/onboarding</code> — 1 个</summary>

- `src/commands/onboarding/index.tsx`

</details>

<details><summary><code>src/commands/pair</code> — 1 个</summary>

- `src/commands/pair/index.ts`

</details>

<details><summary><code>src/commands/perf-issue</code> — 1 个</summary>

- `src/commands/perf-issue/index.tsx`

</details>

<details><summary><code>src/commands/plancppwin</code> — 1 个</summary>

- `src/commands/plancppwin/plancppwin.tsx`

</details>

<details><summary><code>src/commands/plugin-market</code> — 1 个</summary>

- `src/commands/plugin-market/index.ts`

</details>

<details><summary><code>src/commands/ports</code> — 1 个</summary>

- `src/commands/ports/index.ts`

</details>

<details><summary><code>src/commands/pr-review</code> — 1 个</summary>

- `src/commands/pr-review/index.ts`

</details>

<details><summary><code>src/commands/proactive</code> — 1 个</summary>

- `src/commands/proactive/index.ts`

</details>

<details><summary><code>src/commands/proactive.ts</code> — 1 个</summary>

- `src/commands/proactive.ts`

</details>

<details><summary><code>src/commands/refactor</code> — 1 个</summary>

- `src/commands/refactor/index.ts`

</details>

<details><summary><code>src/commands/refactor.js.map</code> — 1 个</summary>

- `src/commands/refactor.js.map`

</details>

<details><summary><code>src/commands/refactor.ts</code> — 1 个</summary>

- `src/commands/refactor.ts`

</details>

<details><summary><code>src/commands/remoteControlServer</code> — 1 个</summary>

- `src/commands/remoteControlServer/index.ts`

</details>

<details><summary><code>src/commands/repo-map</code> — 1 个</summary>

- `src/commands/repo-map/index.tsx`

</details>

<details><summary><code>src/commands/reset-limits</code> — 1 个</summary>

- `src/commands/reset-limits/index.tsx`

</details>

<details><summary><code>src/commands/review.js.map</code> — 1 个</summary>

- `src/commands/review.js.map`

</details>

<details><summary><code>src/commands/review.ts</code> — 1 个</summary>

- `src/commands/review.ts`

</details>

<details><summary><code>src/commands/security-audit</code> — 1 个</summary>

- `src/commands/security-audit/index.ts`

</details>

<details><summary><code>src/commands/security-review.js.map</code> — 1 个</summary>

- `src/commands/security-review.js.map`

</details>

<details><summary><code>src/commands/security-review.ts</code> — 1 个</summary>

- `src/commands/security-review.ts`

</details>

<details><summary><code>src/commands/session-search.js.map</code> — 1 个</summary>

- `src/commands/session-search.js.map`

</details>

<details><summary><code>src/commands/session-search.ts</code> — 1 个</summary>

- `src/commands/session-search.ts`

</details>

<details><summary><code>src/commands/session-tag.js.map</code> — 1 个</summary>

- `src/commands/session-tag.js.map`

</details>

<details><summary><code>src/commands/session-tag.ts</code> — 1 个</summary>

- `src/commands/session-tag.ts`

</details>

<details><summary><code>src/commands/sessions</code> — 1 个</summary>

- `src/commands/sessions/index.tsx`

</details>

<details><summary><code>src/commands/snippet</code> — 1 个</summary>

- `src/commands/snippet/index.ts`

</details>

<details><summary><code>src/commands/stash</code> — 1 个</summary>

- `src/commands/stash/index.ts`

</details>

<details><summary><code>src/commands/statusline.tsx</code> — 1 个</summary>

- `src/commands/statusline.tsx`

</details>

<details><summary><code>src/commands/subscribe-pr.ts</code> — 1 个</summary>

- `src/commands/subscribe-pr.ts`

</details>

<details><summary><code>src/commands/symbol</code> — 1 个</summary>

- `src/commands/symbol/index.ts`

</details>

<details><summary><code>src/commands/teleport</code> — 1 个</summary>

- `src/commands/teleport/index.tsx`

</details>

<details><summary><code>src/commands/templates</code> — 1 个</summary>

- `src/commands/templates/index.ts`

</details>

<details><summary><code>src/commands/test-gen.js.map</code> — 1 个</summary>

- `src/commands/test-gen.js.map`

</details>

<details><summary><code>src/commands/test-gen.ts</code> — 1 个</summary>

- `src/commands/test-gen.ts`

</details>

<details><summary><code>src/commands/test-run</code> — 1 个</summary>

- `src/commands/test-run/index.ts`

</details>

<details><summary><code>src/commands/torch.ts</code> — 1 个</summary>

- `src/commands/torch.ts`

</details>

<details><summary><code>src/commands/ultraplan.tsx</code> — 1 个</summary>

- `src/commands/ultraplan.tsx`

</details>

<details><summary><code>src/commands/vector-search</code> — 1 个</summary>

- `src/commands/vector-search/index.tsx`

</details>

<details><summary><code>src/commands/version.js.map</code> — 1 个</summary>

- `src/commands/version.js.map`

</details>

<details><summary><code>src/commands/version.ts</code> — 1 个</summary>

- `src/commands/version.ts`

</details>

<details><summary><code>src/commands/wiki</code> — 1 个</summary>

- `src/commands/wiki/index.ts`

</details>

<details><summary><code>src/commands/workspace.js.map</code> — 1 个</summary>

- `src/commands/workspace.js.map`

</details>

<details><summary><code>src/commands/workspace.ts</code> — 1 个</summary>

- `src/commands/workspace.ts`

</details>

<details><summary><code>src/commands.ts</code> — 1 个</summary>

- `src/commands.ts`

</details>

<details><summary><code>src/components/AgentProgressLine.tsx</code> — 1 个</summary>

- `src/components/AgentProgressLine.tsx`

</details>

<details><summary><code>src/components/AntModelSwitchCallout.tsx</code> — 1 个</summary>

- `src/components/AntModelSwitchCallout.tsx`

</details>

<details><summary><code>src/components/App.tsx</code> — 1 个</summary>

- `src/components/App.tsx`

</details>

<details><summary><code>src/components/ApproveApiKey.tsx</code> — 1 个</summary>

- `src/components/ApproveApiKey.tsx`

</details>

<details><summary><code>src/components/AutoModeOptInDialog.tsx</code> — 1 个</summary>

- `src/components/AutoModeOptInDialog.tsx`

</details>

<details><summary><code>src/components/AutoUpdater.tsx</code> — 1 个</summary>

- `src/components/AutoUpdater.tsx`

</details>

<details><summary><code>src/components/AutoUpdaterWrapper.tsx</code> — 1 个</summary>

- `src/components/AutoUpdaterWrapper.tsx`

</details>

<details><summary><code>src/components/AwsAuthStatusBox.tsx</code> — 1 个</summary>

- `src/components/AwsAuthStatusBox.tsx`

</details>

<details><summary><code>src/components/BaseTextInput.tsx</code> — 1 个</summary>

- `src/components/BaseTextInput.tsx`

</details>

<details><summary><code>src/components/BashModeProgress.tsx</code> — 1 个</summary>

- `src/components/BashModeProgress.tsx`

</details>

<details><summary><code>src/components/BridgeDialog.tsx</code> — 1 个</summary>

- `src/components/BridgeDialog.tsx`

</details>

<details><summary><code>src/components/BypassPermissionsModeDialog.tsx</code> — 1 个</summary>

- `src/components/BypassPermissionsModeDialog.tsx`

</details>

<details><summary><code>src/components/ChannelDowngradeDialog.tsx</code> — 1 个</summary>

- `src/components/ChannelDowngradeDialog.tsx`

</details>

<details><summary><code>src/components/ClaudeCodeHint</code> — 1 个</summary>

- `src/components/ClaudeCodeHint/PluginHintMenu.tsx`

</details>

<details><summary><code>src/components/ClaudeInChromeOnboarding.tsx</code> — 1 个</summary>

- `src/components/ClaudeInChromeOnboarding.tsx`

</details>

<details><summary><code>src/components/ClaudeMdExternalIncludesDialog.tsx</code> — 1 个</summary>

- `src/components/ClaudeMdExternalIncludesDialog.tsx`

</details>

<details><summary><code>src/components/ClickableImageRef.tsx</code> — 1 个</summary>

- `src/components/ClickableImageRef.tsx`

</details>

<details><summary><code>src/components/CompactSummary.tsx</code> — 1 个</summary>

- `src/components/CompactSummary.tsx`

</details>

<details><summary><code>src/components/ConfigurableShortcutHint.tsx</code> — 1 个</summary>

- `src/components/ConfigurableShortcutHint.tsx`

</details>

<details><summary><code>src/components/ConsoleOAuthFlow.tsx</code> — 1 个</summary>

- `src/components/ConsoleOAuthFlow.tsx`

</details>

<details><summary><code>src/components/ContextSuggestions.tsx</code> — 1 个</summary>

- `src/components/ContextSuggestions.tsx`

</details>

<details><summary><code>src/components/ContextVisualization.tsx</code> — 1 个</summary>

- `src/components/ContextVisualization.tsx`

</details>

<details><summary><code>src/components/CoordinatorAgentStatus.tsx</code> — 1 个</summary>

- `src/components/CoordinatorAgentStatus.tsx`

</details>

<details><summary><code>src/components/CostThresholdDialog.tsx</code> — 1 个</summary>

- `src/components/CostThresholdDialog.tsx`

</details>

<details><summary><code>src/components/CtrlOToExpand.tsx</code> — 1 个</summary>

- `src/components/CtrlOToExpand.tsx`

</details>

<details><summary><code>src/components/DesktopHandoff.tsx</code> — 1 个</summary>

- `src/components/DesktopHandoff.tsx`

</details>

<details><summary><code>src/components/DesktopUpsell</code> — 1 个</summary>

- `src/components/DesktopUpsell/DesktopUpsellStartup.tsx`

</details>

<details><summary><code>src/components/DevBar.tsx</code> — 1 个</summary>

- `src/components/DevBar.tsx`

</details>

<details><summary><code>src/components/DevChannelsDialog.tsx</code> — 1 个</summary>

- `src/components/DevChannelsDialog.tsx`

</details>

<details><summary><code>src/components/DiagnosticsDisplay.tsx</code> — 1 个</summary>

- `src/components/DiagnosticsDisplay.tsx`

</details>

<details><summary><code>src/components/EffortCallout.tsx</code> — 1 个</summary>

- `src/components/EffortCallout.tsx`

</details>

<details><summary><code>src/components/EffortIndicator.ts</code> — 1 个</summary>

- `src/components/EffortIndicator.ts`

</details>

<details><summary><code>src/components/ExitFlow.tsx</code> — 1 个</summary>

- `src/components/ExitFlow.tsx`

</details>

<details><summary><code>src/components/ExportDialog.tsx</code> — 1 个</summary>

- `src/components/ExportDialog.tsx`

</details>

<details><summary><code>src/components/FallbackToolUseErrorMessage.tsx</code> — 1 个</summary>

- `src/components/FallbackToolUseErrorMessage.tsx`

</details>

<details><summary><code>src/components/FallbackToolUseRejectedMessage.tsx</code> — 1 个</summary>

- `src/components/FallbackToolUseRejectedMessage.tsx`

</details>

<details><summary><code>src/components/FastIcon.tsx</code> — 1 个</summary>

- `src/components/FastIcon.tsx`

</details>

<details><summary><code>src/components/Feedback.tsx</code> — 1 个</summary>

- `src/components/Feedback.tsx`

</details>

<details><summary><code>src/components/FileEditToolDiff.tsx</code> — 1 个</summary>

- `src/components/FileEditToolDiff.tsx`

</details>

<details><summary><code>src/components/FileEditToolUpdatedMessage.tsx</code> — 1 个</summary>

- `src/components/FileEditToolUpdatedMessage.tsx`

</details>

<details><summary><code>src/components/FileEditToolUseRejectedMessage.tsx</code> — 1 个</summary>

- `src/components/FileEditToolUseRejectedMessage.tsx`

</details>

<details><summary><code>src/components/FilePathLink.tsx</code> — 1 个</summary>

- `src/components/FilePathLink.tsx`

</details>

<details><summary><code>src/components/FullscreenLayout.tsx</code> — 1 个</summary>

- `src/components/FullscreenLayout.tsx`

</details>

<details><summary><code>src/components/GhostText.tsx</code> — 1 个</summary>

- `src/components/GhostText.tsx`

</details>

<details><summary><code>src/components/GlobalSearchDialog.tsx</code> — 1 个</summary>

- `src/components/GlobalSearchDialog.tsx`

</details>

<details><summary><code>src/components/grove</code> — 1 个</summary>

- `src/components/grove/Grove.tsx`

</details>

<details><summary><code>src/components/HighlightedCode</code> — 1 个</summary>

- `src/components/HighlightedCode/Fallback.tsx`

</details>

<details><summary><code>src/components/HighlightedCode.tsx</code> — 1 个</summary>

- `src/components/HighlightedCode.tsx`

</details>

<details><summary><code>src/components/HistorySearchDialog.tsx</code> — 1 个</summary>

- `src/components/HistorySearchDialog.tsx`

</details>

<details><summary><code>src/components/IdeAutoConnectDialog.tsx</code> — 1 个</summary>

- `src/components/IdeAutoConnectDialog.tsx`

</details>

<details><summary><code>src/components/IdeOnboardingDialog.tsx</code> — 1 个</summary>

- `src/components/IdeOnboardingDialog.tsx`

</details>

<details><summary><code>src/components/IdeStatusIndicator.tsx</code> — 1 个</summary>

- `src/components/IdeStatusIndicator.tsx`

</details>

<details><summary><code>src/components/IdleReturnDialog.tsx</code> — 1 个</summary>

- `src/components/IdleReturnDialog.tsx`

</details>

<details><summary><code>src/components/ImageDisplay.tsx</code> — 1 个</summary>

- `src/components/ImageDisplay.tsx`

</details>

<details><summary><code>src/components/InterruptedByUser.tsx</code> — 1 个</summary>

- `src/components/InterruptedByUser.tsx`

</details>

<details><summary><code>src/components/InvalidConfigDialog.tsx</code> — 1 个</summary>

- `src/components/InvalidConfigDialog.tsx`

</details>

<details><summary><code>src/components/InvalidSettingsDialog.tsx</code> — 1 个</summary>

- `src/components/InvalidSettingsDialog.tsx`

</details>

<details><summary><code>src/components/KeybindingWarnings.tsx</code> — 1 个</summary>

- `src/components/KeybindingWarnings.tsx`

</details>

<details><summary><code>src/components/LanguagePicker.tsx</code> — 1 个</summary>

- `src/components/LanguagePicker.tsx`

</details>

<details><summary><code>src/components/LogSelector.tsx</code> — 1 个</summary>

- `src/components/LogSelector.tsx`

</details>

<details><summary><code>src/components/LspRecommendation</code> — 1 个</summary>

- `src/components/LspRecommendation/LspRecommendationMenu.tsx`

</details>

<details><summary><code>src/components/Markdown.tsx</code> — 1 个</summary>

- `src/components/Markdown.tsx`

</details>

<details><summary><code>src/components/MarkdownTable.tsx</code> — 1 个</summary>

- `src/components/MarkdownTable.tsx`

</details>

<details><summary><code>src/components/MCPServerApprovalDialog.tsx</code> — 1 个</summary>

- `src/components/MCPServerApprovalDialog.tsx`

</details>

<details><summary><code>src/components/MCPServerDesktopImportDialog.tsx</code> — 1 个</summary>

- `src/components/MCPServerDesktopImportDialog.tsx`

</details>

<details><summary><code>src/components/MCPServerDialogCopy.tsx</code> — 1 个</summary>

- `src/components/MCPServerDialogCopy.tsx`

</details>

<details><summary><code>src/components/MCPServerMultiselectDialog.tsx</code> — 1 个</summary>

- `src/components/MCPServerMultiselectDialog.tsx`

</details>

<details><summary><code>src/components/MemoryUsageIndicator.tsx</code> — 1 个</summary>

- `src/components/MemoryUsageIndicator.tsx`

</details>

<details><summary><code>src/components/Message.tsx</code> — 1 个</summary>

- `src/components/Message.tsx`

</details>

<details><summary><code>src/components/messageActions.tsx</code> — 1 个</summary>

- `src/components/messageActions.tsx`

</details>

<details><summary><code>src/components/MessageModel.tsx</code> — 1 个</summary>

- `src/components/MessageModel.tsx`

</details>

<details><summary><code>src/components/MessageResponse.tsx</code> — 1 个</summary>

- `src/components/MessageResponse.tsx`

</details>

<details><summary><code>src/components/MessageRow.tsx</code> — 1 个</summary>

- `src/components/MessageRow.tsx`

</details>

<details><summary><code>src/components/Messages.tsx</code> — 1 个</summary>

- `src/components/Messages.tsx`

</details>

<details><summary><code>src/components/MessageSelector.tsx</code> — 1 个</summary>

- `src/components/MessageSelector.tsx`

</details>

<details><summary><code>src/components/MessageTimestamp.tsx</code> — 1 个</summary>

- `src/components/MessageTimestamp.tsx`

</details>

<details><summary><code>src/components/ModelPicker.tsx</code> — 1 个</summary>

- `src/components/ModelPicker.tsx`

</details>

<details><summary><code>src/components/NativeAutoUpdater.tsx</code> — 1 个</summary>

- `src/components/NativeAutoUpdater.tsx`

</details>

<details><summary><code>src/components/NotebookEditToolUseRejectedMessage.tsx</code> — 1 个</summary>

- `src/components/NotebookEditToolUseRejectedMessage.tsx`

</details>

<details><summary><code>src/components/OffscreenFreeze.tsx</code> — 1 个</summary>

- `src/components/OffscreenFreeze.tsx`

</details>

<details><summary><code>src/components/Onboarding.tsx</code> — 1 个</summary>

- `src/components/Onboarding.tsx`

</details>

<details><summary><code>src/components/OutputStylePicker.tsx</code> — 1 个</summary>

- `src/components/OutputStylePicker.tsx`

</details>

<details><summary><code>src/components/PackageManagerAutoUpdater.tsx</code> — 1 个</summary>

- `src/components/PackageManagerAutoUpdater.tsx`

</details>

<details><summary><code>src/components/Passes</code> — 1 个</summary>

- `src/components/Passes/Passes.tsx`

</details>

<details><summary><code>src/components/PrBadge.tsx</code> — 1 个</summary>

- `src/components/PrBadge.tsx`

</details>

<details><summary><code>src/components/PressEnterToContinue.tsx</code> — 1 个</summary>

- `src/components/PressEnterToContinue.tsx`

</details>

<details><summary><code>src/components/QuickOpenDialog.tsx</code> — 1 个</summary>

- `src/components/QuickOpenDialog.tsx`

</details>

<details><summary><code>src/components/RemoteCallout.tsx</code> — 1 个</summary>

- `src/components/RemoteCallout.tsx`

</details>

<details><summary><code>src/components/RemoteEnvironmentDialog.tsx</code> — 1 个</summary>

- `src/components/RemoteEnvironmentDialog.tsx`

</details>

<details><summary><code>src/components/ResumeTask.tsx</code> — 1 个</summary>

- `src/components/ResumeTask.tsx`

</details>

<details><summary><code>src/components/SandboxViolationExpandedView.tsx</code> — 1 个</summary>

- `src/components/SandboxViolationExpandedView.tsx`

</details>

<details><summary><code>src/components/ScrollKeybindingHandler.tsx</code> — 1 个</summary>

- `src/components/ScrollKeybindingHandler.tsx`

</details>

<details><summary><code>src/components/SearchBox.tsx</code> — 1 个</summary>

- `src/components/SearchBox.tsx`

</details>

<details><summary><code>src/components/SentryErrorBoundary.ts</code> — 1 个</summary>

- `src/components/SentryErrorBoundary.ts`

</details>

<details><summary><code>src/components/SessionBackgroundHint.tsx</code> — 1 个</summary>

- `src/components/SessionBackgroundHint.tsx`

</details>

<details><summary><code>src/components/SessionPreview.tsx</code> — 1 个</summary>

- `src/components/SessionPreview.tsx`

</details>

<details><summary><code>src/components/ShowInIDEPrompt.tsx</code> — 1 个</summary>

- `src/components/ShowInIDEPrompt.tsx`

</details>

<details><summary><code>src/components/SideBySideDiff.tsx</code> — 1 个</summary>

- `src/components/SideBySideDiff.tsx`

</details>

<details><summary><code>src/components/SkillImprovementSurvey.tsx</code> — 1 个</summary>

- `src/components/SkillImprovementSurvey.tsx`

</details>

<details><summary><code>src/components/Spinner.tsx</code> — 1 个</summary>

- `src/components/Spinner.tsx`

</details>

<details><summary><code>src/components/Stats.tsx</code> — 1 个</summary>

- `src/components/Stats.tsx`

</details>

<details><summary><code>src/components/StatusLine.tsx</code> — 1 个</summary>

- `src/components/StatusLine.tsx`

</details>

<details><summary><code>src/components/StatusNotices.tsx</code> — 1 个</summary>

- `src/components/StatusNotices.tsx`

</details>

<details><summary><code>src/components/StructuredDiff.tsx</code> — 1 个</summary>

- `src/components/StructuredDiff.tsx`

</details>

<details><summary><code>src/components/StructuredDiffList.tsx</code> — 1 个</summary>

- `src/components/StructuredDiffList.tsx`

</details>

<details><summary><code>src/components/TagTabs.tsx</code> — 1 个</summary>

- `src/components/TagTabs.tsx`

</details>

<details><summary><code>src/components/TaskListV2.tsx</code> — 1 个</summary>

- `src/components/TaskListV2.tsx`

</details>

<details><summary><code>src/components/TeammateViewHeader.tsx</code> — 1 个</summary>

- `src/components/TeammateViewHeader.tsx`

</details>

<details><summary><code>src/components/TeleportError.tsx</code> — 1 个</summary>

- `src/components/TeleportError.tsx`

</details>

<details><summary><code>src/components/TeleportProgress.tsx</code> — 1 个</summary>

- `src/components/TeleportProgress.tsx`

</details>

<details><summary><code>src/components/TeleportRepoMismatchDialog.tsx</code> — 1 个</summary>

- `src/components/TeleportRepoMismatchDialog.tsx`

</details>

<details><summary><code>src/components/TeleportResumeWrapper.tsx</code> — 1 个</summary>

- `src/components/TeleportResumeWrapper.tsx`

</details>

<details><summary><code>src/components/TeleportStash.tsx</code> — 1 个</summary>

- `src/components/TeleportStash.tsx`

</details>

<details><summary><code>src/components/TextInput.tsx</code> — 1 个</summary>

- `src/components/TextInput.tsx`

</details>

<details><summary><code>src/components/ThemePicker.tsx</code> — 1 个</summary>

- `src/components/ThemePicker.tsx`

</details>

<details><summary><code>src/components/ThinkingToggle.tsx</code> — 1 个</summary>

- `src/components/ThinkingToggle.tsx`

</details>

<details><summary><code>src/components/TokenWarning.tsx</code> — 1 个</summary>

- `src/components/TokenWarning.tsx`

</details>

<details><summary><code>src/components/tools</code> — 1 个</summary>

- `src/components/tools/ToolOutputBlock.tsx`

</details>

<details><summary><code>src/components/ToolUseLoader.tsx</code> — 1 个</summary>

- `src/components/ToolUseLoader.tsx`

</details>

<details><summary><code>src/components/UndercoverAutoCallout.tsx</code> — 1 个</summary>

- `src/components/UndercoverAutoCallout.tsx`

</details>

<details><summary><code>src/components/ValidationErrorsList.tsx</code> — 1 个</summary>

- `src/components/ValidationErrorsList.tsx`

</details>

<details><summary><code>src/components/VimTextInput.tsx</code> — 1 个</summary>

- `src/components/VimTextInput.tsx`

</details>

<details><summary><code>src/components/VirtualMessageList.tsx</code> — 1 个</summary>

- `src/components/VirtualMessageList.tsx`

</details>

<details><summary><code>src/components/WorkflowMultiselectDialog.tsx</code> — 1 个</summary>

- `src/components/WorkflowMultiselectDialog.tsx`

</details>

<details><summary><code>src/components/WorktreeExitDialog.tsx</code> — 1 个</summary>

- `src/components/WorktreeExitDialog.tsx`

</details>

<details><summary><code>src/constants/errorIds.ts</code> — 1 个</summary>

- `src/constants/errorIds.ts`

</details>

<details><summary><code>src/context/fpsMetrics.tsx</code> — 1 个</summary>

- `src/context/fpsMetrics.tsx`

</details>

<details><summary><code>src/context/mailbox.tsx</code> — 1 个</summary>

- `src/context/mailbox.tsx`

</details>

<details><summary><code>src/context/modalContext.tsx</code> — 1 个</summary>

- `src/context/modalContext.tsx`

</details>

<details><summary><code>src/context/notifications.tsx</code> — 1 个</summary>

- `src/context/notifications.tsx`

</details>

<details><summary><code>src/context/overlayContext.tsx</code> — 1 个</summary>

- `src/context/overlayContext.tsx`

</details>

<details><summary><code>src/context/promptOverlayContext.tsx</code> — 1 个</summary>

- `src/context/promptOverlayContext.tsx`

</details>

<details><summary><code>src/context/QueuedMessageContext.tsx</code> — 1 个</summary>

- `src/context/QueuedMessageContext.tsx`

</details>

<details><summary><code>src/context/stats.tsx</code> — 1 个</summary>

- `src/context/stats.tsx`

</details>

<details><summary><code>src/context/voice.tsx</code> — 1 个</summary>

- `src/context/voice.tsx`

</details>

<details><summary><code>src/context.ts</code> — 1 个</summary>

- `src/context.ts`

</details>

<details><summary><code>src/coordinator/coordinatorMode.js.map</code> — 1 个</summary>

- `src/coordinator/coordinatorMode.js.map`

</details>

<details><summary><code>src/coordinator/coordinatorMode.ts</code> — 1 个</summary>

- `src/coordinator/coordinatorMode.ts`

</details>

<details><summary><code>src/coordinator/workerAgent.js.map</code> — 1 个</summary>

- `src/coordinator/workerAgent.js.map`

</details>

<details><summary><code>src/coordinator/workerAgent.ts</code> — 1 个</summary>

- `src/coordinator/workerAgent.ts`

</details>

<details><summary><code>src/cost-tracker.ts</code> — 1 个</summary>

- `src/cost-tracker.ts`

</details>

<details><summary><code>src/costHook.ts</code> — 1 个</summary>

- `src/costHook.ts`

</details>

<details><summary><code>src/daemon/main.ts</code> — 1 个</summary>

- `src/daemon/main.ts`

</details>

<details><summary><code>src/daemon/workerRegistry.ts</code> — 1 个</summary>

- `src/daemon/workerRegistry.ts`

</details>

<details><summary><code>src/desktop-bun</code> — 1 个</summary>

- `src/desktop-bun`

</details>

<details><summary><code>src/desktop-commands.js.map</code> — 1 个</summary>

- `src/desktop-commands.js.map`

</details>

<details><summary><code>src/desktop-context.js.map</code> — 1 个</summary>

- `src/desktop-context.js.map`

</details>

<details><summary><code>src/desktop-core.ts</code> — 1 个</summary>

- `src/desktop-core.ts`

</details>

<details><summary><code>src/desktop-cost-tracker.js.map</code> — 1 个</summary>

- `src/desktop-cost-tracker.js.map`

</details>

<details><summary><code>src/desktop-dialogLaunchers.tsx</code> — 1 个</summary>

- `src/desktop-dialogLaunchers.tsx`

</details>

<details><summary><code>src/desktop-electron/launch-electron.ts</code> — 1 个</summary>

- `src/desktop-electron/launch-electron.ts`

</details>

<details><summary><code>src/desktop-history.js.map</code> — 1 个</summary>

- `src/desktop-history.js.map`

</details>

<details><summary><code>src/desktop-index.ts</code> — 1 个</summary>

- `src/desktop-index.ts`

</details>

<details><summary><code>src/desktop-ink.js.map</code> — 1 个</summary>

- `src/desktop-ink.js.map`

</details>

<details><summary><code>src/desktop-projectOnboardingState.js.map</code> — 1 个</summary>

- `src/desktop-projectOnboardingState.js.map`

</details>

<details><summary><code>src/desktop-query--org.ts--</code> — 1 个</summary>

- `src/desktop-query--org.ts--`

</details>

<details><summary><code>src/desktop-query.js.map</code> — 1 个</summary>

- `src/desktop-query.js.map`

</details>

<details><summary><code>src/desktop-Task.js.map</code> — 1 个</summary>

- `src/desktop-Task.js.map`

</details>

<details><summary><code>src/desktop-tasks.js.map</code> — 1 个</summary>

- `src/desktop-tasks.js.map`

</details>

<details><summary><code>src/desktop-Tool.js.map</code> — 1 个</summary>

- `src/desktop-Tool.js.map`

</details>

<details><summary><code>src/desktop-tools.js.map</code> — 1 个</summary>

- `src/desktop-tools.js.map`

</details>

<details><summary><code>src/dev/installRuntimeGlobals.ts</code> — 1 个</summary>

- `src/dev/installRuntimeGlobals.ts`

</details>

<details><summary><code>src/dev-entry.ts</code> — 1 个</summary>

- `src/dev-entry.ts`

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

<details><summary><code>src/entrypoints/agentSdkTypes.js.map</code> — 1 个</summary>

- `src/entrypoints/agentSdkTypes.js.map`

</details>

<details><summary><code>src/entrypoints/agentSdkTypes.ts</code> — 1 个</summary>

- `src/entrypoints/agentSdkTypes.ts`

</details>

<details><summary><code>src/entrypoints/cli.tsx</code> — 1 个</summary>

- `src/entrypoints/cli.tsx`

</details>

<details><summary><code>src/entrypoints/dev-cli.tsx</code> — 1 个</summary>

- `src/entrypoints/dev-cli.tsx`

</details>

<details><summary><code>src/entrypoints/dev-mcp.ts</code> — 1 个</summary>

- `src/entrypoints/dev-mcp.ts`

</details>

<details><summary><code>src/entrypoints/init.ts</code> — 1 个</summary>

- `src/entrypoints/init.ts`

</details>

<details><summary><code>src/entrypoints/mcp.ts</code> — 1 个</summary>

- `src/entrypoints/mcp.ts`

</details>

<details><summary><code>src/entrypoints/sandboxTypes.js.map</code> — 1 个</summary>

- `src/entrypoints/sandboxTypes.js.map`

</details>

<details><summary><code>src/entrypoints/sandboxTypes.ts</code> — 1 个</summary>

- `src/entrypoints/sandboxTypes.ts`

</details>

<details><summary><code>src/environment-runner/main.ts</code> — 1 个</summary>

- `src/environment-runner/main.ts`

</details>

<details><summary><code>src/feature-repository.ts</code> — 1 个</summary>

- `src/feature-repository.ts`

</details>

<details><summary><code>src/features/additionalFeatures.ts</code> — 1 个</summary>

- `src/features/additionalFeatures.ts`

</details>

<details><summary><code>src/features/directoryAddedHook.ts</code> — 1 个</summary>

- `src/features/directoryAddedHook.ts`

</details>

<details><summary><code>src/features/emojiAutocomplete.ts</code> — 1 个</summary>

- `src/features/emojiAutocomplete.ts`

</details>

<details><summary><code>src/features/endConversation.ts</code> — 1 个</summary>

- `src/features/endConversation.ts`

</details>

<details><summary><code>src/features/featureFlags.ts</code> — 1 个</summary>

- `src/features/featureFlags.ts`

</details>

<details><summary><code>src/features/index.ts</code> — 1 个</summary>

- `src/features/index.ts`

</details>

<details><summary><code>src/features/mcpAutoBackground.ts</code> — 1 个</summary>

- `src/features/mcpAutoBackground.ts`

</details>

<details><summary><code>src/generated/globals.d.ts</code> — 1 个</summary>

- `src/generated/globals.d.ts`

</details>

<details><summary><code>src/generated/macro.ts</code> — 1 个</summary>

- `src/generated/macro.ts`

</details>

<details><summary><code>src/generated/status-line-embedded.js</code> — 1 个</summary>

- `src/generated/status-line-embedded.js`

</details>

<details><summary><code>src/generated/status-line-embedded.ts</code> — 1 个</summary>

- `src/generated/status-line-embedded.ts`

</details>

<details><summary><code>src/globals.d.ts</code> — 1 个</summary>

- `src/globals.d.ts`

</details>

<details><summary><code>src/GrowthBook.ts</code> — 1 个</summary>

- `src/GrowthBook.ts`

</details>

<details><summary><code>src/GrowthBookClient.ts</code> — 1 个</summary>

- `src/GrowthBookClient.ts`

</details>

<details><summary><code>src/history.ts</code> — 1 个</summary>

- `src/history.ts`

</details>

<details><summary><code>src/hooks/fileSuggestions.js.map</code> — 1 个</summary>

- `src/hooks/fileSuggestions.js.map`

</details>

<details><summary><code>src/hooks/fileSuggestions.ts</code> — 1 个</summary>

- `src/hooks/fileSuggestions.ts`

</details>

<details><summary><code>src/hooks/notifications.ts</code> — 1 个</summary>

- `src/hooks/notifications.ts`

</details>

<details><summary><code>src/hooks/renderPlaceholder.ts</code> — 1 个</summary>

- `src/hooks/renderPlaceholder.ts`

</details>

<details><summary><code>src/hooks/unifiedSuggestions.ts</code> — 1 个</summary>

- `src/hooks/unifiedSuggestions.ts`

</details>

<details><summary><code>src/hooks/useAfterFirstRender.ts</code> — 1 个</summary>

- `src/hooks/useAfterFirstRender.ts`

</details>

<details><summary><code>src/hooks/useApiKeyVerification.ts</code> — 1 个</summary>

- `src/hooks/useApiKeyVerification.ts`

</details>

<details><summary><code>src/hooks/useArrowKeyHistory.tsx</code> — 1 个</summary>

- `src/hooks/useArrowKeyHistory.tsx`

</details>

<details><summary><code>src/hooks/useAssistantHistory.ts</code> — 1 个</summary>

- `src/hooks/useAssistantHistory.ts`

</details>

<details><summary><code>src/hooks/useAwaySummary.ts</code> — 1 个</summary>

- `src/hooks/useAwaySummary.ts`

</details>

<details><summary><code>src/hooks/useBackgroundTaskNavigation.ts</code> — 1 个</summary>

- `src/hooks/useBackgroundTaskNavigation.ts`

</details>

<details><summary><code>src/hooks/useBlink.ts</code> — 1 个</summary>

- `src/hooks/useBlink.ts`

</details>

<details><summary><code>src/hooks/useCancelRequest.ts</code> — 1 个</summary>

- `src/hooks/useCancelRequest.ts`

</details>

<details><summary><code>src/hooks/useCanUseTool.tsx</code> — 1 个</summary>

- `src/hooks/useCanUseTool.tsx`

</details>

<details><summary><code>src/hooks/useChromeExtensionNotification.tsx</code> — 1 个</summary>

- `src/hooks/useChromeExtensionNotification.tsx`

</details>

<details><summary><code>src/hooks/useClaudeCodeHintRecommendation.tsx</code> — 1 个</summary>

- `src/hooks/useClaudeCodeHintRecommendation.tsx`

</details>

<details><summary><code>src/hooks/useClipboardImageHint.ts</code> — 1 个</summary>

- `src/hooks/useClipboardImageHint.ts`

</details>

<details><summary><code>src/hooks/useCommandKeybindings.ts</code> — 1 个</summary>

- `src/hooks/useCommandKeybindings.ts`

</details>

<details><summary><code>src/hooks/useCommandKeybindings.tsx</code> — 1 个</summary>

- `src/hooks/useCommandKeybindings.tsx`

</details>

<details><summary><code>src/hooks/useCommandQueue.ts</code> — 1 个</summary>

- `src/hooks/useCommandQueue.ts`

</details>

<details><summary><code>src/hooks/useCopyOnSelect.ts</code> — 1 个</summary>

- `src/hooks/useCopyOnSelect.ts`

</details>

<details><summary><code>src/hooks/useDeferredHookMessages.ts</code> — 1 个</summary>

- `src/hooks/useDeferredHookMessages.ts`

</details>

<details><summary><code>src/hooks/useDesktopVimInput.ts</code> — 1 个</summary>

- `src/hooks/useDesktopVimInput.ts`

</details>

<details><summary><code>src/hooks/useDiffData.ts</code> — 1 个</summary>

- `src/hooks/useDiffData.ts`

</details>

<details><summary><code>src/hooks/useDiffInIDE.ts</code> — 1 个</summary>

- `src/hooks/useDiffInIDE.ts`

</details>

<details><summary><code>src/hooks/useDirectConnect.ts</code> — 1 个</summary>

- `src/hooks/useDirectConnect.ts`

</details>

<details><summary><code>src/hooks/useDoublePress.ts</code> — 1 个</summary>

- `src/hooks/useDoublePress.ts`

</details>

<details><summary><code>src/hooks/useDynamicConfig.ts</code> — 1 个</summary>

- `src/hooks/useDynamicConfig.ts`

</details>

<details><summary><code>src/hooks/useElapsedTime.ts</code> — 1 个</summary>

- `src/hooks/useElapsedTime.ts`

</details>

<details><summary><code>src/hooks/useExitOnCtrlCD.ts</code> — 1 个</summary>

- `src/hooks/useExitOnCtrlCD.ts`

</details>

<details><summary><code>src/hooks/useExitOnCtrlCDWithKeybindings.ts</code> — 1 个</summary>

- `src/hooks/useExitOnCtrlCDWithKeybindings.ts`

</details>

<details><summary><code>src/hooks/useFileHistorySnapshotInit.ts</code> — 1 个</summary>

- `src/hooks/useFileHistorySnapshotInit.ts`

</details>

<details><summary><code>src/hooks/useGlobalKeybindings.tsx</code> — 1 个</summary>

- `src/hooks/useGlobalKeybindings.tsx`

</details>

<details><summary><code>src/hooks/useHistorySearch.ts</code> — 1 个</summary>

- `src/hooks/useHistorySearch.ts`

</details>

<details><summary><code>src/hooks/useIdeAtMentioned.ts</code> — 1 个</summary>

- `src/hooks/useIdeAtMentioned.ts`

</details>

<details><summary><code>src/hooks/useIdeConnectionStatus.ts</code> — 1 个</summary>

- `src/hooks/useIdeConnectionStatus.ts`

</details>

<details><summary><code>src/hooks/useIDEIntegration.tsx</code> — 1 个</summary>

- `src/hooks/useIDEIntegration.tsx`

</details>

<details><summary><code>src/hooks/useIdeLogging.ts</code> — 1 个</summary>

- `src/hooks/useIdeLogging.ts`

</details>

<details><summary><code>src/hooks/useIdeSelection.js.map</code> — 1 个</summary>

- `src/hooks/useIdeSelection.js.map`

</details>

<details><summary><code>src/hooks/useIdeSelection.ts</code> — 1 个</summary>

- `src/hooks/useIdeSelection.ts`

</details>

<details><summary><code>src/hooks/useInboxPoller.ts</code> — 1 个</summary>

- `src/hooks/useInboxPoller.ts`

</details>

<details><summary><code>src/hooks/useInputBuffer.ts</code> — 1 个</summary>

- `src/hooks/useInputBuffer.ts`

</details>

<details><summary><code>src/hooks/useIssueFlagBanner.ts</code> — 1 个</summary>

- `src/hooks/useIssueFlagBanner.ts`

</details>

<details><summary><code>src/hooks/useLogMessages.ts</code> — 1 个</summary>

- `src/hooks/useLogMessages.ts`

</details>

<details><summary><code>src/hooks/useLspPluginRecommendation.tsx</code> — 1 个</summary>

- `src/hooks/useLspPluginRecommendation.tsx`

</details>

<details><summary><code>src/hooks/useMailboxBridge.ts</code> — 1 个</summary>

- `src/hooks/useMailboxBridge.ts`

</details>

<details><summary><code>src/hooks/useMainLoopModel.ts</code> — 1 个</summary>

- `src/hooks/useMainLoopModel.ts`

</details>

<details><summary><code>src/hooks/useManagePlugins.ts</code> — 1 个</summary>

- `src/hooks/useManagePlugins.ts`

</details>

<details><summary><code>src/hooks/useMemoryUsage.ts</code> — 1 个</summary>

- `src/hooks/useMemoryUsage.ts`

</details>

<details><summary><code>src/hooks/useMergedClients.ts</code> — 1 个</summary>

- `src/hooks/useMergedClients.ts`

</details>

<details><summary><code>src/hooks/useMergedCommands.ts</code> — 1 个</summary>

- `src/hooks/useMergedCommands.ts`

</details>

<details><summary><code>src/hooks/useMergedTools.ts</code> — 1 个</summary>

- `src/hooks/useMergedTools.ts`

</details>

<details><summary><code>src/hooks/useMinDisplayTime.ts</code> — 1 个</summary>

- `src/hooks/useMinDisplayTime.ts`

</details>

<details><summary><code>src/hooks/useNotifyAfterTimeout.ts</code> — 1 个</summary>

- `src/hooks/useNotifyAfterTimeout.ts`

</details>

<details><summary><code>src/hooks/useOfficialMarketplaceNotification.tsx</code> — 1 个</summary>

- `src/hooks/useOfficialMarketplaceNotification.tsx`

</details>

<details><summary><code>src/hooks/usePackageUpdateNotice.ts</code> — 1 个</summary>

- `src/hooks/usePackageUpdateNotice.ts`

</details>

<details><summary><code>src/hooks/usePasteHandler.ts</code> — 1 个</summary>

- `src/hooks/usePasteHandler.ts`

</details>

<details><summary><code>src/hooks/usePluginRecommendationBase.tsx</code> — 1 个</summary>

- `src/hooks/usePluginRecommendationBase.tsx`

</details>

<details><summary><code>src/hooks/usePromptsFromClaudeInChrome.tsx</code> — 1 个</summary>

- `src/hooks/usePromptsFromClaudeInChrome.tsx`

</details>

<details><summary><code>src/hooks/usePromptSuggestion.ts</code> — 1 个</summary>

- `src/hooks/usePromptSuggestion.ts`

</details>

<details><summary><code>src/hooks/usePrStatus.ts</code> — 1 个</summary>

- `src/hooks/usePrStatus.ts`

</details>

<details><summary><code>src/hooks/useQueueProcessor.ts</code> — 1 个</summary>

- `src/hooks/useQueueProcessor.ts`

</details>

<details><summary><code>src/hooks/useRemoteSession.ts</code> — 1 个</summary>

- `src/hooks/useRemoteSession.ts`

</details>

<details><summary><code>src/hooks/useReplBridge.tsx</code> — 1 个</summary>

- `src/hooks/useReplBridge.tsx`

</details>

<details><summary><code>src/hooks/useScheduledTasks.ts</code> — 1 个</summary>

- `src/hooks/useScheduledTasks.ts`

</details>

<details><summary><code>src/hooks/useSearchInput.ts</code> — 1 个</summary>

- `src/hooks/useSearchInput.ts`

</details>

<details><summary><code>src/hooks/useSessionBackgrounding.ts</code> — 1 个</summary>

- `src/hooks/useSessionBackgrounding.ts`

</details>

<details><summary><code>src/hooks/useSettings.ts</code> — 1 个</summary>

- `src/hooks/useSettings.ts`

</details>

<details><summary><code>src/hooks/useSettingsChange.ts</code> — 1 个</summary>

- `src/hooks/useSettingsChange.ts`

</details>

<details><summary><code>src/hooks/useSkillImprovementSurvey.ts</code> — 1 个</summary>

- `src/hooks/useSkillImprovementSurvey.ts`

</details>

<details><summary><code>src/hooks/useSkillsChange.ts</code> — 1 个</summary>

- `src/hooks/useSkillsChange.ts`

</details>

<details><summary><code>src/hooks/useSSHSession.ts</code> — 1 个</summary>

- `src/hooks/useSSHSession.ts`

</details>

<details><summary><code>src/hooks/useSwarmInitialization.ts</code> — 1 个</summary>

- `src/hooks/useSwarmInitialization.ts`

</details>

<details><summary><code>src/hooks/useSwarmPermissionPoller.js.map</code> — 1 个</summary>

- `src/hooks/useSwarmPermissionPoller.js.map`

</details>

<details><summary><code>src/hooks/useSwarmPermissionPoller.ts</code> — 1 个</summary>

- `src/hooks/useSwarmPermissionPoller.ts`

</details>

<details><summary><code>src/hooks/useTaskListWatcher.ts</code> — 1 个</summary>

- `src/hooks/useTaskListWatcher.ts`

</details>

<details><summary><code>src/hooks/useTasksV2.ts</code> — 1 个</summary>

- `src/hooks/useTasksV2.ts`

</details>

<details><summary><code>src/hooks/useTeammateViewAutoExit.ts</code> — 1 个</summary>

- `src/hooks/useTeammateViewAutoExit.ts`

</details>

<details><summary><code>src/hooks/useTeleportResume.tsx</code> — 1 个</summary>

- `src/hooks/useTeleportResume.tsx`

</details>

<details><summary><code>src/hooks/useTerminalSize.ts</code> — 1 个</summary>

- `src/hooks/useTerminalSize.ts`

</details>

<details><summary><code>src/hooks/useTextInput.ts</code> — 1 个</summary>

- `src/hooks/useTextInput.ts`

</details>

<details><summary><code>src/hooks/useTimeout.ts</code> — 1 个</summary>

- `src/hooks/useTimeout.ts`

</details>

<details><summary><code>src/hooks/useTurnDiffs.ts</code> — 1 个</summary>

- `src/hooks/useTurnDiffs.ts`

</details>

<details><summary><code>src/hooks/useTypeahead.tsx</code> — 1 个</summary>

- `src/hooks/useTypeahead.tsx`

</details>

<details><summary><code>src/hooks/useUpdateNotification.ts</code> — 1 个</summary>

- `src/hooks/useUpdateNotification.ts`

</details>

<details><summary><code>src/hooks/useVimInput.ts</code> — 1 个</summary>

- `src/hooks/useVimInput.ts`

</details>

<details><summary><code>src/hooks/useVirtualScroll.ts</code> — 1 个</summary>

- `src/hooks/useVirtualScroll.ts`

</details>

<details><summary><code>src/hooks/useVoice.ts</code> — 1 个</summary>

- `src/hooks/useVoice.ts`

</details>

<details><summary><code>src/hooks/useVoiceEnabled.ts</code> — 1 个</summary>

- `src/hooks/useVoiceEnabled.ts`

</details>

<details><summary><code>src/hooks/useVoiceIntegration.tsx</code> — 1 个</summary>

- `src/hooks/useVoiceIntegration.tsx`

</details>

<details><summary><code>src/ink/Ansi.tsx</code> — 1 个</summary>

- `src/ink/Ansi.tsx`

</details>

<details><summary><code>src/ink/bidi.js.map</code> — 1 个</summary>

- `src/ink/bidi.js.map`

</details>

<details><summary><code>src/ink/bidi.ts</code> — 1 个</summary>

- `src/ink/bidi.ts`

</details>

<details><summary><code>src/ink/clearTerminal.js.map</code> — 1 个</summary>

- `src/ink/clearTerminal.js.map`

</details>

<details><summary><code>src/ink/clearTerminal.ts</code> — 1 个</summary>

- `src/ink/clearTerminal.ts`

</details>

<details><summary><code>src/ink/colorize.js.map</code> — 1 个</summary>

- `src/ink/colorize.js.map`

</details>

<details><summary><code>src/ink/colorize.ts</code> — 1 个</summary>

- `src/ink/colorize.ts`

</details>

<details><summary><code>src/ink/constants.ts</code> — 1 个</summary>

- `src/ink/constants.ts`

</details>

<details><summary><code>src/ink/cursor.js.map</code> — 1 个</summary>

- `src/ink/cursor.js.map`

</details>

<details><summary><code>src/ink/cursor.ts</code> — 1 个</summary>

- `src/ink/cursor.ts`

</details>

<details><summary><code>src/ink/devtools.ts</code> — 1 个</summary>

- `src/ink/devtools.ts`

</details>

<details><summary><code>src/ink/dom.js.map</code> — 1 个</summary>

- `src/ink/dom.js.map`

</details>

<details><summary><code>src/ink/dom.ts</code> — 1 个</summary>

- `src/ink/dom.ts`

</details>

<details><summary><code>src/ink/focus.js.map</code> — 1 个</summary>

- `src/ink/focus.js.map`

</details>

<details><summary><code>src/ink/focus.ts</code> — 1 个</summary>

- `src/ink/focus.ts`

</details>

<details><summary><code>src/ink/frame.js.map</code> — 1 个</summary>

- `src/ink/frame.js.map`

</details>

<details><summary><code>src/ink/frame.ts</code> — 1 个</summary>

- `src/ink/frame.ts`

</details>

<details><summary><code>src/ink/get-max-width.js.map</code> — 1 个</summary>

- `src/ink/get-max-width.js.map`

</details>

<details><summary><code>src/ink/get-max-width.ts</code> — 1 个</summary>

- `src/ink/get-max-width.ts`

</details>

<details><summary><code>src/ink/global.d.ts</code> — 1 个</summary>

- `src/ink/global.d.ts`

</details>

<details><summary><code>src/ink/global.ts</code> — 1 个</summary>

- `src/ink/global.ts`

</details>

<details><summary><code>src/ink/hit-test.ts</code> — 1 个</summary>

- `src/ink/hit-test.ts`

</details>

<details><summary><code>src/ink/ink.tsx</code> — 1 个</summary>

- `src/ink/ink.tsx`

</details>

<details><summary><code>src/ink/instances.js.map</code> — 1 个</summary>

- `src/ink/instances.js.map`

</details>

<details><summary><code>src/ink/instances.ts</code> — 1 个</summary>

- `src/ink/instances.ts`

</details>

<details><summary><code>src/ink/line-width-cache.js.map</code> — 1 个</summary>

- `src/ink/line-width-cache.js.map`

</details>

<details><summary><code>src/ink/line-width-cache.ts</code> — 1 个</summary>

- `src/ink/line-width-cache.ts`

</details>

<details><summary><code>src/ink/log-update.ts</code> — 1 个</summary>

- `src/ink/log-update.ts`

</details>

<details><summary><code>src/ink/measure-element.js.map</code> — 1 个</summary>

- `src/ink/measure-element.js.map`

</details>

<details><summary><code>src/ink/measure-element.ts</code> — 1 个</summary>

- `src/ink/measure-element.ts`

</details>

<details><summary><code>src/ink/measure-text.js.map</code> — 1 个</summary>

- `src/ink/measure-text.js.map`

</details>

<details><summary><code>src/ink/measure-text.ts</code> — 1 个</summary>

- `src/ink/measure-text.ts`

</details>

<details><summary><code>src/ink/node-cache.js.map</code> — 1 个</summary>

- `src/ink/node-cache.js.map`

</details>

<details><summary><code>src/ink/node-cache.ts</code> — 1 个</summary>

- `src/ink/node-cache.ts`

</details>

<details><summary><code>src/ink/optimizer.ts</code> — 1 个</summary>

- `src/ink/optimizer.ts`

</details>

<details><summary><code>src/ink/output.js.map</code> — 1 个</summary>

- `src/ink/output.js.map`

</details>

<details><summary><code>src/ink/output.ts</code> — 1 个</summary>

- `src/ink/output.ts`

</details>

<details><summary><code>src/ink/parse-keypress.js.map</code> — 1 个</summary>

- `src/ink/parse-keypress.js.map`

</details>

<details><summary><code>src/ink/parse-keypress.ts</code> — 1 个</summary>

- `src/ink/parse-keypress.ts`

</details>

<details><summary><code>src/ink/reconciler.ts</code> — 1 个</summary>

- `src/ink/reconciler.ts`

</details>

<details><summary><code>src/ink/render-border.js.map</code> — 1 个</summary>

- `src/ink/render-border.js.map`

</details>

<details><summary><code>src/ink/render-border.ts</code> — 1 个</summary>

- `src/ink/render-border.ts`

</details>

<details><summary><code>src/ink/render-node-to-output.js.map</code> — 1 个</summary>

- `src/ink/render-node-to-output.js.map`

</details>

<details><summary><code>src/ink/render-node-to-output.ts</code> — 1 个</summary>

- `src/ink/render-node-to-output.ts`

</details>

<details><summary><code>src/ink/render-to-screen.ts</code> — 1 个</summary>

- `src/ink/render-to-screen.ts`

</details>

<details><summary><code>src/ink/renderer.ts</code> — 1 个</summary>

- `src/ink/renderer.ts`

</details>

<details><summary><code>src/ink/root.js.map</code> — 1 个</summary>

- `src/ink/root.js.map`

</details>

<details><summary><code>src/ink/root.ts</code> — 1 个</summary>

- `src/ink/root.ts`

</details>

<details><summary><code>src/ink/screen.js.map</code> — 1 个</summary>

- `src/ink/screen.js.map`

</details>

<details><summary><code>src/ink/screen.ts</code> — 1 个</summary>

- `src/ink/screen.ts`

</details>

<details><summary><code>src/ink/searchHighlight.ts</code> — 1 个</summary>

- `src/ink/searchHighlight.ts`

</details>

<details><summary><code>src/ink/selection.js.map</code> — 1 个</summary>

- `src/ink/selection.js.map`

</details>

<details><summary><code>src/ink/selection.ts</code> — 1 个</summary>

- `src/ink/selection.ts`

</details>

<details><summary><code>src/ink/squash-text-nodes.js.map</code> — 1 个</summary>

- `src/ink/squash-text-nodes.js.map`

</details>

<details><summary><code>src/ink/squash-text-nodes.ts</code> — 1 个</summary>

- `src/ink/squash-text-nodes.ts`

</details>

<details><summary><code>src/ink/stringWidth.js.map</code> — 1 个</summary>

- `src/ink/stringWidth.js.map`

</details>

<details><summary><code>src/ink/stringWidth.ts</code> — 1 个</summary>

- `src/ink/stringWidth.ts`

</details>

<details><summary><code>src/ink/styles.js.map</code> — 1 个</summary>

- `src/ink/styles.js.map`

</details>

<details><summary><code>src/ink/styles.ts</code> — 1 个</summary>

- `src/ink/styles.ts`

</details>

<details><summary><code>src/ink/supports-hyperlinks.js.map</code> — 1 个</summary>

- `src/ink/supports-hyperlinks.js.map`

</details>

<details><summary><code>src/ink/supports-hyperlinks.ts</code> — 1 个</summary>

- `src/ink/supports-hyperlinks.ts`

</details>

<details><summary><code>src/ink/tabstops.js.map</code> — 1 个</summary>

- `src/ink/tabstops.js.map`

</details>

<details><summary><code>src/ink/tabstops.ts</code> — 1 个</summary>

- `src/ink/tabstops.ts`

</details>

<details><summary><code>src/ink/terminal-focus-state.ts</code> — 1 个</summary>

- `src/ink/terminal-focus-state.ts`

</details>

<details><summary><code>src/ink/terminal-querier.js.map</code> — 1 个</summary>

- `src/ink/terminal-querier.js.map`

</details>

<details><summary><code>src/ink/terminal-querier.ts</code> — 1 个</summary>

- `src/ink/terminal-querier.ts`

</details>

<details><summary><code>src/ink/terminal.js.map</code> — 1 个</summary>

- `src/ink/terminal.js.map`

</details>

<details><summary><code>src/ink/terminal.ts</code> — 1 个</summary>

- `src/ink/terminal.ts`

</details>

<details><summary><code>src/ink/termio.ts</code> — 1 个</summary>

- `src/ink/termio.ts`

</details>

<details><summary><code>src/ink/useTerminalNotification.js.map</code> — 1 个</summary>

- `src/ink/useTerminalNotification.js.map`

</details>

<details><summary><code>src/ink/useTerminalNotification.ts</code> — 1 个</summary>

- `src/ink/useTerminalNotification.ts`

</details>

<details><summary><code>src/ink/warn.js.map</code> — 1 个</summary>

- `src/ink/warn.js.map`

</details>

<details><summary><code>src/ink/warn.ts</code> — 1 个</summary>

- `src/ink/warn.ts`

</details>

<details><summary><code>src/ink/widest-line.js.map</code> — 1 个</summary>

- `src/ink/widest-line.js.map`

</details>

<details><summary><code>src/ink/widest-line.ts</code> — 1 个</summary>

- `src/ink/widest-line.ts`

</details>

<details><summary><code>src/ink/wrap-text.js.map</code> — 1 个</summary>

- `src/ink/wrap-text.js.map`

</details>

<details><summary><code>src/ink/wrap-text.ts</code> — 1 个</summary>

- `src/ink/wrap-text.ts`

</details>

<details><summary><code>src/ink/wrapAnsi.js.map</code> — 1 个</summary>

- `src/ink/wrapAnsi.js.map`

</details>

<details><summary><code>src/ink/wrapAnsi.ts</code> — 1 个</summary>

- `src/ink/wrapAnsi.ts`

</details>

<details><summary><code>src/ink.ts</code> — 1 个</summary>

- `src/ink.ts`

</details>

<details><summary><code>src/interactiveHelpers.tsx</code> — 1 个</summary>

- `src/interactiveHelpers.tsx`

</details>

<details><summary><code>src/jobs/classifier.js.map</code> — 1 个</summary>

- `src/jobs/classifier.js.map`

</details>

<details><summary><code>src/jobs/classifier.ts</code> — 1 个</summary>

- `src/jobs/classifier.ts`

</details>

<details><summary><code>src/keybindings/defaultBindings.js.map</code> — 1 个</summary>

- `src/keybindings/defaultBindings.js.map`

</details>

<details><summary><code>src/keybindings/defaultBindings.ts</code> — 1 个</summary>

- `src/keybindings/defaultBindings.ts`

</details>

<details><summary><code>src/keybindings/KeybindingContext.tsx</code> — 1 个</summary>

- `src/keybindings/KeybindingContext.tsx`

</details>

<details><summary><code>src/keybindings/KeybindingProviderSetup.tsx</code> — 1 个</summary>

- `src/keybindings/KeybindingProviderSetup.tsx`

</details>

<details><summary><code>src/keybindings/loadUserBindings.js.map</code> — 1 个</summary>

- `src/keybindings/loadUserBindings.js.map`

</details>

<details><summary><code>src/keybindings/loadUserBindings.ts</code> — 1 个</summary>

- `src/keybindings/loadUserBindings.ts`

</details>

<details><summary><code>src/keybindings/match.js.map</code> — 1 个</summary>

- `src/keybindings/match.js.map`

</details>

<details><summary><code>src/keybindings/match.ts</code> — 1 个</summary>

- `src/keybindings/match.ts`

</details>

<details><summary><code>src/keybindings/parser.js.map</code> — 1 个</summary>

- `src/keybindings/parser.js.map`

</details>

<details><summary><code>src/keybindings/parser.ts</code> — 1 个</summary>

- `src/keybindings/parser.ts`

</details>

<details><summary><code>src/keybindings/reservedShortcuts.js.map</code> — 1 个</summary>

- `src/keybindings/reservedShortcuts.js.map`

</details>

<details><summary><code>src/keybindings/reservedShortcuts.ts</code> — 1 个</summary>

- `src/keybindings/reservedShortcuts.ts`

</details>

<details><summary><code>src/keybindings/resolver.js.map</code> — 1 个</summary>

- `src/keybindings/resolver.js.map`

</details>

<details><summary><code>src/keybindings/resolver.ts</code> — 1 个</summary>

- `src/keybindings/resolver.ts`

</details>

<details><summary><code>src/keybindings/schema.ts</code> — 1 个</summary>

- `src/keybindings/schema.ts`

</details>

<details><summary><code>src/keybindings/shortcutFormat.js.map</code> — 1 个</summary>

- `src/keybindings/shortcutFormat.js.map`

</details>

<details><summary><code>src/keybindings/shortcutFormat.ts</code> — 1 个</summary>

- `src/keybindings/shortcutFormat.ts`

</details>

<details><summary><code>src/keybindings/template.js.map</code> — 1 个</summary>

- `src/keybindings/template.js.map`

</details>

<details><summary><code>src/keybindings/template.ts</code> — 1 个</summary>

- `src/keybindings/template.ts`

</details>

<details><summary><code>src/keybindings/types.js.map</code> — 1 个</summary>

- `src/keybindings/types.js.map`

</details>

<details><summary><code>src/keybindings/types.ts</code> — 1 个</summary>

- `src/keybindings/types.ts`

</details>

<details><summary><code>src/keybindings/useKeybinding.ts</code> — 1 个</summary>

- `src/keybindings/useKeybinding.ts`

</details>

<details><summary><code>src/keybindings/useShortcutDisplay.ts</code> — 1 个</summary>

- `src/keybindings/useShortcutDisplay.ts`

</details>

<details><summary><code>src/keybindings/validate.js.map</code> — 1 个</summary>

- `src/keybindings/validate.js.map`

</details>

<details><summary><code>src/keybindings/validate.ts</code> — 1 个</summary>

- `src/keybindings/validate.ts`

</details>

<details><summary><code>src/main/agents</code> — 1 个</summary>

- `src/main/agents/agentsService.ts`

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

<details><summary><code>src/main.py</code> — 1 个</summary>

- `src/main.py`

</details>

<details><summary><code>src/main.tsx</code> — 1 个</summary>

- `src/main.tsx`

</details>

<details><summary><code>src/memdir/findRelevantMemories.js.map</code> — 1 个</summary>

- `src/memdir/findRelevantMemories.js.map`

</details>

<details><summary><code>src/memdir/findRelevantMemories.ts</code> — 1 个</summary>

- `src/memdir/findRelevantMemories.ts`

</details>

<details><summary><code>src/memdir/memdir.js.map</code> — 1 个</summary>

- `src/memdir/memdir.js.map`

</details>

<details><summary><code>src/memdir/memdir.ts</code> — 1 个</summary>

- `src/memdir/memdir.ts`

</details>

<details><summary><code>src/memdir/memoryAge.js.map</code> — 1 个</summary>

- `src/memdir/memoryAge.js.map`

</details>

<details><summary><code>src/memdir/memoryAge.ts</code> — 1 个</summary>

- `src/memdir/memoryAge.ts`

</details>

<details><summary><code>src/memdir/memoryScan.js.map</code> — 1 个</summary>

- `src/memdir/memoryScan.js.map`

</details>

<details><summary><code>src/memdir/memoryScan.ts</code> — 1 个</summary>

- `src/memdir/memoryScan.ts`

</details>

<details><summary><code>src/memdir/memoryShapeTelemetry.js.map</code> — 1 个</summary>

- `src/memdir/memoryShapeTelemetry.js.map`

</details>

<details><summary><code>src/memdir/memoryShapeTelemetry.ts</code> — 1 个</summary>

- `src/memdir/memoryShapeTelemetry.ts`

</details>

<details><summary><code>src/memdir/memoryTypes.js.map</code> — 1 个</summary>

- `src/memdir/memoryTypes.js.map`

</details>

<details><summary><code>src/memdir/memoryTypes.ts</code> — 1 个</summary>

- `src/memdir/memoryTypes.ts`

</details>

<details><summary><code>src/memdir/paths.js.map</code> — 1 个</summary>

- `src/memdir/paths.js.map`

</details>

<details><summary><code>src/memdir/paths.ts</code> — 1 个</summary>

- `src/memdir/paths.ts`

</details>

<details><summary><code>src/memdir/teamMemPaths.js.map</code> — 1 个</summary>

- `src/memdir/teamMemPaths.js.map`

</details>

<details><summary><code>src/memdir/teamMemPaths.ts</code> — 1 个</summary>

- `src/memdir/teamMemPaths.ts`

</details>

<details><summary><code>src/memdir/teamMemPrompts.js.map</code> — 1 个</summary>

- `src/memdir/teamMemPrompts.js.map`

</details>

<details><summary><code>src/memdir/teamMemPrompts.ts</code> — 1 个</summary>

- `src/memdir/teamMemPrompts.ts`

</details>

<details><summary><code>src/memory/memory_tool.py</code> — 1 个</summary>

- `src/memory/memory_tool.py`

</details>

<details><summary><code>src/migrations/migrateAutoUpdatesToSettings.ts</code> — 1 个</summary>

- `src/migrations/migrateAutoUpdatesToSettings.ts`

</details>

<details><summary><code>src/migrations/migrateBypassPermissionsAcceptedToSettings.ts</code> — 1 个</summary>

- `src/migrations/migrateBypassPermissionsAcceptedToSettings.ts`

</details>

<details><summary><code>src/migrations/migrateEnableAllProjectMcpServersToSettings.ts</code> — 1 个</summary>

- `src/migrations/migrateEnableAllProjectMcpServersToSettings.ts`

</details>

<details><summary><code>src/migrations/migrateFennecToOpus.ts</code> — 1 个</summary>

- `src/migrations/migrateFennecToOpus.ts`

</details>

<details><summary><code>src/migrations/migrateLegacyOpusToCurrent.ts</code> — 1 个</summary>

- `src/migrations/migrateLegacyOpusToCurrent.ts`

</details>

<details><summary><code>src/migrations/migrateOpusToOpus1m.ts</code> — 1 个</summary>

- `src/migrations/migrateOpusToOpus1m.ts`

</details>

<details><summary><code>src/migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts</code> — 1 个</summary>

- `src/migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts`

</details>

<details><summary><code>src/migrations/migrateSonnet1mToSonnet45.ts</code> — 1 个</summary>

- `src/migrations/migrateSonnet1mToSonnet45.ts`

</details>

<details><summary><code>src/migrations/migrateSonnet45ToSonnet46.ts</code> — 1 个</summary>

- `src/migrations/migrateSonnet45ToSonnet46.ts`

</details>

<details><summary><code>src/migrations/resetAutoModeOptInForDefaultOffer.ts</code> — 1 个</summary>

- `src/migrations/resetAutoModeOptInForDefaultOffer.ts`

</details>

<details><summary><code>src/migrations/resetProToOpusDefault.ts</code> — 1 个</summary>

- `src/migrations/resetProToOpusDefault.ts`

</details>

<details><summary><code>src/mongrule.ts</code> — 1 个</summary>

- `src/mongrule.ts`

</details>

<details><summary><code>src/moreright/useMoreRight.tsx</code> — 1 个</summary>

- `src/moreright/useMoreRight.tsx`

</details>

<details><summary><code>src/native-ts/color-diff</code> — 1 个</summary>

- `src/native-ts/color-diff/index.ts`

</details>

<details><summary><code>src/outputStyles/loadOutputStylesDir.js.map</code> — 1 个</summary>

- `src/outputStyles/loadOutputStylesDir.js.map`

</details>

<details><summary><code>src/outputStyles/loadOutputStylesDir.ts</code> — 1 个</summary>

- `src/outputStyles/loadOutputStylesDir.ts`

</details>

<details><summary><code>src/performance/ContextCompactor.ts</code> — 1 个</summary>

- `src/performance/ContextCompactor.ts`

</details>

<details><summary><code>src/performance/Debounce.ts</code> — 1 个</summary>

- `src/performance/Debounce.ts`

</details>

<details><summary><code>src/performance/index.ts</code> — 1 个</summary>

- `src/performance/index.ts`

</details>

<details><summary><code>src/performance/LazyLoader.ts</code> — 1 个</summary>

- `src/performance/LazyLoader.ts`

</details>

<details><summary><code>src/performance/LRUCache.ts</code> — 1 个</summary>

- `src/performance/LRUCache.ts`

</details>

<details><summary><code>src/performance/Memoize.ts</code> — 1 个</summary>

- `src/performance/Memoize.ts`

</details>

<details><summary><code>src/performance/MemoryMonitor.ts</code> — 1 个</summary>

- `src/performance/MemoryMonitor.ts`

</details>

<details><summary><code>src/performance/ObjectPool.ts</code> — 1 个</summary>

- `src/performance/ObjectPool.ts`

</details>

<details><summary><code>src/performance/PerformanceMonitor.ts</code> — 1 个</summary>

- `src/performance/PerformanceMonitor.ts`

</details>

<details><summary><code>src/performance/RequestQueue.ts</code> — 1 个</summary>

- `src/performance/RequestQueue.ts`

</details>

<details><summary><code>src/performance/Retryer.ts</code> — 1 个</summary>

- `src/performance/Retryer.ts`

</details>

<details><summary><code>src/performance/StartupOptimizer.ts</code> — 1 个</summary>

- `src/performance/StartupOptimizer.ts`

</details>

<details><summary><code>src/performance/VirtualScroller.ts</code> — 1 个</summary>

- `src/performance/VirtualScroller.ts`

</details>

<details><summary><code>src/plugins/auto-attributes.ts</code> — 1 个</summary>

- `src/plugins/auto-attributes.ts`

</details>

<details><summary><code>src/plugins/builtinPlugins.js.map</code> — 1 个</summary>

- `src/plugins/builtinPlugins.js.map`

</details>

<details><summary><code>src/plugins/builtinPlugins.ts</code> — 1 个</summary>

- `src/plugins/builtinPlugins.ts`

</details>

<details><summary><code>src/plugins/bundled</code> — 1 个</summary>

- `src/plugins/bundled/index.ts`

</details>

<details><summary><code>src/plugins/devtools.ts</code> — 1 个</summary>

- `src/plugins/devtools.ts`

</details>

<details><summary><code>src/plugins/growthbook-tracking.ts</code> — 1 个</summary>

- `src/plugins/growthbook-tracking.ts`

</details>

<details><summary><code>src/plugins/index.ts</code> — 1 个</summary>

- `src/plugins/index.ts`

</details>

<details><summary><code>src/plugins/third-party-tracking.ts</code> — 1 个</summary>

- `src/plugins/third-party-tracking.ts`

</details>

<details><summary><code>src/polyfills/bun-bundle-polyfill.ts</code> — 1 个</summary>

- `src/polyfills/bun-bundle-polyfill.ts`

</details>

<details><summary><code>src/polyfills/bun-sqlite-polyfill.ts</code> — 1 个</summary>

- `src/polyfills/bun-sqlite-polyfill.ts`

</details>

<details><summary><code>src/preload/index.d.ts</code> — 1 个</summary>

- `src/preload/index.d.ts`

</details>

<details><summary><code>src/preload/index.js</code> — 1 个</summary>

- `src/preload/index.js`

</details>

<details><summary><code>src/proactive/index.js.map</code> — 1 个</summary>

- `src/proactive/index.js.map`

</details>

<details><summary><code>src/proactive/index.ts</code> — 1 个</summary>

- `src/proactive/index.ts`

</details>

<details><summary><code>src/proactive/useProactive.ts</code> — 1 个</summary>

- `src/proactive/useProactive.ts`

</details>

<details><summary><code>src/projectOnboardingState.ts</code> — 1 个</summary>

- `src/projectOnboardingState.ts`

</details>

<details><summary><code>src/query/config.js.map</code> — 1 个</summary>

- `src/query/config.js.map`

</details>

<details><summary><code>src/query/config.ts</code> — 1 个</summary>

- `src/query/config.ts`

</details>

<details><summary><code>src/query/deps.js.map</code> — 1 个</summary>

- `src/query/deps.js.map`

</details>

<details><summary><code>src/query/deps.ts</code> — 1 个</summary>

- `src/query/deps.ts`

</details>

<details><summary><code>src/query/emptyContentHandler.js.map</code> — 1 个</summary>

- `src/query/emptyContentHandler.js.map`

</details>

<details><summary><code>src/query/emptyContentHandler.ts</code> — 1 个</summary>

- `src/query/emptyContentHandler.ts`

</details>

<details><summary><code>src/query/stopHooks.js.map</code> — 1 个</summary>

- `src/query/stopHooks.js.map`

</details>

<details><summary><code>src/query/stopHooks.ts</code> — 1 个</summary>

- `src/query/stopHooks.ts`

</details>

<details><summary><code>src/query/tokenBudget.js.map</code> — 1 个</summary>

- `src/query/tokenBudget.js.map`

</details>

<details><summary><code>src/query/tokenBudget.ts</code> — 1 个</summary>

- `src/query/tokenBudget.ts`

</details>

<details><summary><code>src/query/transitions.js.map</code> — 1 个</summary>

- `src/query/transitions.js.map`

</details>

<details><summary><code>src/query/transitions.ts</code> — 1 个</summary>

- `src/query/transitions.ts`

</details>

<details><summary><code>src/query.ts</code> — 1 个</summary>

- `src/query.ts`

</details>

<details><summary><code>src/QueryEngine.ts</code> — 1 个</summary>

- `src/QueryEngine.ts`

</details>

<details><summary><code>src/remote/remotePermissionBridge.ts</code> — 1 个</summary>

- `src/remote/remotePermissionBridge.ts`

</details>

<details><summary><code>src/remote/RemoteSessionManager.ts</code> — 1 个</summary>

- `src/remote/RemoteSessionManager.ts`

</details>

<details><summary><code>src/remote/sdkMessageAdapter.ts</code> — 1 个</summary>

- `src/remote/sdkMessageAdapter.ts`

</details>

<details><summary><code>src/remote/SessionsWebSocket.ts</code> — 1 个</summary>

- `src/remote/SessionsWebSocket.ts`

</details>

<details><summary><code>src/renderer/favicon.png</code> — 1 个</summary>

- `src/renderer/favicon.png`

</details>

<details><summary><code>src/replLauncher.tsx</code> — 1 个</summary>

- `src/replLauncher.tsx`

</details>

<details><summary><code>src/schemas/hooks.js.map</code> — 1 个</summary>

- `src/schemas/hooks.js.map`

</details>

<details><summary><code>src/schemas/hooks.ts</code> — 1 个</summary>

- `src/schemas/hooks.ts`

</details>

<details><summary><code>src/screens/Doctor.tsx</code> — 1 个</summary>

- `src/screens/Doctor.tsx`

</details>

<details><summary><code>src/screens/REPL-minimal.js</code> — 1 个</summary>

- `src/screens/REPL-minimal.js`

</details>

<details><summary><code>src/screens/REPL.tsx</code> — 1 个</summary>

- `src/screens/REPL.tsx`

</details>

<details><summary><code>src/screens/ResumeConversation.tsx</code> — 1 个</summary>

- `src/screens/ResumeConversation.tsx`

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

<details><summary><code>src/self-hosted-runner/main.ts</code> — 1 个</summary>

- `src/self-hosted-runner/main.ts`

</details>

<details><summary><code>src/server/backends</code> — 1 个</summary>

- `src/server/backends/dangerousBackend.ts`

</details>

<details><summary><code>src/server/connectHeadless.ts</code> — 1 个</summary>

- `src/server/connectHeadless.ts`

</details>

<details><summary><code>src/server/createDirectConnectSession.ts</code> — 1 个</summary>

- `src/server/createDirectConnectSession.ts`

</details>

<details><summary><code>src/server/directConnectManager.ts</code> — 1 个</summary>

- `src/server/directConnectManager.ts`

</details>

<details><summary><code>src/server/lockfile.ts</code> — 1 个</summary>

- `src/server/lockfile.ts`

</details>

<details><summary><code>src/server/parseConnectUrl.ts</code> — 1 个</summary>

- `src/server/parseConnectUrl.ts`

</details>

<details><summary><code>src/server/server.ts</code> — 1 个</summary>

- `src/server/server.ts`

</details>

<details><summary><code>src/server/serverBanner.ts</code> — 1 个</summary>

- `src/server/serverBanner.ts`

</details>

<details><summary><code>src/server/serverLog.ts</code> — 1 个</summary>

- `src/server/serverLog.ts`

</details>

<details><summary><code>src/server/sessionManager.ts</code> — 1 个</summary>

- `src/server/sessionManager.ts`

</details>

<details><summary><code>src/server/types.ts</code> — 1 个</summary>

- `src/server/types.ts`

</details>

<details><summary><code>src/server/web-term.ts</code> — 1 个</summary>

- `src/server/web-term.ts`

</details>

<details><summary><code>src/services/awaySummary.ts</code> — 1 个</summary>

- `src/services/awaySummary.ts`

</details>

<details><summary><code>src/services/bridgeSessions</code> — 1 个</summary>

- `src/services/bridgeSessions/sessionManager.ts`

</details>

<details><summary><code>src/services/claudeAiLimits.js.map</code> — 1 个</summary>

- `src/services/claudeAiLimits.js.map`

</details>

<details><summary><code>src/services/claudeAiLimits.ts</code> — 1 个</summary>

- `src/services/claudeAiLimits.ts`

</details>

<details><summary><code>src/services/claudeAiLimitsHook.ts</code> — 1 个</summary>

- `src/services/claudeAiLimitsHook.ts`

</details>

<details><summary><code>src/services/diagnosticTracking.js.map</code> — 1 个</summary>

- `src/services/diagnosticTracking.js.map`

</details>

<details><summary><code>src/services/diagnosticTracking.ts</code> — 1 个</summary>

- `src/services/diagnosticTracking.ts`

</details>

<details><summary><code>src/services/internalLogging.js.map</code> — 1 个</summary>

- `src/services/internalLogging.js.map`

</details>

<details><summary><code>src/services/internalLogging.ts</code> — 1 个</summary>

- `src/services/internalLogging.ts`

</details>

<details><summary><code>src/services/mcpDiscovery.ts</code> — 1 个</summary>

- `src/services/mcpDiscovery.ts`

</details>

<details><summary><code>src/services/mcpServerApproval.tsx</code> — 1 个</summary>

- `src/services/mcpServerApproval.tsx`

</details>

<details><summary><code>src/services/mockRateLimits.js.map</code> — 1 个</summary>

- `src/services/mockRateLimits.js.map`

</details>

<details><summary><code>src/services/mockRateLimits.ts</code> — 1 个</summary>

- `src/services/mockRateLimits.ts`

</details>

<details><summary><code>src/services/notifier.ts</code> — 1 个</summary>

- `src/services/notifier.ts`

</details>

<details><summary><code>src/services/preventSleep.ts</code> — 1 个</summary>

- `src/services/preventSleep.ts`

</details>

<details><summary><code>src/services/rateLimitMessages.js.map</code> — 1 个</summary>

- `src/services/rateLimitMessages.js.map`

</details>

<details><summary><code>src/services/rateLimitMessages.ts</code> — 1 个</summary>

- `src/services/rateLimitMessages.ts`

</details>

<details><summary><code>src/services/rateLimitMocking.js.map</code> — 1 个</summary>

- `src/services/rateLimitMocking.js.map`

</details>

<details><summary><code>src/services/rateLimitMocking.ts</code> — 1 个</summary>

- `src/services/rateLimitMocking.ts`

</details>

<details><summary><code>src/services/tokenEstimation.js.map</code> — 1 个</summary>

- `src/services/tokenEstimation.js.map`

</details>

<details><summary><code>src/services/tokenEstimation.ts</code> — 1 个</summary>

- `src/services/tokenEstimation.ts`

</details>

<details><summary><code>src/services/vcr.js.map</code> — 1 个</summary>

- `src/services/vcr.js.map`

</details>

<details><summary><code>src/services/vcr.ts</code> — 1 个</summary>

- `src/services/vcr.ts`

</details>

<details><summary><code>src/services/voice.js.map</code> — 1 个</summary>

- `src/services/voice.js.map`

</details>

<details><summary><code>src/services/voice.ts</code> — 1 个</summary>

- `src/services/voice.ts`

</details>

<details><summary><code>src/services/voiceKeyterms.ts</code> — 1 个</summary>

- `src/services/voiceKeyterms.ts`

</details>

<details><summary><code>src/services/voiceStreamSTT.js.map</code> — 1 个</summary>

- `src/services/voiceStreamSTT.js.map`

</details>

<details><summary><code>src/services/voiceStreamSTT.ts</code> — 1 个</summary>

- `src/services/voiceStreamSTT.ts`

</details>

<details><summary><code>src/setup.ts</code> — 1 个</summary>

- `src/setup.ts`

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

<details><summary><code>src/shims/bun-bundle.ts</code> — 1 个</summary>

- `src/shims/bun-bundle.ts`

</details>

<details><summary><code>src/skills/bundledSkills.js.map</code> — 1 个</summary>

- `src/skills/bundledSkills.js.map`

</details>

<details><summary><code>src/skills/bundledSkills.ts</code> — 1 个</summary>

- `src/skills/bundledSkills.ts`

</details>

<details><summary><code>src/skills/loadSkillsDir.js.map</code> — 1 个</summary>

- `src/skills/loadSkillsDir.js.map`

</details>

<details><summary><code>src/skills/loadSkillsDir.ts</code> — 1 个</summary>

- `src/skills/loadSkillsDir.ts`

</details>

<details><summary><code>src/skills/mcpSkillBuilders.js.map</code> — 1 个</summary>

- `src/skills/mcpSkillBuilders.js.map`

</details>

<details><summary><code>src/skills/mcpSkillBuilders.ts</code> — 1 个</summary>

- `src/skills/mcpSkillBuilders.ts`

</details>

<details><summary><code>src/skills/mcpSkills.js.map</code> — 1 个</summary>

- `src/skills/mcpSkills.js.map`

</details>

<details><summary><code>src/skills/mcpSkills.ts</code> — 1 个</summary>

- `src/skills/mcpSkills.ts`

</details>

<details><summary><code>src/source-manager.ts</code> — 1 个</summary>

- `src/source-manager.ts`

</details>

<details><summary><code>src/ssh/createSSHSession.ts</code> — 1 个</summary>

- `src/ssh/createSSHSession.ts`

</details>

<details><summary><code>src/ssh/SSHSessionManager.ts</code> — 1 个</summary>

- `src/ssh/SSHSessionManager.ts`

</details>

<details><summary><code>src/state/AppState.tsx</code> — 1 个</summary>

- `src/state/AppState.tsx`

</details>

<details><summary><code>src/state/AppStateStore.js.map</code> — 1 个</summary>

- `src/state/AppStateStore.js.map`

</details>

<details><summary><code>src/state/AppStateStore.ts</code> — 1 个</summary>

- `src/state/AppStateStore.ts`

</details>

<details><summary><code>src/state/onChangeAppState.ts</code> — 1 个</summary>

- `src/state/onChangeAppState.ts`

</details>

<details><summary><code>src/state/selectors.js.map</code> — 1 个</summary>

- `src/state/selectors.js.map`

</details>

<details><summary><code>src/state/selectors.ts</code> — 1 个</summary>

- `src/state/selectors.ts`

</details>

<details><summary><code>src/state/store.js.map</code> — 1 个</summary>

- `src/state/store.js.map`

</details>

<details><summary><code>src/state/store.ts</code> — 1 个</summary>

- `src/state/store.ts`

</details>

<details><summary><code>src/state/teammateViewHelpers.ts</code> — 1 个</summary>

- `src/state/teammateViewHelpers.ts`

</details>

<details><summary><code>src/sticky-bucket-service.ts</code> — 1 个</summary>

- `src/sticky-bucket-service.ts`

</details>

<details><summary><code>src/stubs/ant</code> — 1 个</summary>

- `src/stubs/ant/claudeForChromeMcp.ts`

</details>

<details><summary><code>src/Task.ts</code> — 1 个</summary>

- `src/Task.ts`

</details>

<details><summary><code>src/tasks/LocalAgentTask</code> — 1 个</summary>

- `src/tasks/LocalAgentTask/LocalAgentTask.tsx`

</details>

<details><summary><code>src/tasks/LocalMainSessionTask.js.map</code> — 1 个</summary>

- `src/tasks/LocalMainSessionTask.js.map`

</details>

<details><summary><code>src/tasks/LocalMainSessionTask.ts</code> — 1 个</summary>

- `src/tasks/LocalMainSessionTask.ts`

</details>

<details><summary><code>src/tasks/pillLabel.ts</code> — 1 个</summary>

- `src/tasks/pillLabel.ts`

</details>

<details><summary><code>src/tasks/RemoteAgentTask</code> — 1 个</summary>

- `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx`

</details>

<details><summary><code>src/tasks/stopTask.js.map</code> — 1 个</summary>

- `src/tasks/stopTask.js.map`

</details>

<details><summary><code>src/tasks/stopTask.ts</code> — 1 个</summary>

- `src/tasks/stopTask.ts`

</details>

<details><summary><code>src/tasks/types.js.map</code> — 1 个</summary>

- `src/tasks/types.js.map`

</details>

<details><summary><code>src/tasks/types.ts</code> — 1 个</summary>

- `src/tasks/types.ts`

</details>

<details><summary><code>src/tasks.ts</code> — 1 个</summary>

- `src/tasks.ts`

</details>

<details><summary><code>src/token_queue.py</code> — 1 个</summary>

- `src/token_queue.py`

</details>

<details><summary><code>src/Tool.ts</code> — 1 个</summary>

- `src/Tool.ts`

</details>

<details><summary><code>src/tools/CtxInspectTool</code> — 1 个</summary>

- `src/tools/CtxInspectTool/CtxInspectTool.ts`

</details>

<details><summary><code>src/tools/ListPeersTool</code> — 1 个</summary>

- `src/tools/ListPeersTool/ListPeersTool.ts`

</details>

<details><summary><code>src/tools/progressEmitter.ts</code> — 1 个</summary>

- `src/tools/progressEmitter.ts`

</details>

<details><summary><code>src/tools/PushNotificationTool</code> — 1 个</summary>

- `src/tools/PushNotificationTool/PushNotificationTool.ts`

</details>

<details><summary><code>src/tools/RefactorTool</code> — 1 个</summary>

- `src/tools/RefactorTool/RefactorTool.ts`

</details>

<details><summary><code>src/tools/ReviewArtifactTool</code> — 1 个</summary>

- `src/tools/ReviewArtifactTool/ReviewArtifactTool.ts`

</details>

<details><summary><code>src/tools/SubscribePRTool</code> — 1 个</summary>

- `src/tools/SubscribePRTool/SubscribePRTool.ts`

</details>

<details><summary><code>src/tools/SuggestBackgroundPRTool</code> — 1 个</summary>

- `src/tools/SuggestBackgroundPRTool/SuggestBackgroundPRTool.js`

</details>

<details><summary><code>src/tools/testing</code> — 1 个</summary>

- `src/tools/testing/TestingPermissionTool.tsx`

</details>

<details><summary><code>src/tools/utils.js.map</code> — 1 个</summary>

- `src/tools/utils.js.map`

</details>

<details><summary><code>src/tools/utils.ts</code> — 1 个</summary>

- `src/tools/utils.ts`

</details>

<details><summary><code>src/tools.ts</code> — 1 个</summary>

- `src/tools.ts`

</details>

<details><summary><code>src/tool_extractor.py</code> — 1 个</summary>

- `src/tool_extractor.py`

</details>

<details><summary><code>src/types/zstd-codec.d.ts</code> — 1 个</summary>

- `src/types/zstd-codec.d.ts`

</details>

<details><summary><code>src/upstreamproxy/relay.ts</code> — 1 个</summary>

- `src/upstreamproxy/relay.ts`

</details>

<details><summary><code>src/upstreamproxy/upstreamproxy.ts</code> — 1 个</summary>

- `src/upstreamproxy/upstreamproxy.ts`

</details>

<details><summary><code>src/util.ts</code> — 1 个</summary>

- `src/util.ts`

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

<details><summary><code>src/vim/motions.ts</code> — 1 个</summary>

- `src/vim/motions.ts`

</details>

<details><summary><code>src/vim/operators.ts</code> — 1 个</summary>

- `src/vim/operators.ts`

</details>

<details><summary><code>src/vim/textObjects.ts</code> — 1 个</summary>

- `src/vim/textObjects.ts`

</details>

<details><summary><code>src/vim/transitions.ts</code> — 1 个</summary>

- `src/vim/transitions.ts`

</details>

<details><summary><code>src/vim/types.ts</code> — 1 个</summary>

- `src/vim/types.ts`

</details>

<details><summary><code>src/voice/voiceModeEnabled.js.map</code> — 1 个</summary>

- `src/voice/voiceModeEnabled.js.map`

</details>

<details><summary><code>src/voice/voiceModeEnabled.ts</code> — 1 个</summary>

- `src/voice/voiceModeEnabled.ts`

</details>

<details><summary><code>src/__init__.py</code> — 1 个</summary>

- `src/__init__.py`

</details>

<details><summary><code>src/__tests__/main</code> — 1 个</summary>

- `src/__tests__/main/ipc-handlers.test.ts`

</details>
