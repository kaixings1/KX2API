# M18 · 安全 security（main 侧）

- **目录**：`src/main/security`
- **孤儿数**：5
- **状态**：✅ 已完成（**结论：全部保留**）
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 🔴 本轮踩的最严重的坑：漏查了一种 import 写法

我第一轮判定 `src/main/security/` 是「未被引用的副本」，归档了它、并把
`tests/security/*` 的 import 改指向 `src/security/`（活跃版本）。
结果 **typecheck + extras 双双失败**：

```
error TS2307: Cannot find module './security/index.ts'   ← src/main/index.ts:29
✖ OutputSanitizer: redacts API key                        ← 两套实现行为不同
```

两个独立的问题：

1. **`src/main/index.ts:29` 引用了它**（写法是 `import ... from './security/index.ts'`
   —— **没有 `main/` 前缀**）。我用 `git grep "main/security"` 查引用，
   **这种"同目录内相对引用"根本匹配不到**。
2. **两套实现行为确实不同**：活跃版 `src/security/OutputSanitizer.ts` 不做
   「`api_key = xxx` 格式脱敏」，而 `src/main/security/` 那份做 —— 测试断言的
   正是后者。所以它们**不是可以互换的副本**。

已完整回滚（恢复 7 个文件 + 恢复 3 个测试的 import），验证全绿。

> 📌 **教训（重要）**：
> ① 查"谁引用了我"**不能只按目录名 grep**。同目录内的相对引用
> （`./security/index.ts`）不含目录名，必然漏掉。要按**被引用文件的 basename**
> （`security/index`、`OutputSanitizer`）或完整路径分别查。
> ② **"同名同签名" ≠ "行为相同"**。跨目录的"副本"必须比对行为，不能凭文件列表推断。
> ③ 项目里那条注释「`src/main/security/` 是未被引用的副本 —— 测试必须指向活跃版本」
> **是过时/错误的**。它导致了本轮的误判方向。**注释也会骗人，以实际 import 为准。**

## 处置结论（修正后）

**全部保留（0 个归档）** —— `src/main/security/` 是**活的**：

| 文件 | 引用情况 | 处置 |
| --- | --- | --- |
| `index.ts` | **被 `src/main/index.ts:29` 引用**（`./security/index.ts`） | **保留** |
| `AuditLogger.ts` / `CommandFilter.ts` / `CredentialManager.ts` / `InputValidator.ts` / `OutputSanitizer.ts` / `PathGuard.ts` | 被 `tests/security/*`（3 个测试文件）直接引用 | **保留** |

**与 `src/security/` 的关系**（两套并存，各有用途）：

| | `src/main/security/` | `src/security/` |
| --- | --- | --- |
| 被谁用 | `src/main/index.ts`（同目录相对引用） + `tests/security/*` | `src/engine/securityEnhancer.ts`（工具执行链路的净化/过滤/路径保护/审计） |
| 内容 | 6 个同名文件与另一套**逐字节不同** | 多一个 `PermissionManager.ts` |

**这说明项目里确实有两套实现，但两套都在用** —— 不是"一份活一份死"的简单关系。
是否合并属架构决策，不在本批次范围内。

## 清单（5）

| 完成 | 路径 | 处置 | D:\src 来源 |
| :---: | --- | --- | --- |
| [x] | `src/main/security/CommandFilter.ts` | **保留**（被 tests/security/path-guard.test.ts 引用） | `D:\src\security\CommandFilter.ts`（high） |
| [x] | `src/main/security/CredentialManager.ts` | **保留**（被 tests/security/credential-manager.test.ts 引用） | `D:\src\security\CredentialManager.ts`（high） |
| [x] | `src/main/security/OutputSanitizer.ts` | **保留**（行为与 src/security 版不同，测试依赖本版） | `D:\src\security\OutputSanitizer.ts`（high） |
| [x] | `src/main/security/PathGuard.ts` | **保留** | `D:\src\security\PathGuard.ts`（high） |
| [x] | `src/main/security/index.ts` | **保留**（被 `src/main/index.ts` 相对引用） | — |

> 注：本批清单只列了 5 个，实际目录有 7 个文件（还有 `AuditLogger.ts`、`InputValidator.ts`）——
> 二者同样被测试引用，一并保留。

## 验证记录

- `npm run typecheck` → **0 错误**（回滚后）
- `npm run test:all` → extras **843 通过 / 0 失败**
- 回滚操作：恢复 `src/main/security/` 全部 7 文件 + 恢复 3 个测试的 import 指向
