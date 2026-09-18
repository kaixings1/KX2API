# E8 · 子代理 subagent

- **目录**：`src/engine/subagent`
- **孤儿数**：2
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

本批的 2 个"孤儿"是 **sourcemap 构建残留**（对应的 `.ts` 源码都在且是活的）：

| 文件 | 大小 | 定性 | 处置 |
| --- | ---: | --- | --- |
| `src/engine/subagent/config.js.map` | 877 B | `config.ts` 的 sourcemap 残留 —— **没有 `config.js` 与之配对**（`.gitignore` 忽略 `src/**/*.js`），是构建/转译留下的一次性产物 | **归档** |
| `src/engine/subagent/subAgentManager.js.map` | 2.9 KB | 同上（`subAgentManager.ts` 是活文件） | **归档** |

**判据**：`.js.map` 必须与 `.js` 配对才有意义。本目录只有 `.ts` 源码、没有 `.js`，
说明 map 是**历史构建操作**的残留 —— 它不参与任何构建/运行，且会让体检报告把它当文件统计。

> 📌 **注意**：这两个 `.map` **是被 git 跟踪的**（与 `.d.ts` 不同）。
> 所以归档它们会产生真实的 git 改动，需要提交才会生效。

## 清单（2）

| 完成 | 路径 | 处置 | D:\src 来源 |
| :---: | --- | --- | --- |
| [x] | `src/engine/subagent/config.js.map` | **归档** → `legacy/src/engine/subagent/` | — |
| [x] | `src/engine/subagent/subAgentManager.js.map` | **归档** → `legacy/src/engine/subagent/` | — |

## 验证记录

- 归档后 `src/engine/subagent/` 只剩活源码：`config.ts`、`subAgentManager.ts`
- 本批不影响类型检查/测试/构建（`.map` 不参与三者）
