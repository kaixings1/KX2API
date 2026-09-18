# E5 · 命令系统 commands

- **目录**：`src/engine/commands`
- **孤儿数**：6
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

| 文件 | 定性 | 处置 |
| --- | --- | --- |
| `impl.ts`（104 行） | 导出 `gitCommitImpl`/`gitBlameImpl`/`searchImpl`/`dockerImpl`/`execImpl`/`commandImpls`。**零引用** | **归档** |
| `impl.d.ts` | 被同名 `impl.ts` 取代的旧声明 | **归档** |
| `importer.d.ts` | 被同名 `importer.ts`（活）取代的旧声明 | **归档** |
| `registry.d.ts` | 被同名 `registry.ts`（活）取代的旧声明 | **归档** |
| `__tests__/executeCommand.test.ts` | **活跃测试**（测 `../../index`，16 用例在跑） | **保留** |
| `__tests__/init.test.ts` | **活跃测试**（测 `../init`，`init.ts` 是活文件） | **保留** |

**⚠️ 一次差点误判的核实**：`git grep "gitCommitImpl"` 会命中
`src/engine/agent/command-runners.ts`，看起来像"被引用"。
但读该文件发现它**自己定义了同名 `const gitCommitImpl: CommandRunner`**（局部实现），
与 `commands/impl.ts` 的导出**只是同名**。再次用完整路径
`git grep "commands/impl"` 才确认：**零引用**。

> **教训**：查引用不能只按符号名，必须按**导入路径**确认。本项目同名符号极多
> （`fixToolHistory`、`CircuitBreaker`、`PlanStep`、这次的 `*Impl` …），
> 按名字 grep 会把"各处自己定义的同名东西"误读成"相互引用"。

**安全性确认**：`src/engine/commands/index.ts`（barrel）**没有**导出 `impl` / `importer`，
所以归档不会造成 barrel 断链。

## 清单（6）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/commands/__tests__/executeCommand.test.ts` | **保留**（活跃测试） |
| [x] | `src/engine/commands/__tests__/init.test.ts` | **保留**（活跃测试） |
| [x] | `src/engine/commands/impl.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/commands/impl.ts` | **归档**（零引用） |
| [x] | `src/engine/commands/importer.d.ts` | **归档**（旧声明） |
| [x] | `src/engine/commands/registry.d.ts` | **归档**（旧声明） |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all` → 全通过
- `vitest run src/engine/commands/__tests__` → 2 files / 16 tests passed
