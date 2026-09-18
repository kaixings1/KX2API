# E11 · 引擎独立测试脚本

- **目录**：`src/engine/__tests__`
- **孤儿数**：9
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 为什么它们被标为孤儿（口径说明）

`vitest.config.ts` **显式排除了这个目录**：

```ts
include: ['src/**/__tests__/**/*.test.ts', ...]
exclude: [ 'src/engine/__tests__/**', ... ]     // ← 本目录
```

所以 `vitest run src/engine/__tests__` → `No test files found`。
它们也不是 node:test（`tests/` 下才会被 `tests/run-all.mjs` 收集）。
**它们是 CLAUDE.md 里写明的「独立脚本型用例」**：自带 `process.exit`，不进任何套件，
要手动跑 `npx tsx src/engine/__tests__/<名字>.test.ts`。

## 处置结论

**全部保留（0 个归档）** —— 它们是有明确用途的手动脚本，且依赖全部完整。

| 文件 | 用途（取自文件头注释） | 依赖 | 是否需网络 |
| --- | --- | --- | --- |
| `client.test.ts` | API client URL 构建测试 | ✅ | 否 |
| `tools.test.ts` | 验证 10 个工具命令（pwd/ls/dir/grep/find/where/python…） | ✅ | 否 |
| `engine.test.ts` | 引擎测试套件 | ✅ | 否 |
| `integration.test.ts` | 端到端集成测试（模拟完整 API 请求流程） | ✅ | 否 |
| `model.test.ts` | 模型连接测试（`--apiKey` 传参） | ✅ | 是 |
| `e2e-chat.test.ts` | 完整链路：引擎 → API → 实际响应 | ✅ | 是 |
| `e2e-all-profiles.test.ts` | 逐个 profile 试出一个能响应的 | ✅ | 是 |
| `stepfun-direct.test.ts` | 直连 StepFun API 看原始返回 | ✅ | 是 |
| `modelscope-auth.test.ts` | ModelScope 三种鉴权方式对比 | ✅ | 是 |

## 🔴 顺带修复：两处硬编码的真实 API Key（安全问题）

本批次扫描时发现**源码里写死了真实密钥**，而这两个文件**受 git 跟踪**
（硬编码凭据会永久留在仓库历史中，删掉当前行也不会从历史里消失）：

| 文件 | 问题 | 修复 |
| --- | --- | --- |
| `src/engine/__tests__/modelscope-auth.test.ts:7` | `const API_KEY = 'ms-e0186bce3a8b49eda2f33d60c84a1492'` | 改为 `process.env.MODELSCOPE_API_KEY`，缺失时打印用法并 `process.exit(1)` |
| `src/engine/__tests__/e2e-chat.test.ts:11` | profiles 里 ModelScope 那条写死了同一个 key | 三个 profile 全部改为读环境变量（`MODELSCOPE_API_KEY` / `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY`），未提供的自动跳过 |
| `tools/diag-llm.ts:7` | `const API_KEY = "sk-2932c2b5df154948a721024a6d74b4fe"`（DeepSeek 真实 key） | 改为读 `DEEPSEEK_API_KEY` |

**全仓库复扫结果**：剩余的 `sk-`/`AKIA` 命中全是**测试用的占位串**
（`sk-1234567890abcdef…`、`AKIAIOSFODNN7EXAMPLE` 是 AWS 官方文档示例）——
作为测试输入数据存在是正确的，不是泄露。

> ⚠️ **后续建议（需人工决策）**：这三个 key 已进入 git 历史，
> 严格来说应在服务商侧**作废并轮换**。代码修复只能阻止"继续泄露"，
> 无法从历史中抹除。是否轮换由你决定。

## 清单（9）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/__tests__/client.test.ts` | **保留**（手动脚本） |
| [x] | `src/engine/__tests__/e2e-all-profiles.test.ts` | **保留**（并修掉硬编码 key） |
| [x] | `src/engine/__tests__/e2e-chat.test.ts` | **保留**（并修掉硬编码 key） |
| [x] | `src/engine/__tests__/engine.test.ts` | **保留** |
| [x] | `src/engine/__tests__/integration.test.ts` | **保留** |
| [x] | `src/engine/__tests__/model.test.ts` | **保留** |
| [x] | `src/engine/__tests__/modelscope-auth.test.ts` | **保留**（并修掉硬编码 key） |
| [x] | `src/engine/__tests__/stepfun-direct.test.ts` | **保留** |
| [x] | `src/engine/__tests__/tools.test.ts` | **保留** |

## 验证记录

- `npm run typecheck` → 0 错误（确认改环境变量后类型正常）
- `npm run test:all` → 全通过（这些脚本本就不在任何自动套件里，改动不影响它们）
- 密钥复扫：`src/`、`tests/`、`scripts/`、`tools/` 下已无真实密钥
