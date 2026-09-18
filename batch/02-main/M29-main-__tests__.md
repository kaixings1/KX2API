# M29 · 主进程测试

- **目录**：`src/main/__tests__`
- **孤儿数**：2
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部保留（0 个归档）** —— 两个文件性质不同，但都不该删：

| 文件 | 性质 | 实测 | 处置 |
| --- | --- | --- | --- |
| `engine-bridge.test.ts`（113 行） | **vitest 用例**（`import { describe, it, expect } from 'vitest'`） | `vitest run src/main/__tests__` → **1 file / 12 tests passed** | **保留** |
| `profiles.test.ts`（33 行） | **独立脚本**（自带 `process.exit`，打印全局配置路径） | vitest 的 `exclude` **显式列出**了它；不在 `tests/` 下故 node:test 也不收 | **保留** |

**关键辨析**：vitest 的 exclude 只排除了 `profiles.test.ts` **这一个文件**，
`engine-bridge.test.ts` **仍会被收集执行**（实测 12 个用例通过）。
二者在体检报告里都因"无人 import"被标成孤儿 —— 同 T1~T4 / E11 的「假孤儿：测试文件」类。

## 清单（2）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/main/__tests__/engine-bridge.test.ts` | **保留**（活跃 vitest 用例，12 个在跑） |
| [x] | `src/main/__tests__/profiles.test.ts` | **保留**（独立脚本，被 vitest 显式 exclude） |

## 验证记录

- `vitest run src/main/__tests__` → 1 file / 12 tests passed
- 本批**未改动任何文件**，无回归风险
