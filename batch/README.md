# 孤儿文件分批清理方案

## 这是什么

`src/` 下有 **437 个孤儿文件**（无任何生产代码引用，也未被测试引用）。
本目录把它拆成 **54 个批次**，每批一个文件、一份可勾选清单，逐批执行、逐批标记。

依据：`npm run check:repo`（完整依赖追踪口径，从 4 个真实入口出发）
生成时间：2026-09-18
原始报告：`docs/integration-report.md`

## 目录结构

```
batch/
├── README.md              ← 本文件（总索引 + 进度总表）
├── progress.json          ← 机器可读的完成状态
├── 01-engine/   (12 批)   ← src/engine 下
├── 02-main/     (30 批)   ← src/main 下（KX2API 特有结构，孤儿最多）
├── 03-tests/    (4 批)    ← src/__tests__ 下
├── 04-renderer/ (2 批)    ← src/renderer 下
└── 05-other/    (6 批)    ← security / shared / utils / memory / preload / generated
```

## 执行方式（每批固定四步）

1. **逐文件确认引用**（不能只看 import，还要看动态 `import()`、字符串路径、配置文件里的引用）
   ```bash
   grep -rn "<文件名（去后缀）>" src tests scripts
   ```
2. **三选一处置**，并把结果填进批次文件的「处置」列
   - 确认无引用 → `git rm <具体文件>`（**禁止**按后缀批量删）
   - 有参考价值 → 移动到 `legacy/` 对应位置
   - 其实有用、只是没接线 → 接线 + 补测试
3. **全量验证**（必须全过）
   ```bash
   npm run typecheck && npm run build && npm run test:all
   ```
4. **标记完成**：勾选清单 `[ ]` → `[x]`，把头部「状态」改为 `✅ 已完成`、
   填「完成时间」，并同步更新 `progress.json`

## 铁律

- `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— **这两类文件不被 git 跟踪**。
  按后缀批量删会误伤手写声明文件（如 `src/renderer/src/types/electron.d.ts`）。
  **只删逐文件确认过的具体路径。**
- `src/__tests__/**` 是 vitest 用例，删之前先确认对应源码是否也删；
  删源码留测试会导致 vitest 收集失败。
- 每批**独立提交**，便于回溯（一次只动一个批次）。
- 涉及 `src/engine/` 与 `src/main/` 的批次注意：可能有其它会话在并行开发，
  动手前用 `git status` 确认工作树干净。

## 进度总表

> 每完成一批，把 ⬜ 改为 ✅。`progress.json` 是同一信息的机器可读版本。

### 01-engine（12 批 / 92 文件）
| 状态 | 批次 | 目录 | 文件数 |
| :---: | --- | --- | ---: |
| ⬜ | [E1](01-engine/E1-engine-tool-harness.md) | `src/engine/tool-harness` | 10 |
| ⬜ | [E2](01-engine/E2-engine-agent.md) | `src/engine/agent` | 9 |
| ⬜ | [E3](01-engine/E3-engine-flow.md) | `src/engine/flow` | 4 |
| ⬜ | [E4](01-engine/E4-engine-errors.md) | `src/engine/errors` | 5 |
| ⬜ | [E5](01-engine/E5-engine-commands.md) | `src/engine/commands` | 6 |
| ⬜ | [E6](01-engine/E6-engine-llm-tool-parser.md) | `src/engine/llm-tool-parser` | 3 |
| ⬜ | [E7](01-engine/E7-engine-hooks.md) | `src/engine/hooks` | 2 |
| ⬜ | [E8](01-engine/E8-engine-subagent.md) | `src/engine/subagent` | 2 |
| ⬜ | [E9](01-engine/E9-engine-tool-history-guard.md) | `src/engine/tool-history-guard` | 2 |
| ⬜ | [E10](01-engine/E10-engine-api.md) | `src/engine/api` | 1 |
| ⬜ | [E11](01-engine/E11-engine-__tests__.md) | `src/engine/__tests__` | 9 |
| ⬜ | [E12](01-engine/E12-engine.md) | `src/engine`（根目录散落） | 20 |

### 02-main（30 批 / 313 文件）
| 状态 | 批次 | 目录 | 文件数 |
| :---: | --- | --- | ---: |
| ⬜ | [M1](02-main/M1-main-proxy-adapters-__mocks__.md) | `src/main/proxy/adapters/__mocks__` | 26 |
| ⬜ | [M2](02-main/M2-main-proxy-adapters-prompt.md) | `src/main/proxy/adapters/prompt` | 12 |
| ⬜ | [M3](02-main/M3-main-proxy-adapters-transformers.md) | `src/main/proxy/adapters/transformers` | 3 |
| ⬜ | [M4](02-main/M4-main-proxy-adapters.md) | `src/main/proxy/adapters` | 30 |
| ⬜ | [M5](02-main/M5-main-proxy-toolCalling.md) | `src/main/proxy/toolCalling` | 31 |
| ⬜ | [M6](02-main/M6-main-proxy-utils.md) | `src/main/proxy/utils` | 21 |
| ⬜ | [M7](02-main/M7-main-proxy-routes.md) | `src/main/proxy/routes` | 14 |
| ⬜ | [M8](02-main/M8-main-proxy-prompt.md) | `src/main/proxy/prompt` | 10 |
| ⬜ | [M9](02-main/M9-main-proxy-services.md) | `src/main/proxy/services` | 3 |
| ⬜ | [M10](02-main/M10-main-proxy-config.md) | `src/main/proxy/config` | 2 |
| ⬜ | [M11](02-main/M11-main-proxy-tools.md) | `src/main/proxy/tools` | 4 |
| ⬜ | [M12](02-main/M12-main-proxy.md) | `src/main/proxy`（根） | 14 |
| ⬜ | [M13](02-main/M13-main-oauth.md) | `src/main/oauth` | 21 |
| ⬜ | [M14](02-main/M14-main-providers.md) | `src/main/providers` | 14 |
| ⬜ | [M15](02-main/M15-main-utils.md) | `src/main/utils` | 14 |
| ⬜ | [M16](02-main/M16-main-store.md) | `src/main/store` | 9 |
| ⬜ | [M17](02-main/M17-main-tools.md) | `src/main/tools` | 6 |
| ⬜ | [M18](02-main/M18-main-security.md) | `src/main/security` | 5 |
| ⬜ | [M19](02-main/M19-main-ipc.md) | `src/main/ipc` | 5 |
| ⬜ | [M20](02-main/M20-main-agent.md) | `src/main/agent` | 4 |
| ⬜ | [M21](02-main/M21-main-requestLogs.md) | `src/main/requestLogs` | 4 |
| ⬜ | [M22](02-main/M22-main-tray.md) | `src/main/tray` | 4 |
| ⬜ | [M23](02-main/M23-main-window.md) | `src/main/window` | 3 |
| ⬜ | [M24](02-main/M24-main-types.md) | `src/main/types` | 3 |
| ⬜ | [M25](02-main/M25-main-agents.md) | `src/main/agents` | 2 |
| ⬜ | [M26](02-main/M26-main-appLogs.md) | `src/main/appLogs` | 2 |
| ⬜ | [M27](02-main/M27-main-logger.md) | `src/main/logger` | 2 |
| ⬜ | [M28](02-main/M28-main-updater.md) | `src/main/updater` | 2 |
| ⬜ | [M29](02-main/M29-main-__tests__.md) | `src/main/__tests__` | 2 |
| ⬜ | [M30](02-main/M30-main.md) | `src/main`（根目录散落） | 10 |

### 03-tests（4 批 / 50 文件）
| 状态 | 批次 | 目录 | 文件数 |
| :---: | --- | --- | ---: |
| ✅ | [T1](03-tests/T1-__tests__-engine.md) | `src/__tests__/engine` | 28 |
| ✅ | [T2](03-tests/T2-__tests__-main.md) | `src/__tests__/main` | 11 |
| ✅ | [T3](03-tests/T3-__tests__-components.md) | `src/__tests__/components` | 10 |
| ✅ | [T4](03-tests/T4-__tests__.md) | `src/__tests__`（根） | 1 |

### 04-renderer（2 批 / 15 文件）
| 状态 | 批次 | 目录 | 文件数 |
| :---: | --- | --- | ---: |
| ✅ | [R1](04-renderer/R1-renderer-src-components.md) | `src/renderer/src/components` | 6 |
| ✅ | [R2](04-renderer/R2-renderer-src.md) | `src/renderer/src`（其它） | 9 |

### 05-other（6 批 / 15 文件）
| 状态 | 批次 | 目录 | 文件数 |
| :---: | --- | --- | ---: |
| ✅ | [X1](05-other/X1-security.md) | `src/security` | 5 |
| ✅ | [X2](05-other/X2-shared.md) | `src/shared` | 4 |
| ✅ | [X3](05-other/X3-utils.md) | `src/utils` | 3 |
| ✅ | [X4](05-other/X4-memory.md) | `src/memory` | 1 |
| ✅ | [X5](05-other/X5-preload.md) | `src/preload` | 1 |
| ✅ | [X6](05-other/X6-generated.md) | `src/generated` | 1 |

## 已完成批次记录

| 批次 | 目录 | 文件数 | 处置 | 完成日 |
| --- | --- | ---: | --- | --- |
| X6 | `src/generated` | 1 | **全部保留**（`.d.ts` 是生效的全局声明，非孤儿） | 2026-09-18 |
| X4 | `src/memory` | 1 | **归档** → `legacy/src/memory/memory_tool.py`（移植参考源） | 2026-09-18 |
| X5 | `src/preload` | 1 | **保留**（`.d.ts` 是 index.ts 的类型声明对，生效） | 2026-09-18 |
| X3 | `src/utils` | 3 | **归档** → `legacy/src/utils/`（零引用，且与别处重复实现） | 2026-09-18 |
| X2 | `src/shared` | 4 | **归档** → `legacy/src/shared/`（旧 .d.ts 被 .ts 取代 + 终端场景模块 + 零引用类型） | 2026-09-18 |
| X1 | `src/security` | 5 | 4 **保留**（安全基础设施，未接线）+ 1 **归档**（SandboxExecutor 与 engine/sandbox 重复） | 2026-09-18 |
| T1 | `src/__tests__/engine` | 28 | **全部保留**（活跃测试，483 用例在跑） | 2026-09-18 |
| T2 | `src/__tests__/main` | 11 | **全部保留**（活跃测试，156 用例在跑） | 2026-09-18 |
| T3 | `src/__tests__/components` | 10 | **全部保留**（活跃测试，120 用例在跑） | 2026-09-18 |
| T4 | `src/__tests__`（根） | 1 | **归档**（随 X2：被测模块已归档） | 2026-09-18 |
| R1 | `src/renderer/src/components` | 6 | **全部归档**（零引用的 UI 组件：整个 oauth 目录 + LogDetailModal + LoginGuideDialog） | 2026-09-18 |
| R2 | `src/renderer/src`（其它） | 9 | 归档 3（零引用 hooks/store）+ 保留 6（活 .d.ts + 活跃测试）；**顺带修复一个时序脆弱的并发测试** | 2026-09-18 |

### 经验：体检报告标 "孤儿" ≠ 可以删

X6 是本方案第一个执行批次，它验证了这条铁律：
`src/generated/globals.d.ts` 在报告里是孤儿（无任何 import），
但它声明了 `MACRO` / `BUILD_ENV` 等构建期全局量，
而 `tsconfig.check.json` 的 `include: ["src/**/*.ts"]` **覆盖 `.d.ts`**，
所以它不需要被 import 也生效。**`.d.ts` 一律先看"声明了什么、谁在用"，再决定。**

## 建议执行顺序

1. **先做低风险的**：`05-other` → `03-tests`（这些目录小、影响面窄，用来验证流程）
2. **再做 `01-engine`**：引擎层，需注意与其它会话的并行改动
3. **最后 `02-main`**：313 个文件、KX2API 特有结构，最容易误伤，放最后
4. **`04-renderer`** 可在任意时间做（与后端解耦）

## 关于 D:\src 来源标注

批次里「D:\src 来源」列用的是**严格匹配**（同名文件 + 父目录名一致），
437 个孤儿中只有 **49 个**能可靠溯源到 `D:\src` —— 其余是 KX2API 自己的历史代码。
不要把「无来源标注」理解为「不是移植来的」，只表示**无法可靠对应**。
