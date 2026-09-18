# X1 · 安全模块（顶层副本）

- **目录**：`src/security`
- **孤儿数**：5（D:\src 可靠来源 5 个）
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用（含动态 import、字符串路径、配置引用）
#    逐文件查：grep -rn "<文件名去掉后缀>" src tests scripts
# 2) 三选一处置：
#    - 确认无引用        → git rm 具体文件（勿按后缀批量删）
#    - 有参考价值        → 移动到 legacy/ 对应目录
#    - 其实有用只是没接线 → 接线并补测试
# 3) 验证（必须全过才能勾选）
npm run typecheck && npm run build && npm run test:all
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪，
> 按后缀删会误伤手写声明（如 `src/renderer/src/types/electron.d.ts`）。
> 只删本文件清单里逐个确认过的具体文件。

## 重要背景：项目里有「两套 security」

| 目录 | 文件数 | 引用情况 |
| --- | --- | --- |
| `src/security/` | 9 | **活跃**：`src/engine/securityEnhancer.ts` 用了其中 4 个（`OutputSanitizer`/`CommandFilter`/`PathGuard`/`AuditLogger`） |
| `src/main/security/` | 7 | **副本**：仅被 `tests/security/*` 引用；`textRuntimeLimits.test.ts` 的注释明确写着「src/main/security/ 是未被引用的副本 —— 测试必须指向活跃版本」 |

两套的 6 个同名文件**内容互不相同**（已逐一 sha256 比对），**不能简单合并或删除**。
`src/main/security/` 的 7 个文件**不在本批次范围内**（单独议题，需要时另开批次）。

## 处置结论

本批 5 个文件的定性依据：`securityEnhancer.ts` 实际只 import 了 4 个工具类，
其余虽被 `src/security/index.ts`（barrel）导出，但**导出 ≠ 被使用**。

| 文件 | 应用引用 | 定性 | 处置 |
| --- | --- | --- | --- |
| `src/security/SandboxExecutor.ts` | **0** | 与 `src/engine/sandbox/index.ts`（活跃的沙箱实现）**功能重复**，且零引用 | **归档** |
| `src/security/CredentialManager.ts` | 0（仅测试指向 `src/main/security/` 的副本） | 凭证管理，属**安全基础设施**，当前未接线 | **保留** |
| `src/security/PermissionManager.ts` | 0（`toolScheduler.ts` 里的同名项是**另一个 interface**） | 权限管理，安全基础设施 | **保留** |
| `src/security/InputValidator.ts` | 0 | 输入校验，安全基础设施 | **保留** |
| `src/security/index.ts` | 被 `securityEnhancer` 间接使用 | **活跃 barrel** | **保留**（已移除指向已归档文件的导出行） |

**为什么 `SandboxExecutor` 归档、其余保留**：
前者有**活跃的重复实现**（`engine/sandbox`），留着只会让后来者用错；
后者是**唯一实现**的安全基础设施，删了以后需要时得重写 —— 安全能力尤其不该为"清理数字好看"而移除。

## 清单（5）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/security/CredentialManager.ts` | **保留**（安全基础设施，未接线） | `D:\src\security\CredentialManager.ts`（high） |
| [x] | `src/security/InputValidator.ts` | **保留**（安全基础设施，未接线） | `D:\src\security\InputValidator.ts`（high） |
| [x] | `src/security/PermissionManager.ts` | **保留**（安全基础设施，未接线） | `D:\src\security\PermissionManager.ts`（high） |
| [x] | `src/security/SandboxExecutor.ts` | **归档** → `legacy/src/security/SandboxExecutor.ts`（与 engine/sandbox 重复） | `D:\src\security\SandboxExecutor.ts`（high） |
| [x] | `src/security/index.ts` | **保留**（活跃 barrel，已同步移除已归档项的导出） | — |

## 验证记录

- `npm run typecheck` → 0 错误（确认 barrel 移除导出后无断链）
- `npm run test:all` → extras 841 通过，0 失败
- `src/security/index.ts` 现有 7 个导出（原 8 个，减去 `SandboxExecutor`）
