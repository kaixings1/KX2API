# R1 · 渲染层组件

- **目录**：`src/renderer/src/components`
- **孤儿数**：6
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部归档（6/6）** —— 这 6 个组件都有完整实现，但**零引用**。

| 文件 | 规模 | 定性 | 处置 |
| --- | ---: | --- | --- |
| `components/oauth/LoginDialog.tsx` | 468 行 | 整个 `components/oauth/` 目录**零引用**（`git grep "from '.*oauth"` 命中的全是 `src/main/oauth/`，主进程那套） | **归档** |
| `components/oauth/OAuthProgress.tsx` | 116 行 | 同上（仅被同目录的 LoginDialog/index 引用，而它们本身无人用） | **归档** |
| `components/oauth/TokenInput.tsx` | 118 行 | 同上 | **归档** |
| `components/oauth/index.ts` | 11 行 | 该目录的 barrel，随目录一起归档 | **归档** |
| `components/logs/LogDetailModal.tsx` | 180 行 | **零引用**。注意：同目录的 `LogDetail.tsx` 是**活的**（被 `RequestLogDetail`/`LogList`/`index` 引用），只有 `LogDetailModal` 无人使用 | **归档** |
| `components/providers/LoginGuideDialog.tsx` | 409 行 | **零引用**：`AddAccountDialog`/`AddProviderDialog` 都没有导入它（已逐个核对二者的 import 列表） | **归档** |

**归档后可随时找回**：实现完整（含此前汉化轮次补的 14 处引导文案），
放在 `legacy/src/renderer/src/components/` 对应位置，需要时原样搬回。

> 📌 **踩坑提醒**：本批一度差点误判 `components/oauth/index.ts` 被大量引用 ——
> 用 `git grep "index"` 会把 `src/renderer/src/index.css`、`main.tsx` 等全部命中。
> **查引用必须用完整路径片段**（如 `components/oauth` / `from '.*oauth`），
> 不能用裸文件名，尤其 `index` 这种通用名。

## 清单（6）

| 完成 | 路径 | 处置 | D:\src 来源 |
| :---: | --- | --- | --- |
| [x] | `src/renderer/src/components/logs/LogDetailModal.tsx` | **归档** → `legacy/.../logs/` | — |
| [x] | `src/renderer/src/components/oauth/LoginDialog.tsx` | **归档** → `legacy/.../oauth/` | — |
| [x] | `src/renderer/src/components/oauth/OAuthProgress.tsx` | **归档** | — |
| [x] | `src/renderer/src/components/oauth/TokenInput.tsx` | **归档** | — |
| [x] | `src/renderer/src/components/oauth/index.ts` | **归档** | `D:\src\services\oauth\index.ts`（medium） |
| [x] | `src/renderer/src/components/providers/LoginGuideDialog.tsx` | **归档** → `legacy/.../providers/` | — |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all` → extras 841 / unit 全通过
- `npm run build` → **成功**（确认归档 renderer 组件不影响打包）
- 顺带删除归档后变空的 `src/renderer/src/components/oauth/` 目录
