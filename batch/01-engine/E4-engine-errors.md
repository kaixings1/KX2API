# E4 · 错误处理 errors

- **目录**：`src/engine/errors`
- **孤儿数**：5
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部归档（5/5）**。

| 文件 | 大小/行数 | 定性 | 处置 |
| --- | ---: | --- | --- |
| `circuitBreaker.ts` | 251 行 | 通用熔断器（`CircuitBreaker` / `CircuitBreakerConfig` / `CircuitBreakerResult`），**零引用**。项目已有活的 `CompactCircuitBreaker`（`src/engine/compactCoordinator.ts:140`，被 `compactCoordinator.test.ts` 与 `pauseAndCircuit.test.ts` 覆盖）—— 本文件是**未被采用的通用版本** | **归档** |
| `classifier.js.map` | 1.8 KB | 构建残留（`classifier.ts` 是活文件） | **归档** |
| `index.js.map` | 1.9 KB | 同上（`index.ts` 活） | **归档** |
| `recovery.js.map` | 2.2 KB | 同上（`recovery.ts` 活） | **归档** |
| `retryHandler.js.map` | 2.1 KB | 同上（`retryHandler.ts` 活） | **归档** |

> 这两个 `.js.map` 与 E8 同类：目录里只有 `.ts` 源码、没有配对 `.js`，
> 说明 map 是历史构建操作的残留，不参与构建/运行/类型检查三者。

## 清单（5）

| 完成 | 路径 | 处置 | D:\src 来源 |
| :---: | --- | --- | --- |
| [x] | `src/engine/errors/circuitBreaker.ts` | **归档** → `legacy/src/engine/errors/` | `D:\src\engine\errors\circuitBreaker.ts`（high） |
| [x] | `src/engine/errors/classifier.js.map` | **归档** | — |
| [x] | `src/engine/errors/index.js.map` | **归档** | — |
| [x] | `src/engine/errors/recovery.js.map` | **归档** | — |
| [x] | `src/engine/errors/retryHandler.js.map` | **归档** | — |

## 验证记录

- 归档后 `src/engine/errors/` 只剩活文件：`classifier.ts`、`index.ts`、`recovery.ts`、
  `retryHandler.ts`、`toolErrorFormat.ts`
- 已随 E3/E6 一并执行 `typecheck` + `test:all`，全绿
